import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {parse} from 'node:url';
import next from 'next';
import {database} from './database.mjs';
import {cookie,cookieName,issueChallenge,verifyChallenge,session,sessionCookie,signOut,limit} from './auth.mjs';

const port=Number(process.env.PORT||8787),domain=process.env.PRODUCT_BASE_DOMAIN||'grokify.fun';
const local=process.env.GROKIFY_LOCAL_TEST==='true';
const db=database();
const app=next({dev:false,hostname:'0.0.0.0',port});
await app.prepare();
const handler=app.getRequestHandler();
const reserved=new Set(['www','api','app','admin','mail','launchpad','explore','build','docs','sites','products','assets','static','auth','support']);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
const redirect=(res,to)=>{res.writeHead(303,{Location:to,'Cache-Control':'no-store'});res.end()};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)throw new Error('Request too large.')}return JSON.parse(text)}
const server=createServer(async(req,res)=>{
  try {
    // Health checks contain no application data or identity.
    if(req.url==='/healthz'){db.sqlite.prepare('SELECT 1').get();return json(res,200,{ok:true,storage:'persistent-sqlite',auth:'solana-wallet'})}
    const host=String(req.headers.host||'').toLowerCase();
    const hostname=host.split(':')[0];
    if(!(hostname===domain||hostname.endsWith('.'+domain)||hostname===process.env.RAILWAY_PUBLIC_DOMAIN||(local&&['localhost','127.0.0.1'].includes(hostname))))return json(res,421,{error:'Unknown host'});
    const origin=`${local?'http':'https'}://${host}`;
    const url=new URL(req.url,origin);
    // Every identity header from the network is untrusted, including Railway hosts.
    for(const key of Object.keys(req.headers))if(key.startsWith('oai-authenticated-'))delete req.headers[key];
    // Next uses this for same-origin request URLs behind Railway's TLS proxy.
    req.headers['x-forwarded-proto']=local?'http':'https';
    req.headers['x-forwarded-host']=host;
    const token=cookie(req,cookieName(!local));
    const identity=session(db,token,origin);
    if(identity){req.headers['oai-authenticated-user-id']='wallet:'+identity.wallet;req.headers['oai-authenticated-user-email']=identity.wallet;}
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==origin&&!(url.pathname==='/api/runner'&&!req.headers.origin))return json(res,403,{error:'Same-origin request required'});
    if(url.pathname==='/signin-with-chatgpt')return redirect(res,'/signin'+url.search);
    if(url.pathname==='/signin'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",'Referrer-Policy':'no-referrer'});
      return res.end(readFileSync(new URL('./signin.html',import.meta.url)));
    }
    if(url.pathname==='/auth/wallet.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-cache'});return res.end(readFileSync(new URL('./wallet.js',import.meta.url)))}
    if(url.pathname==='/auth/session')return json(res,200,{wallet:identity?.wallet||null});
    if(url.pathname==='/auth/logout'&&req.method==='POST'){signOut(db,token);res.setHeader('Set-Cookie',sessionCookie('',!local,0));return json(res,200,{ok:true})}
    if(url.pathname==='/auth/challenge'||url.pathname==='/auth/verify'){
      if(req.method!=='POST')return json(res,405,{error:'POST required'});
      // Railway supplies the client IP; the per-browser challenge cookie is also required.
      const ip=String(req.headers['x-real-ip']||req.socket.remoteAddress||'unknown');
      if(!limit(db,ip))return json(res,429,{error:'Too many sign-in attempts. Wait a minute.'});
      try {
        const b=await body(req);
        if(url.pathname==='/auth/challenge'){
          const challenge=issueChallenge(db,b.wallet,origin);
          res.setHeader('Set-Cookie',`${local?'grokify-challenge':'__Host-grokify-challenge'}=${challenge.nonce}; Path=/; HttpOnly; SameSite=Strict; Max-Age=300${local?'':'; Secure'}`);
          return json(res,200,challenge);
        }
        if(!b.nonce||cookie(req,local?'grokify-challenge':'__Host-grokify-challenge')!==b.nonce)return json(res,401,{error:'Start sign-in again in this browser.'});
        const result=verifyChallenge(db,b.nonce,b.signature,origin);
        res.setHeader('Set-Cookie',[sessionCookie(result.token,!local),`${local?'grokify-challenge':'__Host-grokify-challenge'}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${local?'':'; Secure'}`]);
        return json(res,200,{wallet:result.wallet});
      } catch(e){return json(res,400,{error:e.message||'Sign-in failed'})}
    }
    if(url.pathname.startsWith('/auth/'))return json(res,404,{error:'Not found'});
    const slug=hostname.endsWith('.'+domain)?hostname.slice(0,-domain.length-1):null;
    if(slug&&(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)||reserved.has(slug)))return json(res,404,{error:'Unknown coin site'});
    if(slug&&url.pathname==='/') {req.url='/sites/'+slug+url.search;}
    await handler(req,res,parse(req.url,true));
  } catch(e){console.error('Request failed:',e.message);if(!res.headersSent)json(res,500,{error:'Unable to complete the request'});else res.end();}
});
server.listen(port,'0.0.0.0',()=>console.log(`Grokify Railway server listening on ${port}; persistent storage ready`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.sqlite.close();process.exit(0)}));
