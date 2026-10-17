const status=document.getElementById('status');
const buttons=[document.getElementById('phantom'),document.getElementById('solflare')];
async function request(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const b=await r.json();if(!r.ok)throw new Error(b.error||'Sign-in failed');return b}
function returnPath(){const value=new URLSearchParams(location.search).get('return_to')||'/explore';try{const url=new URL(value,location.origin);return url.origin===location.origin&&!/^\/(auth|signin|signout|callback)/.test(url.pathname)?url.pathname+url.search:'/explore'}catch{return '/explore'}}
async function signIn(name){
  buttons.forEach(b=>b.disabled=true);status.textContent='Open your wallet to connect.';
  try{
    const provider=name==='phantom'?(window.phantom?.solana||(window.solana?.isPhantom?window.solana:null)):window.solflare;
    if(!provider?.signMessage)throw new Error(`Open this page in the ${name==='phantom'?'Phantom':'Solflare'} wallet browser, or enable its browser extension.`);
    await provider.connect();const wallet=provider.publicKey.toString();
    const c=await request('/auth/challenge',{wallet});status.textContent='Approve the sign-in message in your wallet.';
    const signed=await provider.signMessage(new TextEncoder().encode(c.message),'utf8');
    const bytes=signed.signature||signed;
    await request('/auth/verify',{nonce:c.nonce,signature:btoa(String.fromCharCode(...bytes))});
    location.assign(returnPath());
  }catch(e){status.textContent=e.message||'Sign-in was cancelled.';buttons.forEach(b=>b.disabled=false)}
}
buttons[0].onclick=()=>signIn('phantom');buttons[1].onclick=()=>signIn('solflare');
document.getElementById('logout').onclick=async()=>{try{await request('/auth/logout',{});location.reload()}catch(e){status.textContent=e.message}};
request('/auth/session').then(s=>{if(s.wallet){status.textContent='Signed in as '+s.wallet.slice(0,6)+'…'+s.wallet.slice(-6);document.getElementById('logout').hidden=false}}).catch(()=>{});
