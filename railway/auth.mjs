import {randomBytes,createHash,createPublicKey,verify} from 'node:crypto';
import bs58 from 'bs58';
const hash=value=>createHash('sha256').update(value).digest('hex');
const lifetime=7*24*60*60*1000;
export const cookieName=secure=>secure?'__Host-grokify':'grokify-local';
export function cookie(req,name){return (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';}
export function walletAddress(value){try {return typeof value==='string'&&bs58.decode(value).length===32}catch{return false}}
export function issueChallenge(db,wallet,origin) {
  if(!walletAddress(wallet))throw new Error('Choose a valid Solana wallet.');
  const nonce=randomBytes(32).toString('base64url'),expires=Date.now()+5*60*1000;
  const message=`${new URL(origin).host} wants you to sign in to Grokify with your Solana wallet:\n${wallet}\n\nSign in only. This does not authorize transactions or access to funds.\n\nURI: ${origin}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`;
  db.sqlite.prepare('DELETE FROM auth_challenges WHERE expires<?').run(Date.now());
  db.sqlite.prepare('INSERT INTO auth_challenges VALUES (?,?,?,?,?)').run(hash(nonce),wallet,origin,message,expires);
  return {nonce,message};
}
export function verifyChallenge(db,nonce,signature,origin) {
  if(typeof nonce!=='string'||nonce.length>100||typeof signature!=='string'||signature.length>150)throw new Error('Invalid sign-in request.');
  // DELETE RETURNING consumes the challenge atomically, including failed attempts.
  const c=db.sqlite.prepare('DELETE FROM auth_challenges WHERE hash=? RETURNING *').get(hash(nonce));
  if(!c||c.origin!==origin||c.expires<Date.now())throw new Error('Sign-in expired. Please try again.');
  const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(bs58.decode(c.wallet))]),format:'der',type:'spki'});
  const bytes=Buffer.from(signature,'base64');
  if(bytes.length!==64||!verify(null,Buffer.from(c.message),publicKey,bytes))throw new Error('Wallet signature could not be verified.');
  const token=randomBytes(32).toString('base64url');
  db.sqlite.prepare('DELETE FROM auth_sessions WHERE expires<?').run(Date.now());
  db.sqlite.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(hash(token),c.wallet,origin,Date.now()+lifetime);
  return {token,wallet:c.wallet};
}
export function session(db,token,origin) {
  if(!token||token.length>100)return null;
  return db.sqlite.prepare('SELECT wallet FROM auth_sessions WHERE hash=? AND origin=? AND expires>?').get(hash(token),origin,Date.now())||null;
}
export function signOut(db,token){if(token)db.sqlite.prepare('DELETE FROM auth_sessions WHERE hash=?').run(hash(token));}
export function sessionCookie(token,secure,maxAge=lifetime/1000){return `${cookieName(secure)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export function limit(db,key){
  const time=Date.now();db.sqlite.prepare('DELETE FROM auth_limits WHERE expires<?').run(time);
  const r=db.sqlite.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(hash(key),time+60000);
  return r.count<=30;
}
