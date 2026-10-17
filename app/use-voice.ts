'use client';
import {useEffect,useRef,useState} from 'react';
// The analyser stays on-device. Only the browser's speech recognition provides text.
export function useVoice(onText:(text:string)=>void,onError:(message:string)=>void){
 const [listening,setListening]=useState(false),[level,setLevel]=useState(0);
 const current=useRef<any>(null),callbacks=useRef({onText,onError});callbacks.current={onText,onError};
 function cleanup(s:any){if(!s)return;s.cancelled=true;if(current.current===s)current.current=null;cancelAnimationFrame(s.frame);s.stream?.getTracks().forEach((t:MediaStreamTrack)=>t.stop());s.stream=null;s.context?.close().catch(()=>{});s.context=null;if(s.recognition){s.recognition.onend=null;s.recognition.onerror=null;s.recognition.onresult=null;try{s.recognition.abort()}catch{}s.recognition=null}}
 function stop(){cleanup(current.current);setListening(false);setLevel(0)}
 useEffect(()=>{const hidden=()=>{if(document.hidden)stop()};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);cleanup(current.current)}},[]);
 async function toggle(){if(current.current){stop();return}const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 if(!SR){callbacks.current.onError('Voice input is unavailable in this browser. Try Chrome or Edge, or type your idea.');return}
 const s:any={cancelled:false,frame:0,speaking:false};current.current=s;setListening(true);
 const finish=()=>{if(current.current===s){cleanup(s);setListening(false);setLevel(0)}};
 try{
  // Create and resume within the click gesture for mobile audio policies.
  const AC=window.AudioContext||(window as any).webkitAudioContext;
  if(AC){try{s.context=new AC();await s.context.resume()}catch{}}
  if(s.cancelled)return;
  try{s.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}catch{throw new Error('Microphone access is needed to animate him while you speak. Allow it in your browser, or type your idea.')}
  if(s.cancelled){cleanup(s);return}
  let analyser:AnalyserNode|undefined;if(s.context){try{const node:AnalyserNode=s.context.createAnalyser();node.fftSize=512;s.context.createMediaStreamSource(s.stream).connect(node);analyser=node}catch{}}
  const samples=new Uint8Array(512);let smooth=0,last=0;
  const tick=(time:number)=>{if(s.cancelled)return;if(time-last>32){last=time;let target=s.speaking?.3:0;if(analyser&&s.context.state==='running'){analyser.getByteTimeDomainData(samples);let sum=0;for(const v of samples)sum+=((v-128)/128)**2;target=Math.min(1,Math.max(0,(Math.sqrt(sum/samples.length)-.008)*9))}smooth+=(target-smooth)*(target>smooth?.5:.18);setLevel(smooth)}s.frame=requestAnimationFrame(tick)};
  const r=new SR();s.recognition=r;r.lang='en-US';r.interimResults=true;r.continuous=true;
  r.onspeechstart=()=>{s.speaking=true};r.onspeechend=()=>{s.speaking=false};
  r.onresult=(e:any)=>{if(!s.cancelled)callbacks.current.onText(Array.from(e.results).map((x:any)=>x[0].transcript).join(' '))};
  r.onend=finish;r.onerror=(e:any)=>{if(s.cancelled)return;if(!['aborted','no-speech'].includes(e.error))callbacks.current.onError(e.error==='network'?'Speech recognition could not connect. Please try again or type your idea.':'Voice input stopped. Check microphone permissions or type your idea.');finish()};
  r.start();s.frame=requestAnimationFrame(tick);
 }catch(error:any){if(!s.cancelled)callbacks.current.onError(error.message||'Unable to start your microphone.');finish()}
 }
 return {listening,level,toggle};
}

