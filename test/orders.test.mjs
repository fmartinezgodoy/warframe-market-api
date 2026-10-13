import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { OrdersService } from '../dist/orders/application/service.js';
import { CachedOrdersRepository } from '../dist/orders/infrastructure/cached-repository.js';
import { WarframeOrdersRepository, parseOrders } from '../dist/orders/infrastructure/warframe-repository.js';
import { ItemNotFound, UpstreamUnavailable } from '../dist/orders/domain/orders.js';
import { filters, order, ok } from './helpers.mjs';
test('mixed orders have stable sell-first and side-specific price ordering without mutating cache', async () => {
  const input=[order('buy',10),order('sell',30),order('buy',50),order('sell',5)];
  const service=new OrdersService({get:async()=>({orders:input,cached:true})});
  const result=await service.get('demo_mod',filters,new AbortController().signal);
  assert.deepEqual(result.orders.map(o=>[o.type,o.platinum]),[['sell',5],['sell',30],['buy',50],['buy',10]]);
  assert.equal(input[0].type,'buy');
});
test('all filters apply and platform aliases request the canonical upstream context', async () => {
  let context;
  const service=new OrdersService({get:async(s,signal,c)=>{context=c;return {cached:false,orders:[order('sell',3,{user:{...order().user,platform:'xbox'}}),order('buy',4)]};}});
  const result=await service.get('demo_mod',{type:'sell',rank:5,platform:'xb1',crossplay:'true'},new AbortController().signal);
  assert.equal(result.orders.length,1);assert.deepEqual(context,{platform:'xbox',crossplay:true});
});
test('cache coalesces concurrent misses, partitions context, expires and evicts', async () => {
  let calls=0,now=0;
  const source={get:async()=>{calls++;await delay(5);return {cached:false,orders:[]};}};
  const cache=new CachedOrdersRepository(source,100,1,1000,()=>now);
  const signal=new AbortController().signal;
  const results=await Promise.all([cache.get('a',signal),cache.get('a',signal)]);
  assert.equal(calls,1);assert.equal(results[1].cached,false);
  assert.equal((await cache.get('a',signal)).cached,true);
  await cache.get('a',signal,{platform:'xbox',crossplay:false});assert.equal(calls,2);
  await cache.get('a',signal);assert.equal(calls,3);
  now=101;await cache.get('a',signal);assert.equal(calls,4);
});
test('one disconnected caller does not cancel a coalesced caller and failures are not cached', async () => {
  let calls=0;
  const cache=new CachedOrdersRepository({get:async()=>{calls++;await delay(10);if(calls===1)throw new UpstreamUnavailable();return {cached:false,orders:[]};}},100,5,1000);
  const a=new AbortController();
  const first=cache.get('a',a.signal);const second=cache.get('a',new AbortController().signal);
  a.abort();await assert.rejects(first);await assert.rejects(second);
  await cache.get('a',new AbortController().signal);assert.equal(calls,2);
});
test('upstream requests serialize and identify platform, crossplay and application', async () => {
  const times=[];let active=0,max=0;
  const repo=new WarframeOrdersRepository(20,0,async(url,init)=>{
    times.push(performance.now());active++;max=Math.max(max,active);
    assert.equal(init.headers.Platform,'xbox');assert.equal(init.headers.Crossplay,'true');
    assert.match(init.headers['User-Agent'],/WarframeMarketAPI/);
    await delay(3);active--;return ok([order()]);
  });
  const signal=new AbortController().signal;
  await Promise.all(['a','b','c'].map(slug=>repo.get(slug,signal,{platform:'xbox',crossplay:true})));
  assert.equal(max,1);assert.ok(times[1]-times[0]>=18);assert.ok(times[2]-times[1]>=18);
});
test('429 Retry-After delays retry, transient GET retries are bounded', async () => {
  let calls=0;const times=[];
  const repo=new WarframeOrdersRepository(1,1,async()=>{times.push(performance.now());calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'1'}}):ok();});
  await repo.get('a',new AbortController().signal);assert.equal(calls,2);assert.ok(times[1]-times[0]>=950);
  const fail=new WarframeOrdersRepository(1,0,async()=>new Response('',{status:503}));
  await assert.rejects(fail.get('a',new AbortController().signal),UpstreamUnavailable);
});
test('404 and malformed responses are controlled and do not trigger retries', async () => {
  let calls=0;
  const repo=new WarframeOrdersRepository(1,2,async()=>{calls++;return new Response('',{status:404});});
  await assert.rejects(repo.get('a',new AbortController().signal),ItemNotFound);assert.equal(calls,1);
  for(const value of [{data:null},{data:[{type:'sell'}]},{data:[order('sell',NaN)]}]) assert.throws(()=>parseOrders(value),UpstreamUnavailable);
  assert.equal(parseOrders({data:[order()]}).length,1);
  assert.equal(parseOrders({data:[{...order(),rank:undefined}]}).length,1);
});
test('aborted queued request never reaches upstream', async () => {
  let calls=0;
  const repo=new WarframeOrdersRepository(1,0,async()=>{calls++;await delay(20);return ok();});
  const first=repo.get('a',new AbortController().signal);
  const controller=new AbortController();const queued=repo.get('b',controller.signal);controller.abort();
  await first;await assert.rejects(queued);assert.equal(calls,1);
});
test('request timeout cancels an active fetch and oversized payloads are rejected', async () => {
  const repo=new WarframeOrdersRepository(1,0,async(url,{signal})=>{await delay(100,undefined,{signal});return ok();});
  await assert.rejects(repo.get('a',AbortSignal.timeout(10)),UpstreamUnavailable);
  const large=new WarframeOrdersRepository(1,0,async()=>new Response(' '.repeat(2*1024*1024+1)));
  await assert.rejects(large.get('a',new AbortController().signal),UpstreamUnavailable);
});


test('upstream queue rejects overload without admitting a 33rd call', async () => {
  let release;
  let calls=0;
  const hold=new Promise(resolve=>{release=resolve;});
  const repo=new WarframeOrdersRepository(1,0,async()=>{calls++;await hold;return ok();});
  const cancelled=new AbortController();
  const first=repo.get('first',new AbortController().signal);
  const queued=Array.from({length:31},(_,i)=>repo.get(String(i),cancelled.signal));
  const outcomes=Promise.allSettled(queued);
  await assert.rejects(repo.get('overflow',new AbortController().signal),UpstreamUnavailable);
  cancelled.abort();release();await first;
  assert.ok((await outcomes).every(result=>result.status==='rejected'));assert.equal(calls,1);
});
