import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
for(const status of [200,401])test(`worker handles HTTP ${status} without leaking secret`,async()=>{
 const secret='test-only-secret-'.repeat(3);let received;
 const server=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;received={auth:req.headers.authorization,body:JSON.parse(body)};res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({mode:'disabled',results:[],nextCursor:null}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
 const child=spawn(process.execPath,['scripts/revenue-runner.mjs','--once'],{env:{...process.env,GROKIFY_ORIGIN:`http://127.0.0.1:${server.address().port}`,RUNNER_SECRET:secret,RUNNER_DRY_RUN:'true'}});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 const code=await new Promise(r=>child.on('exit',r));
 assert.equal(received.auth,`Bearer ${secret}`);assert.equal(received.body.dryRun,true);assert.equal(output.includes(secret),false);assert.equal(code,status===200?0:1);assert.match(output,status===200?/"mode":"disabled"/:/Runner HTTP 401/);
 }finally{await new Promise(r=>server.close(r));}
});
