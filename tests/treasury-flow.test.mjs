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
test('child fees forward once, deposits stay put, parent buybacks respect cap, bad signers are rejected',async()=>{
 const db=openDatabase(':memory:').sqlite,root=randomUUID(),child=randomUUID(),sent=[];
 let receipt=null,badSigner=false;
 const env={ENABLE_MAINNET:'true',SOLANA_RPC_URL:'https://mock.invalid',TREASURY_MASTER_KEY:randomBytes(32).toString('base64')};
 const blockhash=solana.Keypair.generate().publicKey.toBase58();
 const row=id=>db.prepare('SELECT * FROM projects WHERE id=?').get(id);
 class Connection{
  async getBalance(){return 1000000000;}
  async getLatestBlockhash(){return {blockhash};}
  async simulateTransaction(){return {value:{err:null,accounts:[{lamports:995000000}]}};}
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
 for(const [id,parent,publicLaunch] of [[root,null,0],[child,root,1]])db.prepare('INSERT INTO projects(id,owner,name,symbol,kind,prompt,description,config,status,parent,public_launch,mint,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'test','Test','TEST','launchpad','test','test','{}','live',parent,publicLaunch,solana.Keypair.generate().publicKey.toBase58(),Date.now(),Date.now());
 db.prepare('INSERT INTO policies(project,enabled,max_lamports,daily_lamports) VALUES(?,1,?,?)').run(root,'5000000','20000000');
 await exports.setupTreasury(row(root));await exports.setupTreasury(row(child));
 db.prepare('INSERT INTO jobs(id,project,kind,status,payload,created,updated) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),child,'claim','confirmed',JSON.stringify({received:'20000000'}),Date.now(),Date.now());
 const forwarded=await exports.childRevenueCycle(row(child));assert.equal(forwarded.status,'submitted');assert.equal(sent.length,1);
 const instruction=solana.TransactionMessage.decompile(sent[0].message).instructions[0],transfer=solana.SystemInstruction.decodeTransfer(instruction);
 assert.equal(transfer.lamports,20000000n);assert.equal(transfer.toPubkey.toBase58(),row(root).treasury);assert.equal(transfer.fromPubkey.toBase58(),row(child).treasury);
 const keys=sent[0].message.staticAccountKeys,pre=keys.map(()=>1000000000),post=[...pre];post[keys.findIndex(k=>k.toBase58()===row(child).treasury)]-=20005000;post[keys.findIndex(k=>k.toBase58()===row(root).treasury)]+=20000000;
 receipt={transaction:{message:sent[0].message},meta:{err:null,preBalances:pre,postBalances:post}};
 await exports.reconcile(row(child));
 db.prepare("UPDATE jobs SET status='submitted' WHERE id=?").run(forwarded.job);await exports.reconcile(row(child));
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE project=? AND kind='revenue'").get(root).n,1);
 assert.equal((await exports.childRevenueCycle(row(child))).status,'idle');
 badSigner=true;await assert.rejects(exports.cycle(row(root)),/signer mismatch/);assert.equal(sent.length,1);
 badSigner=false;receipt=null;await exports.cycle(row(root));assert.equal(sent.length,2);
 const buy=db.prepare("SELECT payload FROM jobs WHERE project=? AND kind='buyback'").get(root);assert.equal(JSON.parse(buy.payload).amount,'5000000');
 db.close();
});
