import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID,randomBytes,webcrypto} from 'node:crypto';
import * as solana from '@solana/web3.js';
import bs58 from 'bs58';
import {openDatabase} from '../railway/database.mjs';
import * as accounting from '../lib/revenue-accounting.ts';
import {allocation} from '../lib/domain.ts';
const source=ts.transpileModule(fs.readFileSync('lib/treasury.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('sponsorship is bounded, idempotent and excluded from buyback revenue',async()=>{
 const db=openDatabase(':memory:').sqlite,root=randomUUID(),child=randomUUID(),sent=[];
 let receipt=null,badSigner=false;
 const env={ENABLE_MAINNET:'true',SOLANA_RPC_URL:'https://mock.invalid',LAUNCH_SPONSOR_PROJECT_ID:root,TREASURY_MASTER_KEY:randomBytes(32).toString('base64')};
 const blockhash=solana.Keypair.generate().publicKey.toBase58();
 const row=id=>db.prepare('SELECT * FROM projects WHERE id=?').get(id);
 class Connection{
  async getBalance(address){return address.toBase58()===row(root)?.treasury?1000000000:0;}
  async getLatestBlockhash(){return {blockhash};}
  async simulateTransaction(){return {value:{err:null,accounts:[{lamports:969995000}]}};}
  async sendRawTransaction(bytes){sent.push(solana.VersionedTransaction.deserialize(bytes));return 'mock';}
  async getTransaction(){return receipt;}
  async getSignatureStatuses(){return {value:[null]};}
  async isBlockhashValid(){return {value:true};}
 }
 class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
 const server={runtime:()=>env,id:randomUUID,now:Date.now,HttpError,lock:async()=>async()=>{},all:async(sql,...args)=>db.prepare(sql).all(...args),one:async(sql,...args)=>db.prepare(sql).get(...args),run:async(sql,...args)=>({meta:db.prepare(sql).run(...args)})};
 const exports={};
 vm.runInNewContext(source,{exports,Buffer,TextEncoder,Uint8Array,URL,Blob,FormData,AbortSignal,crypto:webcrypto,require:name=>({'./server':server,'./domain':{allocation},'./revenue-accounting':accounting,'./site-address':{},'./token-identity':{},'@solana/web3.js':{...solana,Connection},'bs58':{default:bs58}}[name]),fetch:async url=>{
  const request=new URL(url),payer=new solana.PublicKey(badSigner?solana.Keypair.generate().publicKey:row(root).treasury);
  const message=new solana.TransactionMessage({payerKey:payer,recentBlockhash:blockhash,instructions:[solana.SystemProgram.transfer({fromPubkey:payer,toPubkey:solana.Keypair.generate().publicKey,lamports:Number(request.searchParams.get('amount'))})]}).compileToV0Message();
  return {ok:true,json:async()=>({inputMint:request.searchParams.get('inputMint'),outputMint:request.searchParams.get('outputMint'),inAmount:request.searchParams.get('amount'),transaction:Buffer.from(new solana.VersionedTransaction(message).serialize()).toString('base64')})};
 }});

 for(const id of [root,child])db.prepare('INSERT INTO projects(id,owner,name,symbol,kind,prompt,description,config,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,'test','Test','TEST','tool','test','test','{}','built',Date.now(),Date.now());
 db.prepare('INSERT INTO builds(id,project,version,spec,created) VALUES(?,?,?,?,?)').run(randomUUID(),child,1,'{}',Date.now());
 await exports.setupTreasury(row(root));await exports.setupTreasury(row(child));db.prepare('UPDATE projects SET token_image=? WHERE id=?').run('test-image',child);
 const first=await exports.sponsorLaunch(row(child));assert.equal(first.status,'funding');assert.equal(sent.length,1);
 const transfer=solana.SystemInstruction.decodeTransfer(solana.TransactionMessage.decompile(sent[0].message).instructions[0]);assert.equal(transfer.lamports,30000000n);assert.equal(transfer.toPubkey.toBase58(),row(child).treasury);
 assert.equal((await exports.sponsorLaunch(row(child))).status,'funding');assert.equal(sent.length,1);
 const keys=sent[0].message.staticAccountKeys,pre=keys.map(()=>1000000000),post=[...pre];post[keys.findIndex(k=>k.toBase58()===row(root).treasury)]-=30005000;post[keys.findIndex(k=>k.toBase58()===row(child).treasury)]+=30000000;
 receipt={transaction:{message:sent[0].message},meta:{err:null,preBalances:pre,postBalances:post}};
 await exports.reconcile(row(root));assert.equal(db.prepare('SELECT status FROM jobs WHERE id=?').get(first.job).status,'confirmed');
 await assert.rejects(()=>exports.sponsorLaunch(row(child)),/already received/);assert.equal(sent.length,1);
 const jobs=db.prepare('SELECT * FROM jobs').all();assert.equal(accounting.revenueTotals(jobs,0).revenue,0n);
 db.close();
});
