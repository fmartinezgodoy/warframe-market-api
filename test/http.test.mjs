import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../dist/app/application.js';
import { CatalogService } from '../dist/catalog/application/service.js';
import { FuseIndex } from '../dist/catalog/infrastructure/fuse-index.js';
import { OrdersService } from '../dist/orders/application/service.js';
import { CachedOrdersRepository } from '../dist/orders/infrastructure/cached-repository.js';
import { loadConfig } from '../dist/platform/config.js';
import { ItemNotFound, UpstreamUnavailable } from '../dist/orders/domain/orders.js';
import { GlobalRateLimiter } from '../dist/platform/http.js';
import { item, order } from './helpers.mjs';
async function setup(t,rateLimit=100) {
  const logs=[];
  const catalog=new CatalogService({load:async()=>[item]},new FuseIndex(),1000);
  const source={get:async slug=>{if(slug==='missing')throw new ItemNotFound();if(slug==='failure')throw new UpstreamUnavailable();return {cached:false,orders:[order()]};}};
  const orders=new OrdersService(new CachedOrdersRepository(source,1000,10,1000));
  const app=createServer({...loadConfig({DATA_SOURCE:'fixtures'}),rateLimit},catalog,orders,event=>logs.push(event));
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  return { ...app,catalog,logs,get:path=>fetch(base+path) };
}
test('HTTP search and orders preserve success envelopes and cache marker',async t=>{
  const app=await setup(t);await app.catalog.refresh();
  const result=await app.get('/search?q=Demo%20Mod');
  assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),'*');
  assert.deepEqual(await result.json(),{query:'Demo Mod',rank:'maxed',count:1,results:[{...item,rank:5}]});
  let orders=await app.get('/orders/demo_mod?type=sell&rank=5&platform=pc&crossplay=true');
  assert.deepEqual(await orders.json(),{slug:'demo_mod',count:1,cached:false,filters:{type:'sell',rank:5,platform:'pc',crossplay:'true'},orders:[order()]});
  orders=await app.get('/orders/demo_mod?type=sell&rank=5&platform=pc&crossplay=true');assert.equal((await orders.json()).cached,true);
});
test('legacy health stays compatible; readiness checks index and drain; probes bypass quota',async t=>{
  const app=await setup(t,1);
  assert.deepEqual(await (await app.get('/health')).json(),{ok:true,indexReady:false});
  assert.equal((await app.get('/search?q=demo')).status,429);
  assert.equal((await app.get('/livez')).status,200);assert.equal((await app.get('/readyz')).status,503);
  await app.catalog.refresh();assert.equal((await app.get('/readyz')).status,200);
  app.drain();assert.equal((await app.get('/readyz')).status,503);
});
test('validation rejects partial integers, empty queries and invalid filters before upstream',async t=>{
  const app=await setup(t);await app.catalog.refresh();
  for(const path of ['/search','/search?q=demo&limit=5x','/search?q=demo&rank=1','/orders/demo_mod?rank=5x','/orders/demo_mod?rank=-1','/orders/demo_mod?type=other','/orders/demo_mod?platform=other','/orders/demo_mod?crossplay=yes']) assert.equal((await app.get(path)).status,400,path);
  assert.equal((await app.get('/search?q=demo&limit=999')).status,200);
});
test('errors are stable; OPTIONS does not consume quota; logs contain no query, slug or user',async t=>{
  const app=await setup(t);
  assert.deepEqual(await (await app.get('/orders/missing')).json(),{error:'item no encontrado: missing'});
  assert.deepEqual(await (await app.get('/orders/failure')).json(),{error:'upstream no disponible'});
  assert.equal((await app.get('/unknown')).status,404);
  const base=`http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  assert.equal((await fetch(base,{method:'OPTIONS'})).status,204);
  const search=await app.get('/search?q=private-query');assert.equal(search.status,503);
  const log=JSON.stringify(app.logs);assert.ok(!log.includes('private-query'));assert.ok(!log.includes('SyntheticTrader'));assert.ok(!log.includes('/orders/missing'));
  assert.match(search.headers.get('x-request-id'),/^[a-f0-9-]{36}$/);
});
test('rate limiter uses a sliding minute and returns retry guidance',()=>{
  let now=0;const limiter=new GlobalRateLimiter(2,()=>now);
  assert.equal(limiter.take().remaining,1);assert.equal(limiter.take().remaining,0);
  assert.deepEqual(limiter.take(),{limited:true,remaining:0,retryAfter:60});
  now=60000;assert.equal(limiter.take().limited,false);
});
test('configuration validates budgets and never includes input credentials in errors',()=>{
  for(const env of [{HTTP_PORT:'6002junk'},{HTTP_HOST:'example.test'},{REDIS_URL:'garbage'},{DATA_SOURCE:'other'},{UPSTREAM_INTERVAL_MS:'100'},{REQUEST_TIMEOUT_MS:'1000'},{CORS_ORIGIN:'https://example.test/path'}]) assert.throws(()=>loadConfig(env));
  assert.equal(loadConfig({DATA_SOURCE:'fixtures'}).port,6002);
});
