// Administrative funding preparation only: never signs or broadcasts a transaction.
import {randomBytes,createCipheriv} from 'node:crypto';
import {Keypair,Connection,PublicKey} from '@solana/web3.js';
import {database} from '../railway/database.mjs';
const projectId=process.argv[2];
if(!/^[0-9a-f-]{36}$/.test(projectId||''))throw new Error('Pass an exact project ID.');
const db=database().sqlite;
let p=db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
if(!p||p.parent||!db.prepare('SELECT id FROM builds WHERE project=? LIMIT 1').get(projectId))throw new Error('Choose a built root project.');
if(!p.treasury){
 const master=Buffer.from(process.env.TREASURY_MASTER_KEY||'','base64');
 if(master.length!==32)throw new Error('Treasury master key is not configured correctly.');
 const key=Keypair.generate(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);
 cipher.setAAD(Buffer.from(projectId));
 const ciphertext=Buffer.concat([cipher.update(key.secretKey),cipher.final(),cipher.getAuthTag()]);
 db.prepare('UPDATE projects SET treasury=?,secret=?,updated=? WHERE id=? AND treasury IS NULL').run(key.publicKey.toBase58(),iv.toString('base64')+'.'+ciphertext.toString('base64'),Date.now(),projectId);
 p=db.prepare('SELECT * FROM projects WHERE id=?').get(projectId);
}
// Test-stage budgets: 80% of confirmed revenue, 0.005 SOL/trade, 0.02/day.
db.prepare('UPDATE policies SET percent=80,max_lamports=?,daily_lamports=?,reserve_lamports=?,revision=revision+1 WHERE project=?').run('5000000','20000000','20000000',projectId);
const balance=await new Connection(process.env.SOLANA_RPC_URL,'confirmed').getBalance(new PublicKey(p.treasury)).catch(()=>null);
console.log(JSON.stringify({project:p.id,name:p.name,address:p.treasury,balanceSol:balance===null?null:balance/1e9,suggestedFundingSol:0.05,transactionsSent:0}));
