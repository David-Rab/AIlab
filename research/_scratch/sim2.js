// Generic stage-1 engine (derived): horizon doublings with per-doubling factor d, multiplier interpolation, software share
function stage1({t0,h0,T,d=1,hT,cs=0,M0=1,M1=1,share=0.5,comp=(t)=>1,lab=(t,M)=>M}){
  const n=Math.log2(hT/h0); const g = Math.abs(1-d)<1e-9? n*T : T*(1-Math.pow(d,n))/(1-d);
  const base=g+cs; let prog=0,t=t0;
  while(prog<base && t<2060){ const f=prog/base; let M=(M0===1&&M1===1)?1:1+(M0-1)*Math.pow((M1-1)/(M0-1),f); M=lab(t,M);
    prog+=(1/30.5)*(share*M+(1-share)*comp(t)); t+=1/365;}
  return {n:+n.toFixed(2),base:+base.toFixed(1),t:+t.toFixed(2)};
}
const slow=(t)=>t>=2029?0.5:1, labslow=(t,M)=>t>=2029?Math.sqrt(0.5*M*(M-0.5)):M;
console.log('AI2027 super patched (check)',stage1({t0:2025.25-1.2/12,h0:15,T:4.74,d:0.9,hT:120*167*60,cs:3.87,M0:1.095,M1:8.75,comp:slow,lab:labslow}));
console.log('AI2027 exp patched (check)',stage1({t0:2025.25-1.2/12,h0:15,T:4.74,d:1,hT:120*167*60,cs:3.87,M0:1.095,M1:8.75,comp:slow,lab:labslow}));
console.log('titotal METR exp no speedup Eli hSC',stage1({t0:2025.25,h0:15,T:7,d:1,hT:120*167*60,cs:3.87}));
console.log('titotal METR exp no speedup Nikola hSC',stage1({t0:2025.25,h0:15,T:7,d:1,hT:1.5*167*60,cs:0}));
// AIFM-lite candidates from 2026.27, h0=186 min p80
for (const M0 of [1.1,1.3,1.5]) for (const M1 of [3,5,8]) {
 console.log('Daniel-lite M0',M0,'M1',M1, stage1({t0:2026.27,h0:186,T:4.0,d:0.92,hT:120000,M0,M1,share:0.6}).t,
 ' Eli-lite', stage1({t0:2026.27,h0:186,T:4.5,d:0.92,hT:125*120000,M0,M1,share:0.6}).t,
 ' Eli-lite hT=10y', stage1({t0:2026.27,h0:186,T:4.5,d:0.92,hT:10*120000,M0,M1,share:0.6}).t);
}
// GPT-5 Aug 2025 start p80=38 min
console.log('2025.6 start, h0=38, T=4.5 exp, hT=1wy', stage1({t0:2025.6,h0:38,T:4.5,d:1,hT:120000}).t);
console.log('2025.6 start, h0=38, T=6.2 exp, hT=10wy, no speedup', stage1({t0:2025.6,h0:38,T:6.2,d:1,hT:1200000}).t);
const sched=(t)=> t<2028?1: t<2029?0.9: t<2030?0.5: t<2031?0.4:0.3;
console.log('--- calib');
for (const d of [0.92,0.95,0.97,1.0]) for (const M1 of [2,3,5]) {
  console.log('d',d,'M1',M1,
   'Daniel', stage1({t0:2026.27,h0:186,T:4.0,d,hT:120000,M0:1.15,M1,share:0.6,comp:sched}).t,
   'Eli125y', stage1({t0:2026.27,h0:186,T:4.5,d,hT:125*120000,M0:1.1,M1,share:0.6,comp:sched}).t,
   'Dec25-Eli125y', stage1({t0:2025.9,h0:32,T:5.5,d,hT:125*120000,M0:1.05,M1,share:0.6,comp:sched}).t,
   'Skeptic-METR7mo-10y', stage1({t0:2025.6,h0:38,T:7,d,hT:10*120000,M0:1.0,M1:1.0,share:0.6,comp:sched}).t);
}
