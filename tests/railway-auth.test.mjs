import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import bs58 from 'bs58';
import {openDatabase} from '../railway/database.mjs';
import {issueChallenge,verifyChallenge,session,signOut,sessionCookie} from '../railway/auth.mjs';

test('persistent migrations, atomic batch, wallet signatures and session isolation',async()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'grokify-test-'));
 let db=openDatabase(path.join(folder,'test.sqlite'));
 try{
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM grokify_migrations').get().n,2);
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const wallet=bs58.encode(publicKey.export({type:'spki',format:'der'}).subarray(-32));
  const origin='https://grokify.fun';
  const c=issueChallenge(db,wallet,origin),signature=sign(null,Buffer.from(c.message),privateKey).toString('base64');
  const s=verifyChallenge(db,c.nonce,signature,origin);
  assert.equal(session(db,s.token,origin).wallet,wallet);
  assert.equal(session(db,s.token,'https://coin.grokify.fun'),null);
  assert.throws(()=>verifyChallenge(db,c.nonce,signature,origin));
  const wrong=issueChallenge(db,wallet,origin);
  assert.throws(()=>verifyChallenge(db,wrong.nonce,signature,origin));
  const expired=issueChallenge(db,wallet,origin);db.sqlite.exec('UPDATE auth_challenges SET expires=0');
  assert.throws(()=>verifyChallenge(db,expired.nonce,signature,origin));
  await assert.rejects(db.batch([db.prepare('INSERT INTO locks VALUES (?,?,?)').bind('test','token',1),db.prepare('INSERT INTO locks VALUES (?,?,?)').bind('test','token',2)]));
  assert.equal(await db.prepare('SELECT * FROM locks WHERE project=?').bind('test').first(),null);
  db.sqlite.close();db=openDatabase(path.join(folder,'test.sqlite'));
  assert.equal(session(db,s.token,origin).wallet,wallet,'sessions survive restart');
  signOut(db,s.token);assert.equal(session(db,s.token,origin),null);
  assert.match(sessionCookie('example',true),/__Host-grokify=example; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure/);
 }finally{db.sqlite.close();rmSync(folder,{recursive:true,force:true})}
});
