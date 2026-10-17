import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('lib/server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(fetch){
 const exports={},signal={aborted:false};let timeout;
 vm.runInNewContext(source,{exports,require:name=>name==='cloudflare:workers'?{env:{XAI_API_KEY:'test'}}:{},fetch:(...args)=>fetch(signal,...args),AbortSignal:{timeout:ms=>{timeout=ms;return signal}}});
 return {api:exports,timeout:()=>timeout};
}
test('product generation can exceed the conversation timeout',async()=>{
 const h=harness(async()=>({ok:true,json:async()=>({choices:[{message:{content:'complete'}}]})}));
 assert.equal(await h.api.grok([],true,9000,240000),'complete');assert.equal(h.timeout(),240000);
 await h.api.grok([]);assert.equal(h.timeout(),90000);
});
test('timeout during generation or response reading returns a safe actionable 504',async()=>{
 for(const body of [false,true]){
  const h=harness(async signal=>{const fail=()=>{signal.aborted=true;throw new Error('sensitive upstream detail')};if(body)return {ok:true,json:fail};return fail()});
  await assert.rejects(h.api.grok([]),e=>e.status===504&&e.message.includes('blueprint')&&!e.message.includes('sensitive'));
 }
});
test('provider status and connection failures remain distinguishable without leaking details',async()=>{
 const status=harness(async()=>({ok:false,status:401}));await assert.rejects(status.api.grok([]),e=>e.status===502&&e.message.includes('401'));
 const network=harness(async()=>{throw new Error('secret')});await assert.rejects(network.api.grok([]),e=>e.status===502&&!e.message.includes('secret'));
});
