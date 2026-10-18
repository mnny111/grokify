// Deposits never enter this ledger. Only confirmed fee claims and verified
// transfers from child fee wallets are eligible for buybacks.
export function revenueTotals(jobs:any[],since:number){
 let revenue=0n,spent=0n,today=0n,forwarded=0n;
 for(const job of jobs){
  if(job.status!=='confirmed')continue;
  const data=typeof job.payload==='string'?JSON.parse(job.payload):job.payload;
  if(job.kind==='claim'||job.kind==='revenue')revenue+=BigInt(data.received||0);
  if(job.kind==='forward')forwarded+=BigInt(data.amount||0);
  if(job.kind==='buyback'){spent+=BigInt(data.spent||0);if(job.created>since)today+=BigInt(data.spent||0);}
 }
 return {revenue,spent,today,forwarded};
}
export function forwardAmount(revenue:bigint,forwarded:bigint,balance:bigint,reserve:bigint){
 const eligible=revenue-forwarded,available=balance-reserve;
 return eligible>0n&&available>0n?(eligible<available?eligible:available):0n;
}
export function treasuryProject(p:{id:string,parent?:string|null,public_launch?:number}){return p.parent&&!p.public_launch?p.parent:p.id;}
