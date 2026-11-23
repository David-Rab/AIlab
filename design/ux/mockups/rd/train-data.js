// TRAINING › Data (UI-IA §1 TRAINING · Data): is there enough for the next run, by domain and source; what each source
// gives; generated data by teacher. Day-400 values: data400-b.json DATA (provenance DATA-b.md). State #drawer: licence offer.
(function () {
  const { ic } = window.C;
  const SRC = {
    public: ['Public web', '#3987e5', 'globe'], licensed: ['Licensed', '#d55181', 'scroll-text'], usage: ['Usage', '#c98500', 'message-square'],
    generated: ['Generated', '#9085e9', 'sparkles'], expert: ['Expert', '#199e70', 'graduation-cap'],
  };
  // tokens (T) per domain by source = source tokens × its domain mix; draw = next run tokens × the run's domain share
  const DOMS = [
    ['Code', 'code-xml', 21.6, 4.5, 0, 152.8, 45], ['AI research', 'flask-conical', 18.9, 4.5, 0, 154.2, 44],
    ['Math & reasoning', 'lightbulb', 21.6, 3.0, 40.3, 152.8, 51], ['Long tasks', 'bot', 16.2, 0.6, 0, 152.8, 42],
    ['Social', 'users-round', 121.5, 10.5, 40.3, 147.4, 86], ['Media', 'image', 32.4, 3.6, 20.1, 147.4, 50],
    ['Cyber', 'binary', 8.1, 0.9, 0, 154.2, 40], ['Bio', 'dna', 16.2, 1.8, 0, 152.8, 42], ['Physical', 'atom', 13.5, 0.6, 0, 147.4, 40],
  ];
  const MAX = 350;
  const pc = (v) => (v / MAX * 100).toFixed(2) + '%';
  const domRows = DOMS.map(([n, icon, pub, lic, use, gen, draw]) => {
    const tot = pub + lic + use + gen;
    const seg = [[pub, 'public'], [lic, 'licensed'], [use, 'usage'], [gen, 'generated']].filter((x) => x[0] > 0)
      .map(([v, k]) => `<i style="width:calc(${pc(v)} - 2px);background:${SRC[k][1]}"></i>`).join('');
    return `<div class="dom"><span class="nm">${ic(icon, 's14')}<u>${n}</u></span>
      <div class="stk"><div class="segs">${seg}</div><div class="draw" style="left:0;width:${pc(draw)}"></div></div>
      <span class="v">${Math.round(tot)}T</span></div>`;
  }).join('');
  const axis = `<div class="axis">${[0, 100, 200, 300].map((v) => `<span style="left:${pc(v)}">${v}T</span>`).join('')}</div>`;

  // generated data by teacher (13 batches, grouped by the model that wrote them)
  const GEN = [['Atlas-1.0', 42.1, 1], ['1.4', 7.5, 1], ['1.5', 116.2, 1], ['1.6', 123.9, 1], ['1.7', 203.9, 1],
    ['Atlas-2.0', 90.3, 2], ['2.2', 108.1, 2], ['2.4', 120.9, 2], ['2.5', 157.0, 2], ['2.6', 164.2, 2], ['2.8', 183.0, 2], ['2.10', 47.4, 3]];
  const gmax = 220, gw = 100 / GEN.length;
  const genBars = GEN.map(([n, t, era], i) => {
    const col = era === 1 ? '#5e558f' : '#9085e9';
    return `<div class="b" style="left:calc(${(i + 0.5) * gw}% - 14px);width:28px;height:${(t / gmax * 100).toFixed(1)}%;background:${col};${era === 3 ? 'background:repeating-linear-gradient(135deg,#9085e9 0 4px,#6d62c0 4px 8px)' : ''}"></div>`;
  }).join('');

  const usageSeg = [['None', 0], ['Standard', 1], ['Broad', 0]].map(([n, on]) => `<span class="${on ? 'on' : ''}">${n}</span>`).join('');
  const sources = [
    ['public', '270', 'T', `90% of the public web crawled · quality <span class="qchip">1.0</span>`, `<span class="t3">30T of the web not crawled</span>`],
    ['licensed', '30', 'T', `bought before Jul 2025 · quality <span class="qchip">1.0</span>`, `<span class="btn">${ic('shopping-cart', 's14')} Buy a licence</span><span class="t3">none on the way</span>`],
    ['usage', '101', 'T', `from your products' conversations · quality <span class="qchip">0.5</span> · <b class="w n">+0.2T</b> a day`,
      `<span class="t3" style="font-size:12.5px"><u>Usage policy</u></span><span class="seg3">${usageSeg}</span><span class="t3" style="font-size:12px">Broad: +0.5T a day · <span class="bad">civil liberties −6</span></span>`],
    ['generated', '1,364', 'T', `written by your models · quality <span class="qchip">0.66</span> · <b class="w n">+5.3T</b> a day`,
      `<span class="t3" style="font-size:12.5px">Teacher</span><span class="pill" style="padding:2px 9px;border-radius:7px;border:1px solid var(--you);background:#24364f;color:#fff;font-size:12.5px;font-weight:600">Atlas-2.10 ${ic('chevron-down', 's12')}</span><span class="link sm">Data generation 22% of compute ▸ LAB</span>`],
    ['expert', '0.012', 'T', `written by hired experts · quality <span class="qchip">3.0</span> · used in environments, not in pretraining`, `<span class="link sm">Environments ${ic('chevron-right', 's12')}</span>`],
  ].map(([k, v, u, sub, acts]) => `<div class="src"><div class="si" style="background:${SRC[k][1]}">${ic(SRC[k][2], 's18')}</div>
      <div><div class="sn"><u>${SRC[k][0]}</u></div><div class="sub">${sub}</div><div class="acts">${acts}</div></div>
      <div class="sv">${v}<span class="u"> ${u}</span></div></div>`).join('');

  // reads gauge: 0–5 reads per token; zones ≤1 every token new · 1–4 fine · >4 short
  const gx = (v) => (v / 5 * 100).toFixed(2) + '%';
  const gauge = `<div class="gauge"><i class="z" style="width:calc(${gx(1)} - 2px);background:var(--good)"></i><i class="z" style="width:calc(${gx(3)} - 2px);background:#2f6b52"></i><i class="z" style="flex:1;background:var(--warn)"></i><div class="mk" style="left:${gx(0.45)}"></div></div>
    <div class="gl"><span style="left:0;transform:none">0</span><span style="left:${gx(1)}">1</span><span style="left:${gx(4)}">4</span><span style="left:${gx(4.5)}" class="warn">short</span></div>`;

  document.getElementById('main').innerHTML = `
  <div class="ph">
    <h1>${ic('rocket', 's22')} Training</h1>
    <div class="tabs"><span class="t">Next run</span><span class="t on">Data</span><span class="t">Environments</span><span class="t">Runs</span></div>
    <div class="sp"></div>
  </div>
  <div class="herorow">
    <div class="card tile">
      <div class="t">${ic('database', 's18')} <u>Enough for the next run?</u><div class="sp"></div><span class="chip good">${ic('check', 's12')} Enough</span></div>
      <div class="row" style="gap:18px;align-items:flex-end">
        <div class="big">0.45<span class="u"><u>reads per token</u></span></div>
        <div style="flex:1;max-width:420px">${gauge}</div>
      </div>
      <div class="t3" style="font-size:12.5px">New base, 1.1T parameters, Balanced mix: draws 440T, no token read twice <span class="link sm">Next run ${ic('chevron-right', 's12')}</span></div>
    </div>
    <div class="card tile">
      <div class="t">${ic('gem', 's18')} <u>Quality</u> of what it reads</div>
      <div class="big">0.80<span class="u">× public web</span></div>
      <div class="t3" style="font-size:12.5px">Generated data is 77% of your tokens at 0.66</div>
    </div>
    <div class="card tile">
      <div class="t">${ic('trending-up', 's18')} New data</div>
      <div class="big">+5.5T<span class="u">a day</span></div>
      <div class="t3" style="font-size:12.5px">Generated 5.3T · Usage 0.2T · a new base draws 440T</div>
    </div>
  </div>
  <div class="grid">
    <div class="lcol">
      <div class="card" style="padding-bottom:10px">
        <div class="hd"><span class="ttl">${ic('chart-bar-stacked', 's18')} Data by domain</span><span class="q">tokens you own, by source</span><div class="sp"></div>
          <div class="legend">${['public', 'licensed', 'usage', 'generated'].map((k) => `<span><i style="background:${SRC[k][1]}"></i>${SRC[k][0]}</span>`).join('')}
          <span><i style="background:none;border-right:2px solid #fff;border-bottom:2px solid #fff;border-radius:0;height:10px"></i>next run reads</span></div></div>
        <div style="padding:8px 18px 0">${domRows}${axis}</div>
      </div>
      <div class="card" style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div class="hd"><span class="ttl">${ic('sparkles', 's18')} <u>Generated data</u> by teacher</span><span class="q">tokens each model wrote · hatched: writing now</span><div class="sp"></div>
          <span class="t3" style="font-size:12.5px">Atlas-1 teachers <b class="w n">0.50</b> quality · Atlas-2 teachers <b class="w n">0.74–0.76</b></span></div>
        <div class="gen">
          <div class="bars">${genBars}</div>${GEN.map(([n], i) => `<span class="xl" style="left:${(i + 0.5) * gw}%">${n}</span>`).join('')}
        </div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column">
      <div class="hd" style="padding-bottom:12px"><span class="ttl">${ic('layers', 's18')} Sources</span><span class="q">what you own and what each adds</span></div>
      ${sources}
    </div>
  </div>`;

  if (location.hash === '#drawer') {
    const tiers = [['Bulk archives', '1.5', '$0.1B per T', 1], ['Curated', '2.0', '$2B per T', 0], ['Books & textbooks', '3.0', '$30B per T', 0]];
    document.getElementById('main').insertAdjacentHTML('beforeend', `<div class="scrim"></div>
    <div class="drawer">
      <div class="dh">${ic('scroll-text', 's20')} Buy a licence<div class="sp"></div><span class="t3" style="font-size:13px;font-weight:500">Esc</span></div>
      <div class="sec"><div class="k" style="margin-bottom:8px">Domain</div>
        <div class="domsel">${DOMS.map(([n], i) => `<span class="pill ${i === 0 ? 'on' : ''}" style="padding:3px 10px;border-radius:7px;border:1px solid ${i === 0 ? 'var(--you)' : 'var(--line-2)'};${i === 0 ? 'background:#24364f;color:#fff;font-weight:600' : 'color:var(--text-2)'};font-size:12.5px">${n}</span>`).join('')}</div></div>
      <div class="sec"><div class="k" style="margin-bottom:8px">Kind</div>
        <div class="opt3">${tiers.map(([n, q, p, on]) => `<div class="o ${on ? 'on' : ''}"><b>${n}</b><u>quality</u> <span class="n w">${q}</span><br>${p}</div>`).join('')}</div></div>
      <div class="sec"><div class="row"><span class="k">Amount</span><div class="sp"></div><span class="n w" style="font-size:16px">10T</span></div>
        <div style="position:relative;height:6px;border-radius:3px;background:var(--panel-3);margin:10px 0 4px"><i style="position:absolute;left:0;top:0;bottom:0;width:20%;background:var(--you);border-radius:3px"></i><i style="position:absolute;left:20%;top:-5px;width:16px;height:16px;border-radius:50%;background:#fff;transform:translateX(-8px)"></i></div>
        <div class="row t3" style="font-size:11.5px"><span>1T</span><div class="sp"></div><span>50T</span></div></div>
      <div class="sec"><div class="k" style="margin-bottom:10px">Before → after</div>
        <div class="ba">
          <span class="t2">Cost</span><span class="n">—</span><span class="ar">→</span><span class="n">$1.0B</span>
          <span class="t2">Arrives</span><span></span><span class="ar"></span><span class="n">Oct 4, 2026 <span class="t3" style="font-family:var(--sans)">(60 d)</span></span>
          <span class="t2">Code tokens</span><span class="n">179T</span><span class="ar">→</span><span class="n">189T</span>
          <span class="t2">Code share of your data</span><span class="n">10.2%</span><span class="ar">→</span><span class="n">11.2%</span>
          <span class="t2"><u>Code skill</u> of a new base</span><span class="t3">—</span><span class="ar">→</span><span><span class="up">▲</span> <span class="t3">small</span></span>
          <span class="t2">Reads per token</span><span class="n">0.45</span><span class="ar">→</span><span class="n">0.45</span>
        </div></div>
      <div class="sec" style="border-bottom:0"><div class="row" style="gap:8px;padding:9px 12px;border-radius:8px;background:var(--warn-bg);border:1px solid rgba(233,180,76,.4);font-size:13px;color:#f4d79a">${ic('info', 's14')}<span>A base launched today won't read it. Your data is not short: 0.45 reads per token.</span></div></div>
      <div style="margin-top:auto;padding:16px 20px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end"><span class="btn">Cancel</span><span class="btn pri">${ic('shopping-cart', 's14')} Buy for $1.0B</span></div>
    </div>`);
  }
})();
