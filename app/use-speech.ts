'use client';
import {useEffect,useRef,useState} from 'react';
// Castor audio stays on the server; the mascot follows its measured waveform.
export function useSpeech(onError:(message:string)=>void,onComplete?:()=>void){
 const [speaking,setSpeaking]=useState(false),[level,setLevel]=useState(0);
 const complete=useRef(onComplete);complete.current=onComplete;
 const current=useRef<any>(null),error=useRef(onError);error.current=onError;
 function clear(){const s=current.current;current.current=null;if(!s)return;s.controller.abort();clearTimeout(s.timeout);cancelAnimationFrame(s.frame);s.audio.onplaying=s.audio.onended=s.audio.onerror=s.audio.onpause=null;s.audio.pause();s.audio.removeAttribute('src');s.audio.load();if(s.url)URL.revokeObjectURL(s.url);if(s.context)void s.context.close().catch(()=>{});}
 function stop(){clear();setSpeaking(false);setLevel(0)}
 async function speak(text:string){
  stop();if(document.hidden||!text.trim())return;
  const s:any={controller:new AbortController(),audio:new Audio(),frame:0,timeout:0,url:null,context:null,analyser:null};current.current=s;
  const active=()=>current.current===s;
  try {
   // Resume while the Read reply click still carries a browser user gesture.
   const Context=window.AudioContext||(window as any).webkitAudioContext;
   if(Context){try{s.context=new Context();void s.context.resume().catch(()=>{});const source=s.context.createMediaElementSource(s.audio);s.analyser=s.context.createAnalyser();s.analyser.fftSize=256;source.connect(s.analyser);s.analyser.connect(s.context.destination)}catch{if(s.context)void s.context.close().catch(()=>{});s.context=null;s.analyser=null;}}
   const samples=new Uint8Array(256);
   const tick=()=>{if(!active())return;if(s.analyser){s.analyser.getByteTimeDomainData(samples);let sum=0;for(const value of samples)sum+=((value-128)/128)**2;setLevel(Math.min(1,Math.sqrt(sum/samples.length)*5));}s.frame=requestAnimationFrame(tick)};
   s.audio.onplaying=()=>{if(active()){clearTimeout(s.timeout);setSpeaking(true);cancelAnimationFrame(s.frame);tick()}};
   s.audio.onpause=()=>{if(active()){cancelAnimationFrame(s.frame);setSpeaking(false);setLevel(0)}};
   s.audio.onended=()=>{if(active()){stop();complete.current?.()}};
   s.audio.onerror=()=>{if(active()){stop();error.current('Audio could not play. Press Read reply to try again.')}};
   s.timeout=setTimeout(()=>{if(active()){stop();error.current('Castor took too long to respond. Press Read reply to retry.')}},65000);
   const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.replace(/[*#`]/g,'').slice(0,6000)}),signal:s.controller.signal});
   if(!response.ok){const data:any=await response.json().catch(()=>({}));throw new Error(data.error||'Castor voice is temporarily unavailable.');}
   const blob=await response.blob();if(!active())return;if(!blob.size)throw new Error('Castor returned empty audio. Please retry.');
   s.url=URL.createObjectURL(blob);s.audio.src=s.url;
   await s.audio.play();
  }catch(e:any){if(active()){stop();error.current(e.name==='NotAllowedError'?'Press Read reply to enable audio in this browser.':e.message||'Castor voice could not play. Please retry.')}}
 }
 useEffect(()=>{const hide=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);clear()}},[]);
 return {speaking,level,speak,stop};
}

