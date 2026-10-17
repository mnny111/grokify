// Run as an always-on Node process, or invoke with --once from your scheduler.
// All transactions are created and reconciled by the authenticated server.
const origin=process.env.GROKIFY_ORIGIN;
const secret=process.env.RUNNER_SECRET;
if(!origin||!secret)throw new Error('Set GROKIFY_ORIGIN and RUNNER_SECRET.');
const url=new URL('/api/runner',origin);
if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1')throw new Error('HTTPS required.');
async function tick(){try{const headers={'Authorization':`Bearer ${secret}`,'Content-Type':'application/json'};if(process.env.SITES_SERVICE_TOKEN)headers['OAI-Sites-Authorization']=`Bearer ${process.env.SITES_SERVICE_TOKEN}`;const r=await fetch(url,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error(`Runner HTTP ${r.status}`);const data=await r.json();for(const x of data.results||[])console.log(JSON.stringify({project:x.id,status:x.status||'checked',error:x.error||null}));}catch(error){console.error(error.message);if(process.argv.includes('--once'))process.exitCode=1;}}
do{await tick();if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,60000));}while(true);
