// Public market data only; a missing or unindexed market must remain unknown.
const cache=new Map<string,{expires:number,value:any}>();
const pending=new Map<string,Promise<any[]>>();
export async function tokenMarkets(mints:string[]):Promise<any[]>{
 const missing=mints.filter(m=>!cache.has(m)||cache.get(m)!.expires<Date.now());
 if(missing.length){
  const key=[...missing].sort().join(',');
  let request=pending.get(key);
  if(!request){request=(async()=>{
   let pairs:any[]=[];
   try{const r=await fetch('https://api.dexscreener.com/tokens/v1/solana/'+key,{signal:AbortSignal.timeout(3500)});if(r.ok){const body=await r.json();if(Array.isArray(body))pairs=body;}}catch{}
   for(const mint of missing){
    const p=pairs.filter(p=>p.chainId==='solana'&&p.baseToken?.address===mint).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
    const number=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:null;
    const value=p?{pair:p.quoteToken?.symbol||null,volume24h:number(p.volume?.h24),marketCap:number(p.marketCap),change24h:number(p.priceChange?.h24),pairCreatedAt:number(p.pairCreatedAt)}:null;
    cache.set(mint,{expires:Date.now()+60000,value});
   }
   if(cache.size>1000)for(const [mint,entry] of cache)if(entry.expires<Date.now())cache.delete(mint);
   return [];
  })().finally(()=>pending.delete(key));pending.set(key,request);}
  await request;
 }
 return mints.map(m=>cache.get(m)?.value||null);
}
