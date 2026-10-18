import {revenueTotals,forwardAmount,treasuryProject} from './revenue-accounting';
import {tokenImage} from './token-identity';
import {siteAddress} from './site-address';
import {Keypair,Connection,VersionedTransaction,PublicKey,SystemProgram,TransactionMessage} from '@solana/web3.js';
import bs58 from 'bs58';
import {all,one,run,id,now,runtime,HttpError,lock} from './server';
import {allocation,escapeHtml} from './domain';
const b64=(a:Uint8Array)=>Buffer.from(a).toString('base64');
const bytes=(s:string)=>new Uint8Array(Buffer.from(s,'base64'));
const rpc=()=>{const url=runtime().SOLANA_RPC_URL;if(!url)throw new HttpError(503,'Set SOLANA_RPC_URL to connect the treasury.');return new Connection(url,'confirmed');};
async function authorizeTransaction(tx:VersionedTransaction,p:any,signers:Keypair[],maxDebit:bigint){
 const required=tx.message.staticAccountKeys.slice(0,tx.message.header.numRequiredSignatures).map(k=>k.toBase58());
 const expected=signers.map(k=>k.publicKey.toBase58());
 if(tx.message.staticAccountKeys[0].toBase58()!==p.treasury||required.length!==expected.length||required.some(k=>!expected.includes(k)))throw new HttpError(502,'Transaction signer mismatch. Nothing sent.');
 tx.sign(signers);
 const connection=rpc(),before=await connection.getBalance(new PublicKey(p.treasury),'confirmed');
 const simulated=await connection.simulateTransaction(tx,{sigVerify:true,commitment:'confirmed',accounts:{encoding:'base64',addresses:[p.treasury]}});
 if(simulated.value.err)throw new HttpError(409,'Transaction preflight failed. Check funding and retry; nothing was sent.');
 const after=simulated.value.accounts?.[0]?.lamports;
 if(typeof after!=='number'||BigInt(before)-BigInt(after)>maxDebit)throw new HttpError(409,'Transaction exceeds the authorized cost limit. Nothing sent.');
}
function live(){if(runtime().ENABLE_MAINNET!=='true')throw new HttpError(503,'Mainnet is not enabled. Configure the live integrations before launching or buying.');}
async function master(){const key=runtime().TREASURY_MASTER_KEY;if(!key||bytes(key).length!==32)throw new HttpError(503,'Configure a 32-byte base64 TREASURY_MASTER_KEY before creating treasuries.');return crypto.subtle.importKey('raw',bytes(key),'AES-GCM',false,['encrypt','decrypt']);}
async function encrypt(secret:Uint8Array,context:string){const iv=crypto.getRandomValues(new Uint8Array(12)),out=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(context)},await master(),secret as BufferSource);return `${b64(iv)}.${b64(new Uint8Array(out))}`;}
async function signer(p:any){const [iv,data]=p.secret.split('.');return Keypair.fromSecretKey(new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:new TextEncoder().encode(p.id)},await master(),bytes(data))));}
export async function balance(address:string){return String(await rpc().getBalance(new PublicKey(address),'confirmed'));}
export async function setupTreasury(p:any){if(p.parent&&!p.public_launch)throw new HttpError(409,'This legacy coin uses its launchpad treasury.');const release=await lock(p.id);try{p=await one('SELECT * FROM projects WHERE id=?',p.id);if(p.treasury)return {address:p.treasury};const key=Keypair.generate();const secret=await encrypt(key.secretKey,p.id);await run('UPDATE projects SET treasury=?,secret=?,updated=? WHERE id=?',key.publicKey.toBase58(),secret,now(),p.id);return {address:key.publicKey.toBase58()};}finally{await release()}}
async function upload(file:Blob,name:string){if(!runtime().PINATA_JWT)throw new HttpError(503,'Configure PINATA_JWT for token metadata.');const f=new FormData();f.append('network','public');f.append('file',file,name);const r=await fetch('https://uploads.pinata.cloud/v3/files',{method:'POST',headers:{Authorization:`Bearer ${runtime().PINATA_JWT}`},body:f,signal:AbortSignal.timeout(30000)});if(!r.ok)throw new HttpError(502,`Metadata upload failed (${r.status}).`);const data:any=await r.json();if(!data.data?.cid)throw new HttpError(502,'Metadata provider returned no CID.');return `https://ipfs.io/ipfs/${data.data.cid}`;}
async function localTx(payload:any){const r=await fetch('https://pumpportal.fun/api/trade-local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new HttpError(502,`PumpPortal returned ${r.status}; no transaction was sent.`);return VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()));}
async function persistAndSend(p:any,kind:string,tx:VersionedTransaction,payload:any){const signature=bs58.encode(tx.signatures[0]),job=id(),serialized=b64(tx.serialize());await run('INSERT INTO jobs(id,project,kind,status,signature,payload,created,updated) VALUES(?,?,?,?,?,?,?,?)',job,p.id,kind,'submitted',signature,JSON.stringify({...payload,serialized}),now(),now());try{if(kind==='buyback'&&payload.requestId){const response=await fetch('https://api.jup.ag/swap/v2/execute',{method:'POST',headers:{'Content-Type':'application/json',...(runtime().JUPITER_API_KEY?{'x-api-key':String(runtime().JUPITER_API_KEY)}:{})},body:JSON.stringify({signedTransaction:serialized,requestId:payload.requestId}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Uncertain execution');const execution:any=await response.json();if(execution.status!=='Success')throw new Error('Reconcile execution');}else{await rpc().sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:2})}}catch{await run('UPDATE jobs SET error=? WHERE id=?','Submission uncertain. Reconcile this signature before retrying.',job)}return {job,signature,status:'submitted'};}
async function pending(p:any){const jobs=await all("SELECT id FROM jobs WHERE project=? AND status='submitted'",p.id);if(jobs.length)throw new HttpError(409,'A transaction is awaiting confirmation. Reconcile it before starting another.');}
export async function launchToken(p:any,origin:string){live();const treasury=treasuryProject(p)!==p.id?await one('SELECT * FROM projects WHERE id=?',treasuryProject(p)):p;if(!treasury?.secret)throw new HttpError(409,'Create and fund the product treasury first.');const release=await lock(treasury.id);try{p=await one('SELECT * FROM projects WHERE id=?',p.id);if(p.mint)throw new HttpError(409,'This token is already launched.');await pending(treasury);const minimum=p.public_launch?30000000n:20000000n;if(BigInt(await balance(treasury.treasury))<minimum)throw new HttpError(409,`Fund this wallet with at least ${Number(minimum)/1e9} SOL for launch and its fee reserve.`);if(p.public_launch){if(!p.token_image)throw new HttpError(409,'Add token details and accept fee routing before launching.');const parent=await one('SELECT mint FROM projects WHERE id=?',p.parent);if(!parent?.mint)throw new HttpError(409,'The launchpad must launch its main token first.');}const key=await signer(treasury),mint=Keypair.generate();
 const customImage=p.token_image?tokenImage(p.token_image):null;
 const image=customImage?await upload(new Blob([new Uint8Array(customImage.bytes)],{type:customImage.type}),customImage.filename):await upload(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="100" fill="#111"/><text x="256" y="302" text-anchor="middle" font-size="110" font-family="sans-serif" fill="white">${escapeHtml(p.symbol.slice(0,4))}</text></svg>`],{type:'image/svg+xml'}),'logo.svg');
 const website=new URL(siteAddress(p,runtime().PRODUCT_BASE_DOMAIN||'grokify.fun',runtime().PRODUCT_SUBDOMAINS_ENABLED==='true'),origin).href;
 const uri=await upload(new Blob([JSON.stringify({name:p.token_name||p.name,symbol:p.token_symbol||p.symbol,description:p.description,image,website,external_url:website,extensions:{website}})],{type:'application/json'}),'metadata.json');
 const tx=await localTx({publicKey:key.publicKey.toBase58(),action:'create',tokenMetadata:{name:p.token_name||p.name,symbol:p.token_symbol||p.symbol,uri},mint:mint.publicKey.toBase58(),denominatedInSol:'true',amount:0,slippage:5,priorityFee:0.00001,pool:'pump'});await authorizeTransaction(tx,treasury,[key,mint],20000000n);return await persistAndSend(treasury,'launch',tx,{mint:mint.publicKey.toBase58(),targetProject:p.id});
 }finally{await release()}}
async function reconcileUnlocked(p:any){const jobs=await all("SELECT * FROM jobs WHERE project=? AND status='submitted'",p.id),out=[];const connection=rpc();for(const j of jobs){const payload=JSON.parse(j.payload),tx=await connection.getTransaction(j.signature,{commitment:'confirmed',maxSupportedTransactionVersion:0});if(!tx){const status=(await connection.getSignatureStatuses([j.signature],{searchTransactionHistory:true})).value[0];if(status?.err){await run('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?','failed',JSON.stringify(status.err),now(),j.id);out.push({id:j.id,status:'failed'});continue;}const v=VersionedTransaction.deserialize(bytes(payload.serialized));const valid=await connection.isBlockhashValid(v.message.recentBlockhash);if(!valid.value&&!status){await run('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?','expired','Blockhash expired without a recorded signature.',now(),j.id);out.push({id:j.id,status:'expired'});}else out.push({id:j.id,status:'submitted'});continue;}
 if(tx.meta?.err){await run('UPDATE jobs SET status=?,error=?,updated=? WHERE id=?','failed',JSON.stringify(tx.meta.err),now(),j.id);out.push({id:j.id,status:'failed'});continue;}
 const keys=tx.transaction.message.getAccountKeys({accountKeysFromLookups:tx.meta?.loadedAddresses});let index=-1;for(let i=0;i<keys.length;i++)if(keys.get(i)?.toBase58()===p.treasury)index=i;if(index<0||!tx.meta)throw new HttpError(502,'Treasury account missing from transaction receipt.');const delta=BigInt(tx.meta.postBalances[index])-BigInt(tx.meta.preBalances[index]);if(j.kind==='claim')payload.received=(delta>0n?delta:0n).toString();if(j.kind==='buyback'){payload.spent=payload.amount;const pre=tx.meta.preTokenBalances?.filter(x=>x.owner===p.treasury&&x.mint===p.mint).reduce((s,x)=>s+BigInt(x.uiTokenAmount.amount),0n)||0n,post=tx.meta.postTokenBalances?.filter(x=>x.owner===p.treasury&&x.mint===p.mint).reduce((s,x)=>s+BigInt(x.uiTokenAmount.amount),0n)||0n;payload.outputAmount=(post-pre).toString();}
 if(j.kind==='forward'){
  const parent=await one('SELECT * FROM projects WHERE id=?',p.parent);
  if(!parent?.treasury||parent.treasury!==payload.destination)throw new HttpError(409,'Fee destination changed; review this receipt.');
  let destinationIndex=-1;for(let i=0;i<keys.length;i++)if(keys.get(i)?.toBase58()===parent.treasury)destinationIndex=i;
  const received=destinationIndex<0?0n:BigInt(tx.meta.postBalances[destinationIndex])-BigInt(tx.meta.preBalances[destinationIndex]);
  if(received!==BigInt(payload.amount))throw new HttpError(502,'Creator-fee transfer receipt does not match.');
  // Deterministic ID makes retry after a crash safe: a transfer is credited once.
  await run('INSERT OR IGNORE INTO jobs(id,project,kind,status,signature,payload,created,updated) VALUES(?,?,?,?,?,?,?,?)',j.id+':credit',parent.id,'revenue','confirmed',j.signature,JSON.stringify({received:received.toString(),sourceProject:p.id}),j.created,now());
 }
 await run('UPDATE jobs SET status=?,payload=?,error=NULL,updated=? WHERE id=?','confirmed',JSON.stringify(payload),now(),j.id);if(j.kind==='launch'){await run('UPDATE projects SET mint=?,status=?,updated=? WHERE id=?',payload.mint,'live',now(),payload.targetProject);const launched=await one('SELECT * FROM projects WHERE id=?',payload.targetProject);if(!launched.parent)await run('UPDATE policies SET enabled=1 WHERE project=?',launched.id);}out.push({id:j.id,status:'confirmed'});
 }return {transactions:out};}
export async function reconcile(p:any){const root=treasuryProject(p)!==p.id?await one('SELECT * FROM projects WHERE id=?',treasuryProject(p)):p;const release=await lock(root.id);try{return await reconcileUnlocked(root)}finally{await release()}}
export async function childRevenueCycle(p:any){
 live();if(!p.public_launch||!p.parent||!p.secret||!p.mint)throw new HttpError(409,'Public coin is not ready for fee collection.');
 const release=await lock(p.id);try{
  await reconcileUnlocked(p);await pending(p);
  const parent=await one('SELECT * FROM projects WHERE id=?',p.parent),policy=await one('SELECT * FROM policies WHERE project=?',p.parent);
  if(!parent?.mint||!parent.treasury||!policy?.enabled)return {status:'idle',message:'Main-token buybacks are not enabled.'};
  const totals=revenueTotals(await all("SELECT * FROM jobs WHERE project=? AND status='confirmed'",p.id),now()-86400000);
  const available=BigInt(await balance(p.treasury)),reserve=10000000n;
  const amount=forwardAmount(totals.revenue,totals.forwarded,available,reserve+100000n);
  const key=await signer(p);
  if(amount>=1000000n){
   const block=await rpc().getLatestBlockhash('confirmed');
   const tx=new VersionedTransaction(new TransactionMessage({payerKey:key.publicKey,recentBlockhash:block.blockhash,instructions:[SystemProgram.transfer({fromPubkey:key.publicKey,toPubkey:new PublicKey(parent.treasury),lamports:amount})]}).compileToV0Message());
   await authorizeTransaction(tx,p,[key],amount+100000n);
   return await persistAndSend(p,'forward',tx,{amount:amount.toString(),destination:parent.treasury});
  }
  const last=await one("SELECT created FROM jobs WHERE project=? AND kind='claim' ORDER BY created DESC LIMIT 1",p.id);
  if(available<reserve+1000000n||(last&&now()-last.created<3600000))return {status:'idle',message:'Waiting for fee collection or reserve funding.'};
  const tx=await localTx({publicKey:p.treasury,action:'collectCreatorFee',priorityFee:0.00001});
  await authorizeTransaction(tx,p,[key],1000000n);
  return await persistAndSend(p,'claim',tx,{});
 }finally{await release()}
}
export async function cycle(p:any){live();if(p.parent)throw new HttpError(400,'Run buybacks on the parent product.');const policy=await one('SELECT * FROM policies WHERE project=?',p.id);if(!policy?.enabled)throw new HttpError(409,'Enable the buyback policy first.');if(!p.secret||!p.mint)throw new HttpError(409,'Create the treasury and launch the main token first.');const release=await lock(p.id);try{
 await reconcileUnlocked(p);await pending(p);const history=await all("SELECT * FROM jobs WHERE project=? AND status='confirmed'",p.id);const {revenue,spent,today}=revenueTotals(history,now()-86400000);
 const eligible=revenue*BigInt(policy.percent)/100n-spent;const available=BigInt(await balance(p.treasury));const amount=allocation(eligible,available-5000000n,100,BigInt(policy.max_lamports),BigInt(policy.reserve_lamports),BigInt(policy.daily_lamports)-today);const key=await signer(p);
 if(amount>=1000000n){
  const endpoint=new URL('https://api.jup.ag/swap/v2/order');for(const [k,v] of Object.entries({inputMint:'So11111111111111111111111111111111111111112',outputMint:p.mint,amount:amount.toString(),taker:p.treasury,slippageBps:'100'}))endpoint.searchParams.set(k,v as string);
  let quote:any=null;
  try{const r=await fetch(endpoint,{headers:runtime().JUPITER_API_KEY?{'x-api-key':runtime().JUPITER_API_KEY}:{},signal:AbortSignal.timeout(20000)});if(r.ok)quote=await r.json();}catch{}
  let tx:VersionedTransaction;
  if(quote?.transaction){
   if(quote.inputMint!=='So11111111111111111111111111111111111111112'||quote.outputMint!==p.mint||BigInt(quote.inAmount||0)!==amount)throw new HttpError(502,'Swap quote does not match the authorized buyback.');
   tx=VersionedTransaction.deserialize(bytes(quote.transaction));
  }else{
   // Pump bonding-curve tokens may not yet have a Jupiter route.
   tx=await localTx({publicKey:p.treasury,action:'buy',mint:p.mint,denominatedInSol:'true',amount:Number(amount)/1e9,slippage:1,priorityFee:0.00001,pool:'auto'});
  }
  await authorizeTransaction(tx,p,[key],amount+5000000n);
  return await persistAndSend(p,'buyback',tx,{amount:amount.toString(),...(quote?.transaction&&quote.requestId?{requestId:quote.requestId}:{})});
 }

 // A minimum interval prevents empty fee claims repeatedly consuming SOL.
 const last=await one("SELECT created FROM jobs WHERE project=? AND kind='claim' ORDER BY created DESC LIMIT 1",p.id);if(last&&now()-last.created<3600000)return {status:'idle',message:'No available buyback allocation. Next fee claim after the hourly interval.'};if(available<BigInt(policy.reserve_lamports)+1000000n)return {status:'idle',message:'Treasury is below its fee reserve.'};const tx=await localTx({publicKey:p.treasury,action:'collectCreatorFee',priorityFee:0.00001});await authorizeTransaction(tx,p,[key],1000000n);return await persistAndSend(p,'claim',tx,{});
 }finally{await release()}}


