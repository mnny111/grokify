import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import fs from 'node:fs';
const source=ts.transpileModule(fs.readFileSync('app/use-voice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({denied=false,delayed=false,unsupported=false}={}){
 const state=[],frames=new Map(),events={},errors=[],texts=[];let cleanup,release,stopped=0,closed=0,aborted=0,recognition;let amplitude=128;
 const stream={getTracks:()=>[{stop:()=>stopped++}]};
 class Audio{state='running';resume(){return Promise.resolve()}close(){closed++;return Promise.resolve()}createAnalyser(){return {getByteTimeDomainData(a){a.fill(amplitude)}}}createMediaStreamSource(){return {connect(){}}}}
 class Speech{constructor(){recognition=this}start(){}abort(){aborted++;this.onend?.()}}
 const module={exports:{}};const context={exports:module.exports,require:()=>({useState(v){const i=state.length;state.push(v);return [v,x=>state[i]=x]},useRef:v=>({current:v}),useEffect:fn=>{cleanup=fn()}}),window:{AudioContext:Audio,...(unsupported?{}:{SpeechRecognition:Speech})},navigator:{mediaDevices:{getUserMedia:()=>denied?Promise.reject(new Error('denied')):delayed?new Promise(r=>release=r):Promise.resolve(stream)}},document:{hidden:false,addEventListener:(k,fn)=>events[k]=fn,removeEventListener:k=>delete events[k]},requestAnimationFrame:fn=>{frames.set(1,fn);return 1},cancelAnimationFrame:id=>frames.delete(id),Uint8Array,Math};
 vm.runInNewContext(source,context);const voice=module.exports.useVoice(t=>texts.push(t),e=>errors.push(e));
 return {voice,state,errors,texts,frames,events,context,get stopped(){return stopped},get closed(){return closed},get recognition(){return recognition},sample(value){amplitude=value;frames.get(1)?.(100)},cleanup:()=>cleanup(),release:()=>release(stream)};
}
test('microphone volume drives animation and stop releases all resources',async()=>{const h=harness();await h.voice.toggle();assert.equal(h.state[0],true);h.sample(160);assert.ok(h.state[1]>.1);h.recognition.onresult({results:[[{transcript:'Build a game'}]]});assert.equal(h.texts[0],'Build a game');await h.voice.toggle();assert.equal(h.state[0],false);assert.equal(h.state[1],0);assert.equal(h.stopped,1);assert.equal(h.closed,1);assert.equal(h.frames.size,0)});
test('denied microphone resets listening and closes audio',async()=>{const h=harness({denied:true});await h.voice.toggle();assert.equal(h.state[0],false);assert.equal(h.state[1],0);assert.equal(h.closed,1);assert.equal(h.errors.length,1)});
test('late microphone grant after cancellation is immediately stopped',async()=>{const h=harness({delayed:true});const pending=h.voice.toggle();await new Promise(r=>setImmediate(r));await h.voice.toggle();h.release();await pending;assert.equal(h.stopped,1);assert.equal(h.state[0],false);assert.equal(h.frames.size,0)});
test('hidden page stops microphone capture',async()=>{const h=harness();await h.voice.toggle();h.context.document.hidden=true;h.events.visibilitychange();assert.equal(h.stopped,1);assert.equal(h.state[0],false)});
test('recognition errors release capture',async()=>{const h=harness();await h.voice.toggle();h.recognition.onerror({error:'network'});assert.equal(h.stopped,1);assert.equal(h.state[0],false);assert.equal(h.errors.length,1)});
test('unmount releases capture without leaving an animation loop',async()=>{const h=harness();await h.voice.toggle();h.cleanup();assert.equal(h.stopped,1);assert.equal(h.frames.size,0)});
test('unsupported speech input does not acquire a microphone',async()=>{const h=harness({unsupported:true});await h.voice.toggle();assert.equal(h.state[0],false);assert.equal(h.closed,0);assert.equal(h.errors.length,1)});
