import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenMarkets} from '../lib/token-market.ts';
test('market data matches Solana base mint, keeps missing values unknown and caches',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json([{chainId:'ethereum',baseToken:{address:'testmint'},liquidity:{usd:999999},marketCap:123},{chainId:'solana',baseToken:{address:'other'},marketCap:777},{chainId:'solana',baseToken:{address:'testmint'},quoteToken:{symbol:'SOL'},liquidity:{usd:50},volume:{h24:0},priceChange:{h24:-3.5},pairCreatedAt:1234}]);};
 try{const [m,missing]=await tokenMarkets(['testmint','missing']);assert.equal(m.volume24h,0);assert.equal(m.marketCap,null);assert.equal(m.change24h,-3.5);assert.equal(missing,null);await tokenMarkets(['testmint']);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
