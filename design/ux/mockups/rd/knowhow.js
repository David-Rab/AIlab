// RESEARCH › Know-how (UI-IA §1): five area bars, × vs Jul 2025 on a log axis, Public | Yours (range), Waiting hatched.
// Day-400 values: data400b.json knowhow.areas (believed; "waiting" and growth are believed sums, see DATA.md).
(function () {
  const { ic } = window.C;
  const A = [
    { name: 'Pretraining recipe', icon: 'layers', unit: '× effective compute for new base models', pub: 1.056, you: 3.35, lo: 3.07, hi: 3.64, wait: 1.5, waitIdeas: 13, grow: 1.5, ideas: 13, lands: 'next base model' },
    { name: 'Post-training method', icon: 'wand-sparkles', unit: '× post-training compute', pub: 0.966, you: 1.23, lo: 1.20, hi: 1.27, wait: 1.02, waitIdeas: 1, grow: 1.10, ideas: 6, lands: 'next post-training' },
    { name: 'Post-training ceiling', icon: 'wand-sparkles', unit: '× of the ceiling', pub: 1.0, you: 1.16, lo: 1.15, hi: 1.18, wait: 1.01, waitIdeas: 1, grow: 1.05, ideas: 6, lands: 'next post-training' },
    { name: 'Training efficiency', icon: 'circuit-board', unit: '× useful training per chip-day', pub: 1.0, you: 1.0, lo: 1.0, hi: 1.0, wait: null, grow: 1.0, ideas: 0, lands: 'every run, at once' },
    { name: 'Serving efficiency', icon: 'circuit-board', unit: '× work served per chip', pub: 1.0, you: 1.70, lo: 1.61, hi: 1.80, wait: null, grow: 1.27, ideas: 5, lands: 'all serving, at once' },
  ];
  const LO = Math.log(0.9), HI = Math.log(5);
  const X = (v) => ((Math.log(v) - LO) / (HI - LO)) * 100;
  const f = (v) => (v >= 1.995 ? v.toFixed(1) : v.toFixed(2));
  const ticks = [1, 1.5, 2, 3, 4, 5];
  const rows = A.map((a) => {
    const base = a.wait ? a.you / a.wait : a.you;
    return `<div class="ar">
      <div><div class="nm">${ic(a.icon, 's18')}<u>${a.name}</u></div><div class="un">${a.unit}</div></div>
      <div class="track">
        ${ticks.map((t) => `<div class="gridl" style="left:${X(t)}%"></div>`).join('')}
        <div class="bar2 pub" style="left:0;width:${X(a.pub)}%"></div><span class="vl pub" style="left:calc(${X(a.pub)}% + 8px)">×${f(a.pub)}</span>
        <div class="bar2 you" style="left:0;width:${X(base)}%;${a.wait ? 'border-radius:4px 0 0 4px' : ''}"></div>
        ${a.wait ? `<div class="bar2 wait" style="left:${X(base)}%;width:${X(a.you) - X(base)}%"></div>` : ''}
        ${a.hi > a.lo ? `<div class="whisk" style="left:${X(a.lo)}%;width:${X(a.hi) - X(a.lo)}%"></div>` : ''}
        <span class="vl you" style="left:calc(${X(a.hi)}% + 10px)">×${f(a.you)}</span>${a.wait && a.wait >= 1.05 ? `<span class="vl wt" style="top:0;left:${X(base)}%">×${f(a.wait)} <u>waiting</u> · ${a.waitIdeas} ideas</span>` : ''}
      </div>
      <div class="gr"><b>×${a.grow.toFixed(2)}</b><div>last 12 months · ${a.ideas} ideas</div></div>
    </div>`;
  }).join('');
  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('flask-conical', 's22')} Research</h1>
    <div class="tabs"><span class="t">Portfolio</span><span class="t">Discoveries</span><span class="t on">Know-how</span></div>
    <div class="sp"></div>
    <span class="link">${ic('wrench', 's14')} Lab tools</span>
    <span class="link">${ic('book-open', 's14')} Publish policy</span>
  </div>
  <div class="grid2">
    <div class="card areas">
      <div class="hd" style="padding-bottom:6px"><span class="ttl">${ic('layers', 's18')} <u>Know-how</u> <span class="t3" style="font-weight:500;font-size:13px">× vs Jul 2025</span></span>
        <span class="legend row t3" style="font-size:12.5px;gap:16px;margin-left:16px">
          <span class="row" style="gap:6px"><i style="width:16px;height:9px;border-radius:2px;background:#56677e;display:inline-block"></i><u>Public know-how</u></span>
          <span class="row" style="gap:6px"><i style="width:16px;height:9px;border-radius:2px;background:var(--cap);display:inline-block"></i>Yours, in your models</span>
          <span class="row" style="gap:6px"><i style="width:16px;height:9px;border-radius:2px;background:repeating-linear-gradient(135deg, rgba(155,107,224,.9) 0 3px, rgba(155,107,224,.25) 3px 6px);box-shadow:inset 0 0 0 1px #c4a5f5;display:inline-block"></i><u>Waiting</u>: not in a model yet</span>
          <span class="row" style="gap:6px"><i style="width:14px;height:2px;background:#fff;display:inline-block"></i><u>range</u></span>
        </span>
        <div class="sp"></div><span class="t3" style="font-size:12px">growth</span>
      </div>
      ${rows}
      <div class="ar axr"><span></span><div class="track" style="height:18px">${ticks.map((t) => `<span class="tkl" style="left:${X(t)}%">×${t}</span>`).join("")}</div><span></span></div>
      
    </div>
    <div class="side">
      <div class="card wcard">
        <div class="hd"><span class="ttl">${ic('hourglass', 's18')} Waiting for your next model</span></div>
        <div class="wbig">
          <div class="row" style="gap:14px;align-items:baseline"><span class="n1">×1.5</span><span style="font-size:15px;color:#fff">pretraining recipe</span></div>
          <div class="t2" style="font-size:13.5px;margin-top:4px">13 ideas since Jul 15, 2025 that no model of yours has. Only a new base model takes them in.</div>
          <div class="row" style="margin-top:12px;gap:8px"><span class="link">${ic('rocket', 's14')} Next run ${ic('chevron-right', 's12')}</span><span class="t3" style="font-size:12.5px">a new base takes ~104 days</span></div>
        </div>
        <div class="wrow" style="margin-top:8px"><span>Post-training method</span><span class="n w">×1.02</span><span class="t3">1 idea</span></div>
        <div class="wrow"><span>Post-training ceiling</span><span class="n w">×1.01</span><span class="t3">1 idea</span></div>
        <div class="wrow"><span class="t3">Training and serving efficiency</span><span></span><span class="t3">apply at once</span></div>
      </div>
      <div class="card wcard">
        <div class="hd"><span class="ttl">${ic('trending-up', 's18')} <u>Where it comes from</u></span></div>
        <div class="wrow" style="margin-top:6px"><span>Your research, last 12 months</span><span class="n w">30</span><span class="t3">ideas built in</span></div>
        <div class="wrow"><span>Public know-how, last 12 months</span><span class="n w">×1.0</span><span class="t3">nothing new published</span></div>
        <div class="wrow"><span class="t3">The programmes that add to it</span><span></span><span class="link sm">Portfolio ${ic('chevron-right', 's12')}</span></div>
      </div>
    </div>
  </div>`;
})();
