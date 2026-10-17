// Separate Railway service; holds only the runner secret, never treasury keys.
import {setTimeout as pause} from 'node:timers/promises';
const origin=process.env.GROKIFY_ORIGIN;
const secret=process.env.RUNNER_SECRET;
if(!origin||!secret||secret.length<32)throw new Error('Set GROKIFY_ORIGIN and a RUNNER_SECRET of at least 32 characters.');
const url=new URL('/api/runner',origin);
if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1')throw new Error('HTTPS required.');
const once=process.argv.includes('--once'),dryRun=process.env.RUNNER_DRY_RUN==='true';
let cursor=null,stopping=false,current;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;current?.abort()});
console.log(JSON.stringify({event:'runner-started',intervalSeconds:60,dryRun}));
do {
 current=new AbortController();const timeout=setTimeout(()=>current.abort(),120000);
 try {
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({...(cursor?{cursor}:{}),dryRun}),signal:current.signal});
  if(!r.ok)throw new Error(`Runner HTTP ${r.status}`);
  const data=await r.json();if(!Array.isArray(data.results))throw new Error('Invalid runner response');
  cursor=typeof data.nextCursor==='string'?data.nextCursor:null;
  console.log(JSON.stringify({event:'runner-tick',mode:data.mode||'unknown',checked:data.results.length,failed:data.results.filter(x=>x.error).length,more:!!cursor,time:new Date().toISOString()}));
  for(const result of data.results)console.log(JSON.stringify({project:result.id,status:result.error?'failed':result.status||'checked'}));
 } catch(error){if(!stopping){console.error(JSON.stringify({event:'runner-error',message:error.message?.startsWith('Runner HTTP ')?error.message:'Request failed; inspect the server logs.'}));if(once)process.exitCode=1}}
 finally{clearTimeout(timeout);current=null}
 if(once||stopping)break;
 current=new AbortController();try{await pause(60000,undefined,{signal:current.signal})}catch{}finally{current=null}
}while(!stopping);
