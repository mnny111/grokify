import {siteAddress,siteSlug} from './site-address';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
export const runtime=()=>env as unknown as Record<string,any>;
export const db=()=>runtime().DB as D1Database;
export async function all(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[];}
export async function one(sql:string,...args:any[]){return await db().prepare(sql).bind(...args).first() as any;}
export async function run(sql:string,...args:any[]){return await db().prepare(sql).bind(...args).run();}
export const id=()=>crypto.randomUUID();
export const now=()=>Date.now();
export async function user(){const u=await getChatGPTUser();if(!u)throw new HttpError(401,'Sign in to save and build your product.');return u.userId;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export async function owned(project:string){const u=await user();const p=await one('SELECT * FROM projects WHERE id=? AND owner=?',project,u);if(!p)throw new HttpError(404,'Project not found.');return p;}
export function publicProject(p:any){if(!p)return p;const {secret,owner,...rest}=p;return {...rest,config:JSON.parse(p.config),siteUrl:siteAddress(p,runtime().PRODUCT_BASE_DOMAIN||'grokify.fun',runtime().PRODUCT_SUBDOMAINS_ENABLED==='true'),plannedHostname:siteSlug(p)+'.'+(runtime().PRODUCT_BASE_DOMAIN||'grokify.fun'),subdomainActive:runtime().PRODUCT_SUBDOMAINS_ENABLED==='true'};}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>80000)throw new HttpError(413,'Request is too large.');const text=await req.text();if(text.length>80000)throw new HttpError(413,'Request is too large.');try{return JSON.parse(text)}catch{throw new HttpError(400,'Invalid JSON.')}}
export function requestOrigin(req:Request){return runtime().GROKIFY_NATIVE==='true'?`${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`:new URL(req.url).origin;}
export function originCheck(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==requestOrigin(req))throw new HttpError(403,'Cross-origin writes are not allowed.');}
export async function grok(messages:any[],json=false,maxTokens=2500){const e=runtime();if(!e.XAI_API_KEY)throw new HttpError(503,'Grok is not connected yet. Add XAI_API_KEY to enable AI conversations and custom builds.');const r=await fetch('https://api.x.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${e.XAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:e.XAI_MODEL||'grok-4.7',messages,max_tokens:maxTokens,...(json?{response_format:{type:'json_object'}}:{})}),signal:AbortSignal.timeout(90000)});if(!r.ok)throw new HttpError(502,`Grok provider returned ${r.status}. Check the model and API account.`);const data:any=await r.json();return data.choices?.[0]?.message?.content||'';}
export async function rateLimit(u:string,type:string,limit=20){const result=await run('INSERT INTO records (id,project,owner,type,data,created) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM records WHERE owner=? AND type=? AND created>?)<?',id(),'system',u,'rate:'+type,'{}',now(),u,'rate:'+type,now()-3600000,limit);if(!result.meta.changes)throw new HttpError(429,'Hourly limit reached. Please try again later.');}
export async function lock(project:string){const token=id();await run('INSERT INTO locks(project,token,expires) VALUES (?,?,?) ON CONFLICT(project) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE locks.expires<?',project,token,now()+180000,now());const l=await one('SELECT * FROM locks WHERE project=?',project);if(l.token!==token)throw new HttpError(409,'An operation is already running.');return ()=>run('DELETE FROM locks WHERE project=? AND token=?',project,token);}

