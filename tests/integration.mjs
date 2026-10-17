import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
assert.ok(new URL(base).hostname==='127.0.0.1','Tests must run only against the local development server.');
const auth=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=auth.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
let count=0;const ok=(name)=>{count++;console.log('PASS '+name)};
async function req(path,data,method,expected=200,headers={}){const r=await fetch(base+'/api/'+path,{method:method||(data?'POST':'GET'),headers:{cookie,...(data?{'Content-Type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined});const text=await r.text();let b;try{b=JSON.parse(text)}catch{b={error:text}}assert.equal(r.status,expected,JSON.stringify(b));return b;}
const anon=await fetch(base+'/api/projects');assert.equal(anon.status,401);ok('anonymous project access denied');
await req('projects',{prompt:'Create a game'},'POST',403,{origin:'https://attacker.invalid'});ok('cross-origin writes denied');
await req('projects',{prompt:'x'},'POST',400);ok('invalid creation rejected');
const {project:p}=await req('projects',{prompt:'Build an arithmetic game called QA Orbit with saved scores.',kind:'game'},'POST',201);assert.equal(p.kind,'game');assert.equal(p.secret,undefined);assert.equal(p.owner,undefined);ok('project persisted without exposing owner or secrets');
let d=await req('projects/'+p.id);assert.equal(d.messages.length,2);ok('conversation persisted');
await req('projects/'+p.id,{spec:p.config,revision:999},'PATCH',409);ok('stale blueprint update rejected');
await req('projects/'+p.id+'/build',{});await req('projects/'+p.id+'/build',{});d=await req('projects/'+p.id);assert.deepEqual(d.builds.map(b=>b.version),[2,1]);ok('build versions persist in order');
const product=await req('products/'+p.id);assert.equal(product.version,2);ok('product runtime reads published version');
const round=await req('products/'+p.id+'/game',{});const answer=round.question.split(' + ').map(Number).reduce((a,b)=>a+b,0);const scored=await req('products/'+p.id+'/answer',{id:round.id,answer});assert.equal(scored.correct,true);assert.ok(scored.score>0);ok('actual server challenge and scoring');
await req('products/'+p.id+'/answer',{id:round.id,answer},'POST',409);ok('score replay rejected');
assert.ok((await req('products/'+p.id+'/history')).records.some(r=>r.type==='score'));ok('score survives reload');
await req('products/'+p.id+'/tool',{input:'hello'},'POST',400);ok('runtime type boundaries enforced');
await req('projects/'+p.id+'/launch',{},'POST',503);ok('unconfigured mainnet fails closed');
await req('projects/'+p.id+'/chat',{message:'Build more'},'POST',503);ok('unconfigured AI fails honestly');
const {project:pad}=await req('projects',{prompt:'Build a launchpad called QA Pad with buybacks',kind:'launchpad'},'POST',201);await req('projects/'+pad.id+'/build',{});const child=await req('products/'+pad.id+'/child',{name:'QA Coin',symbol:'QAC'});assert.equal(child.project.parent,pad.id);assert.equal(child.project.mint,null);ok('child coin is a persisted draft, not a fabricated launch');
await req('projects/'+p.id+'/policy',{enabled:true,percent:80,maxSol:'0.1',dailySol:'0.5',reserveSol:'0.02',revision:1},'PUT',409);ok('cannot enable buybacks before launch');
await req('runner',{},'POST',401);ok('scheduled runner requires its own secret');
await req('projects/00000000-0000-4000-8000-000000000000',undefined,'GET',404);ok('unowned or missing projects are hidden');
console.log(`${count} integration checks passed. No external transaction was sent.`);

