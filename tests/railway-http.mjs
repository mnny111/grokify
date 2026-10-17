import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import bs58 from 'bs58';
const origin=process.env.TEST_ORIGIN||'http://localhost:8790';
let cookies=new Map();
async function request(path,body,extra={}){
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json',origin}:{}),cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...extra},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 for(const c of r.headers.getSetCookie()){const [key,value]=c.split(';')[0].split('=');cookies.set(key,value)}
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,headers:r.headers};
}
assert.equal((await request('/healthz')).status,200);
assert.equal((await request('/api/projects',undefined,{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'attacker@example.com'})).status,401);
assert.equal((await request('/auth/challenge',{}, {origin:'https://evil.example'})).status,403);
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const wallet=bs58.encode(publicKey.export({type:'spki',format:'der'}).subarray(-32));
const c=await request('/auth/challenge',{wallet});assert.equal(c.status,200);
const signed={nonce:c.data.nonce,signature:sign(null,Buffer.from(c.data.message),privateKey).toString('base64')};
assert.equal((await request('/auth/verify',signed)).status,200);
assert.equal((await request('/auth/verify',signed)).status,401);
assert.equal((await request('/api/projects')).status,200);
const created=await request('/api/projects',{prompt:'Build a math game called Railway Persistence Test'});
assert.equal(created.status,201,JSON.stringify(created.data));
const id=created.data.project.id;
assert.equal((await request('/api/sites/'+created.data.project.site_slug)).status,404);
const build=await request('/api/projects/'+id+'/build',{});
assert.equal(build.status,200,JSON.stringify(build.data));
const site=await request('/api/sites/'+created.data.project.site_slug);
assert.equal(site.status,200);assert.equal(JSON.stringify(site.data).includes('wallet:'+wallet),false);
assert.equal((await request('/api/launchpad')).data.tokens.length,0);
const tenant=await request('/',undefined,{host:created.data.project.site_slug+'.grokify.fun:8790'});
assert.equal(tenant.status,200);assert.match(tenant.data,/Grokify/);
assert.equal((await request('/auth/logout',{})).status,200);
assert.equal((await request('/api/projects')).status,401);
console.log('HTTP checks passed: spoofed identity rejected; CSRF blocked; signed login; replay blocked; project creation; build; public site; host routing; logout. Local fixtures only.');
