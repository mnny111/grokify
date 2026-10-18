'use client';
import {useEffect,useState} from 'react';
import {api} from './ui';
import {Robot} from './robot';

async function readImage(file:File):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10000000)throw new Error('Choose a PNG, JPEG or WebP under 10 MB.');
 const url=URL.createObjectURL(file);
 try {
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Unable to process image.');
  const scale=Math.max(256/image.width,256/image.height),w=image.width*scale,h=image.height*scale;
  ctx.drawImage(image,(256-w)/2,(256-h)/2,w,h);
  for(const quality of [.9,.75,.55,.35]){const result=canvas.toDataURL('image/webp',quality);if(result.length<64000&&result.startsWith('data:image/webp'))return result;}
  throw new Error('This image is too complex. Try a simpler image.');
 }finally{URL.revokeObjectURL(url)}
}
export default function TokenLaunch({pid,detail,status,reload}:{pid:string,detail:any,status:any,reload:()=>Promise<void>}){
 const p=detail.project;const minimum=p.public_launch?30000000n:20000000n;
 const [name,setName]=useState(p.token_name||p.name),[symbol,setSymbol]=useState(p.token_symbol||p.symbol),[image,setImage]=useState(p.token_image||'');
 const [working,setWorking]=useState(false),[error,setError]=useState(''),[funding,setFunding]=useState<any>(null),[note,setNote]=useState('');
 const [accepted,setAccepted]=useState(false),[sponsoring,setSponsoring]=useState(false);
 useEffect(()=>{if(!sponsoring)return;let stopped=false,inFlight=false;const timer=setInterval(async()=>{if(inFlight)return;inFlight=true;try{const result=await api('projects/'+pid+'/launch',{});if(!stopped&&result.status!=='funding'){setSponsoring(false);setNote('Launch submitted. Waiting for confirmation…');await reload()}}catch(e:any){if(!stopped){setSponsoring(false);setError(e.message)}}finally{inFlight=false}},8000);return()=>{stopped=true;clearInterval(timer)}},[sponsoring,pid]);
 const pending=detail.jobs.some((j:any)=>j.kind==='launch'&&j.status==='submitted');
 useEffect(()=>{if(!pending)return;let active=true;const timer=setInterval(async()=>{try{await api('projects/'+pid+'/reconcile',{});if(active)await reload()}catch{if(active)setNote('Confirmation is taking longer. Your transaction is saved; check Activity.')}},8000);return()=>{active=false;clearInterval(timer)}},[pid,pending]);
 async function deploy(){
  if(working)return;setWorking(true);setError('');setNote('Saving your token and preparing its wallet…');
  try{
   const prepared=await api('projects/'+pid+'/launch-details',{name,symbol,image,acceptFeeRouting:accepted});await reload();
   setFunding(prepared);
   if(!status.launch){setNote('Token details saved. Live launches are not enabled on this deployment yet.');return;}
   setNote('Submitting your token launch…');
   const result=await api('projects/'+pid+'/launch',{});setSponsoring(result.status==='funding');await reload();setNote(result.status==='funding'?'Grokify is funding your launch from the platform treasury…':'Launch submitted. Waiting for on-chain confirmation…');
  }catch(e:any){setError(e.message);setNote('')}finally{setWorking(false)}
 }
 if(!detail.builds.length&&!p.parent)return <div className="large-empty"><Robot small/><h2>Build first. Launch next.</h2><p>Once your product is built, Grokify will ask for its token image, name and ticker.</p></div>;
 if(p.mint)return <div className="launch-flow"><Robot small/><div className="eyebrow">BUILT & LAUNCHED</div><h2>Your product has a token.</h2><p>{p.token_name||p.name} · ${p.token_symbol||p.symbol}</p>{image&&<img className="launch-image" src={image} alt="Token artwork"/>}<a className="button black" href={'https://pump.fun/coin/'+p.mint} target="_blank" rel="noreferrer">View token ↗</a><p className="muted">Your website is published and the token is listed on Grokify’s launchpad.</p></div>;
 return <div className="launch-flow"><Robot small/><div className="eyebrow">YOUR PRODUCT IS BUILT</div><h2>Let’s give it a token.</h2><p className="muted">What image, name and ticker would you like? I’ll handle the wallet and deployment.</p>
 {p.public_launch?<p>Anyone signed in can launch. Grokify funds this coin’s separate wallet. Confirmed creator fees are forwarded to the parent launchpad’s treasury for its main-token buyback policy; your launch deposit is not counted as revenue.</p>:<p>After confirmation, automatic buybacks use this project’s saved policy and only confirmed creator-fee revenue.</p>}
 <form onSubmit={e=>{e.preventDefault();void deploy()}}>
 <label className="launch-upload">{image?<img className="launch-image" src={image} alt="Your token preview"/>:<span className="launch-image launch-placeholder">+</span>}<span>Token image<small>PNG, JPEG or WebP · cropped to a square</small></span><input aria-label="Token image" type="file" accept="image/png,image/jpeg,image/webp" disabled={working||pending||sponsoring} onChange={async e=>{const file=e.target.files?.[0];if(file){setError('');setWorking(true);try{setImage(await readImage(file))}catch(err:any){setError(err.message)}finally{setWorking(false)}}}}/></label>
 <div className="form-grid"><label>Token name<input required minLength={2} maxLength={32} value={name} disabled={working||pending||sponsoring} onChange={e=>setName(e.target.value)}/></label><label>Ticker<input required minLength={2} maxLength={10} pattern="[A-Z0-9]+" value={symbol} disabled={working||pending||sponsoring} onChange={e=>setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/></label></div>
 <p className="tiny muted">Grokify covers creation and network costs from its treasury, subject to available sponsorship. No deposit or initial token purchase is required. The confirmed token identity cannot be changed.</p>
 {p.public_launch&&<label><input type="checkbox" checked={accepted} disabled={working||pending||sponsoring} onChange={e=>setAccepted(e.target.checked)}/> I agree that creator fees from this coin fund its parent launchpad’s main-token policy.</label>}
 {note&&<p role="status">{note}</p>}{error&&<p role="alert">{error}</p>}
 <button className="button black" type="submit" disabled={working||pending||sponsoring||!image||(p.public_launch&&!accepted)}>{pending?'Confirming launch…':sponsoring?'Funding from treasury…':working?'Preparing…':'Launch token — covered by Grokify ↗'}</button>
 </form></div>;
}
