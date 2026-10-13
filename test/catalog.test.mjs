import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogService } from '../dist/catalog/application/service.js';
import { FuseIndex } from '../dist/catalog/infrastructure/fuse-index.js';
import { RedisCatalogRepository } from '../dist/catalog/infrastructure/redis-repository.js';
import { item } from './helpers.mjs';
test('bilingual fuzzy search and rank projection preserve the catalog contract', async () => {
  const service = new CatalogService({ load: async () => [item, { ...item, slug:'demo_part', nameEn:'Demo Part', nameEs:'Pieza de ejemplo', tags:[] }] }, new FuseIndex(), 1000);
  assert.equal(service.ready(), false);
  await service.refresh();
  assert.equal(service.search('Mod de ejemplo', 1, 'maxed')[0].rank, 5);
  assert.equal(service.search('Demo Mod', 1, '0')[0].rank, 0);
  assert.equal(service.search('Pieza de ejemplo', 1, 'maxed')[0].rank, null);
});
test('failed and empty refresh keep the last good index but readiness expires', async () => {
  let now=0; let fail=false;
  const repository={load:async()=> fail ? [] : [item]};
  const service=new CatalogService(repository,new FuseIndex(),100,()=>now);
  await service.refresh();fail=true;
  await assert.rejects(service.refresh());
  assert.equal(service.ready(),true);
  assert.equal(service.search('demo_mod',1,'maxed').length,1);
  now=100;assert.equal(service.ready(),false);
});
test('Redis adapter reads only catalog hashes and tolerates corrupt optional fields', async () => {
  const calls=[];
  const redis={hvals:async key=>{calls.push(key);return ['demo_mod','missing'];},pipeline:()=>{
    const pipe={hgetall:key=>{calls.push(key);return pipe;},exec:async()=>[[null,{...item,tags:'invalid',maxRank:'invalid'}],[null,{}]]};return pipe;
  }};
  const items=await new RedisCatalogRepository(redis).load();
  assert.deepEqual(items,[{...item,tags:[],maxRank:0}]);
  assert.deepEqual(calls,['wf:id_map','wf:item:demo_mod','wf:item:missing']);
});
test('Redis pipeline errors fail refresh instead of publishing a partial index', async () => {
  const redis={hvals:async()=>['demo_mod'],pipeline:()=>({hgetall(){},exec:async()=>[[new Error('synthetic'),{}]]})};
  await assert.rejects(new RedisCatalogRepository(redis).load());
});
