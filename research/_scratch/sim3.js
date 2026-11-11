// horizon trajectory under AI2027 median superexp (patched) and exp; print h80 (minutes) at dates
function traj({t0,h0,T,d,hT,cs,M0,M1,share=0.5}){
  const n=Math.log2(hT/h0); const g=Math.abs(1-d)<1e-9?n*T:T*(1-Math.pow(d,n))/(1-d); const base=g+cs;
  let prog=0,t=t0,out={}; const marks=[2025.5,2026.0,2026.27,2026.5,2027.0,2027.5,2028.0];
  while(prog<base&&t<2035){const f=prog/base; const M=1+(M0-1)*Math.pow((M1-1)/(M0-1),f);
    const c=t>=2029?0.5:1; prog+=(1/30.5)*(share*M+(1-share)*c); t+=1/365;
    const pg=Math.min(prog,g); let nn; if(Math.abs(1-d)<1e-9) nn=pg/T; else nn=Math.log(1-pg*(1-d)/T)/Math.log(d);
    for(const m of marks) if(!(m in out)&&t>=m) out[m]=Math.round(h0*Math.pow(2,nn));}
  out.SC=+t.toFixed(2); return out;}
console.log('super',JSON.stringify(traj({t0:2025.25-0.1,h0:15,T:4.74,d:0.9,hT:120*167*60,cs:3.87,M0:1.095,M1:8.75})));
console.log('exp',JSON.stringify(traj({t0:2025.25-0.1,h0:15,T:4.74,d:1,hT:120*167*60,cs:3.87,M0:1.095,M1:8.75})));
