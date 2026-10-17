'use client';
import {useEffect,useRef,useState} from 'react';
// Speech events drive the mascot; browser synthesis does not expose audio samples.
export function useSpeech(onError:(message:string)=>void){
 const [speaking,setSpeaking]=useState(false),[level,setLevel]=useState(0);
 const current=useRef<any>(null),error=useRef(onError);error.current=onError;
 function clear(){const s=current.current;current.current=null;if(s){clearTimeout(s.timeout);cancelAnimationFrame(s.frame);s.utterance.onstart=s.utterance.onend=s.utterance.onerror=s.utterance.onboundary=s.utterance.onpause=s.utterance.onresume=null;window.speechSynthesis?.cancel()}}
 function stop(){clear();setSpeaking(false);setLevel(0)}
 function speak(text:string){stop();if(!('speechSynthesis' in window)){error.current('Spoken replies are unavailable in this browser. You can still read every reply.');return}if(document.hidden||!text.trim())return;
  const u=new SpeechSynthesisUtterance(text.replace(/[*#`]/g,'').slice(0,6000));u.lang='en-US';u.rate=1;
  const voices=window.speechSynthesis.getVoices();u.voice=voices.find(v=>v.lang==='en-US'&&v.localService)||voices.find(v=>v.lang.startsWith('en'))||null;
  const s:any={utterance:u,frame:0,timeout:0,pulse:0,paused:false};current.current=s;
  const active=()=>current.current===s;
  const tick=(time:number)=>{if(!active())return;if(!s.paused)setLevel(.16+.18*(1+Math.sin(time/115))+s.pulse);s.pulse*=.88;s.frame=requestAnimationFrame(tick)};
  u.onstart=()=>{if(active()){clearTimeout(s.timeout);setSpeaking(true);s.frame=requestAnimationFrame(tick)}};
  u.onboundary=()=>{if(active())s.pulse=.35};u.onpause=()=>{s.paused=true;setLevel(0);setSpeaking(false)};u.onresume=()=>{s.paused=false;setSpeaking(true)};
  u.onend=()=>{if(active())stop()};u.onerror=(e)=>{if(active()){stop();if(!['canceled','interrupted'].includes(e.error))error.current('Audio could not play. Press Read reply to try again.')}};
  s.timeout=setTimeout(()=>{if(active()){stop();error.current('Press Read reply to enable audio in this browser.')}},10000);
  try{window.speechSynthesis.speak(u)}catch{stop();error.current('Audio could not play. Press Read reply to try again.')}
 }
 useEffect(()=>{const hide=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hide);return()=>{document.removeEventListener('visibilitychange',hide);clear()}},[]);
 return {speaking,level,speak,stop};
}
