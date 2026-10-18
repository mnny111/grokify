import test from 'node:test';
import assert from 'node:assert/strict';
import {revenueTotals,forwardAmount,treasuryProject} from '../lib/revenue-accounting.ts';
test('deposits and unconfirmed claims never become buyback revenue',()=>{
 const jobs=[{kind:'deposit',status:'confirmed',payload:{received:'999999'}},{kind:'claim',status:'submitted',payload:{received:'1000'}},{kind:'claim',status:'confirmed',payload:{received:'100'}},{kind:'revenue',status:'confirmed',payload:{received:'200'}},{kind:'buyback',status:'confirmed',created:20,payload:{spent:'40'}},{kind:'buyback',status:'confirmed',created:1,payload:{spent:'10'}}];
 assert.deepEqual(revenueTotals(jobs,10),{revenue:300n,spent:50n,today:40n,forwarded:0n});
});
test('forwarding excludes already forwarded fees and preserves wallet reserve',()=>{
 assert.equal(forwardAmount(100n,70n,1000n,10n),30n);
 assert.equal(forwardAmount(100n,0n,40n,10n),30n);
 assert.equal(forwardAmount(100n,100n,1000n,10n),0n);
 assert.equal(forwardAmount(100n,0n,5n,10n),0n);
});
test('public coins never resolve to the parent signing wallet',()=>{
 assert.equal(treasuryProject({id:'child',parent:'root',public_launch:1}),'child');
 assert.equal(treasuryProject({id:'old',parent:'root',public_launch:0}),'root');
 assert.equal(treasuryProject({id:'root'}),'root');
});
