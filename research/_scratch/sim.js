// Reimplementation of AI 2027 simple time-horizon-extension (Apr 2025) at median params, + takeoff at medians
function run({T=4.5,decay=0.1,hsc=120,cs=4,p=0.095,s=7.75,mode='super',patched=true,delay=1.2}={}){
  const h0=15/(60*167); const n=Math.log2(hsc/h0);
  let g; if(mode==='super') g=T*(1-Math.pow(1-decay,n))/decay; else if(mode==='exp') g=n*T; else g=T*(Math.pow(1.1,n)-1)/0.1;
  const base=g+cs; let prog=0, t=2025.25-delay/12;
  while(prog<base && t<2050){ const f=prog/base;
    let v= patched? 1+p*Math.pow(s/p,f) : (1+p)*Math.pow((1+s)/(1+p),f);
    if(t>=2029) v=Math.sqrt(0.5*v*(v-0.5));
    const c= t>=2029?0.5:1; prog+= (1/30.5)*(v+c)/2; t+=1/365; }
  return {n:n.toFixed(2), base:base.toFixed(1), sc:t.toFixed(2)};
}
for (const m of ['super','exp','sub']) for (const pt of [false,true]) console.log(m,'patched='+pt, JSON.stringify(run({mode:m,patched:pt})));
// takeoff phase calendar time with geometric interpolation: T = G*(s1-s0)/(s0*s1*ln(s1/s0))
function cal(G,s0,s1){return G*(s1-s0)/(s0*s1*Math.log(s1/s0));}
const amr=Math.sqrt(1*25); const x=10+amr; const sar_siar=x**3/100-x; const E=Math.sqrt(0.3*7.5); const x2=x+sar_siar; const siar_asi=x2*Math.pow(x2/x,E)-x2;
console.log('SC->SAR human yrs median(nonzero)', Math.sqrt(1.5*10).toFixed(2), 'cal yrs', cal(Math.sqrt(15),5,25).toFixed(3));
console.log('SAR->SIAR human', sar_siar.toFixed(1),'cal',cal(sar_siar,25,250).toFixed(3));
console.log('SIAR->ASI human', siar_asi.toFixed(1),'cal',cal(siar_asi,250,2000).toFixed(3));
