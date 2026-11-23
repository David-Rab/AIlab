// Overview (UI-IA §5 Q4): a hub of the lab's loop, each box a link to its screen with one verdict (L1 #1), and the lead
// lanes, the home of the lead detail (L1 #2). Race chart deleted. World risk lives on World (UI-IA §0); your own models'
// risk lives on SAFETY (L0 item 7), so no risk number is copied here. #tip: L2, the Meridian lane locked tooltip.
// Day-400 values: data400a.json (see DATA-a.md).
(function () {
  const ic = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;

  // ── hub geometry ──
  const W = 1748, NW = 190, NH = 92, Y = 124;
  const gap = (W - 32 - 7 * NW) / 6;
  const X = (i) => 16 + i * (NW + gap);
  const cx = (i) => X(i) + NW / 2;
  const nodes = [
    ['Compute', 'server', 'Growing', 'good', 'chips arriving on time'],
    ['Lab', 'workflow', 'Idle compute', 'warn', 'training share unused'],
    ['Research', 'flask-conical', 'Limited by compute', 'warn', 'scientists all busy'],
    ['Training', 'rocket', 'No run queued', 'warn', 'know-how is waiting'],
    ['Models', 'brain', 'Atlas-2.10 testing', 'info', 'in use: Atlas-2.8'],
    ['Products', 'boxes', 'Limited by quality', 'warn', 'buyers drift to rivals'],
    ['Finance', 'landmark', 'Healthy', 'good', 'revenue covers costs'],
  ];
  const node = (n, x, y, cls = '') => `
    <div class="hn ${n[3]} ${cls}" style="left:${x}px;top:${y}px">
      <div class="h">${ic(n[1], 's14')}${n[0]}<span class="go">${ic('chevron-right', 's14')}</span></div>
      <div class="vd"><span class="dot"></span>${n[2]}</div>
      <div class="t3" style="font-size:12.5px;margin-top:-3px">${n[4]}</div>
    </div>`;
  const row = nodes.map((n, i) => node(n, X(i), Y)).join('');
  const sx = (cx(4) + cx(5)) / 2 - NW / 2, sy = Y + NH + 58;
  const wx = X(6), wy = sy;
  const side = node(['Safety', 'microscope', 'Staff short', 'warn', 'safety research slowed'], sx, sy, 'side')
    + node(['World', 'globe', 'DeepCent riskiest', 'warn', 'world risk, public, government'], wx, wy, 'side');

  const arrow = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2 - 7}" y2="${y}" stroke="#4a5b72" stroke-width="2"/><path d="M${x2 - 8},${y - 5} L${x2},${y} L${x2 - 8},${y + 5}" fill="#4a5b72"/>`;
  const mid = Y + NH / 2;
  const rowArrows = nodes.slice(0, -1).map((_, i) => arrow(X(i) + NW + 4, X(i + 1) - 4, mid)).join('');
  const rowLabels = ['chips', 'people', 'know-how', 'models', 'models', 'revenue'].map((t, i) => `<span class="el" style="left:${X(i) + NW + gap / 2}px;top:${mid + 8}px;background:none">${t}</span>`).join('');
  const back = `<path d="M${cx(6)},${Y - 2} L${cx(6)},36 L${cx(0)},36 L${cx(0)},${Y - 9}" fill="none" stroke="#4a5b72" stroke-width="2"/><path d="M${cx(0) - 5},${Y - 10} L${cx(0)},${Y - 2} L${cx(0) + 5},${Y - 10}" fill="#4a5b72"/>`;
  const take = `<path d="M${cx(4)},${Y - 2} L${cx(4)},80 L${cx(1)},80 L${cx(1)},${Y - 9}" fill="none" stroke="#7fe0cf" stroke-width="2" stroke-dasharray="6 5"/><path d="M${cx(1) - 5},${Y - 10} L${cx(1)},${Y - 2} L${cx(1) + 5},${Y - 10}" fill="#7fe0cf"/>`;
  const watch = `<path d="M${sx + NW / 2},${sy} L${sx + NW / 2},${sy - 22} M${cx(4)},${Y + NH} L${cx(4)},${sy - 22} L${cx(5)},${sy - 22} L${cx(5)},${Y + NH}" fill="none" stroke="#22a394" stroke-width="2" stroke-dasharray="3 4"/>`;
  const world = `<path d="M${cx(6)},${wy} L${cx(6)},${Y + NH + 2}" fill="none" stroke="#4a5b72" stroke-width="2" stroke-dasharray="3 4"/>`;
  const hub = `
    <div class="hub">
      <svg class="edges" width="${W}" height="382">${back}${take}${rowArrows}${watch}${world}</svg>
      <span class="el" style="left:${(cx(0) + cx(6)) / 2}px;top:27px">revenue and investors pay for chips and people</span>
      <span class="el ai" style="left:${(cx(1) + cx(4)) / 2}px;top:71px">${ic('bot', 's12')} your models join the lab as <u>AI staff</u>: the takeoff loop</span>
      <span class="el" style="left:${(cx(4) + cx(5)) / 2}px;top:${sy - 32}px;color:#5fc7b8">watches models at work</span>
      ${rowLabels}${row}${side}
    </div>`;

  // ── lead lanes: + = they are ahead of you (days); range = best guess ± 1.64 sd ──
  const LO = -365, HI = 365;
  const P = (d) => ((d - LO) / (HI - LO)) * 100;
  const labs = [
    ['Meridian', 'US', 154, 46, 'ME'],
    ['Gemini Labs', 'US', 72, 61, 'GL'],
    ['DeepCent', 'China', 52, 65, 'DC'],
    ['xLab', 'US', -83, 64, 'XL'],
    ['Anthropos', 'US', -272, 48, 'AN'],
  ];
  const col = (c) => (c === 'China' ? '#e05a9c' : '#d4732a');
  const lanes = labs.map(([n, c, d, sd, ab]) => {
    const lo = Math.round(d - 1.64 * sd), hi = Math.round(d + 1.64 * sd);
    const hot = location.hash === '#tip' && n === 'Meridian';
    return `<div class="lane">
      <span class="ln">${n}<span class="fl ${c === 'China' ? 'cn' : ''}">${c}</span></span>
      <div class="tr"><div class="base"></div>
        <div class="rg" style="left:${P(lo)}%;width:${P(hi) - P(lo)}%;background:${col(c)}"></div>
        <div class="dt" style="left:${P(d)}%;background:${col(c)};${hot ? 'box-shadow:0 0 0 3px var(--panel),0 0 0 5px #fff' : ''}">${ab}</div>
      </div>
      <div class="lval"><b class="${d > 0 ? 'ahead' : 'behind'}">${Math.abs(d)} d</b><span class="w2">${d > 0 ? 'ahead of you' : 'behind you'}</span><div class="rg2">likely ${Math.abs(lo) === lo ? '' : ''}${fmtR(lo, hi)}</div></div>
    </div>`;
  }).join('');
  function fmtR(lo, hi) {
    const f = (v) => (v > 0 ? `${v} ahead` : v < 0 ? `${-v} behind` : '0');
    return lo > 0 || hi < 0 ? `${Math.min(Math.abs(lo), Math.abs(hi))}–${Math.max(Math.abs(lo), Math.abs(hi))} d` : `${f(lo)} – ${f(hi)}`;
  }
  const ticks = [-365, -180, -90, 0, 90, 180, 365];
  const axis = `
    <div style="position:absolute;left:208px;right:228px;top:0;bottom:0;pointer-events:none">
      <div class="zone" style="left:${P(0)}%;right:0"></div>
      ${ticks.filter((t) => t !== 0).map((t) => `<div class="axg" style="left:${P(t)}%"></div><span class="axl" style="left:${P(t)}%">${t > 0 ? '+' : t < 0 ? '−' : ''}${Math.abs(t) === 365 ? '1 yr' : Math.abs(t) + ' d'}</span>`).join('')}
      <span class="zl behind" style="right:${100 - P(0) + 1}%">← behind you</span><span class="zl ahead" style="left:${P(0) + 1}%">ahead of you →</span>
      <div class="youline" style="left:calc(${P(0)}% - 1px)"></div><span class="youtag" style="left:${P(0)}%">YOU · Atlas-2.8</span>
    </div>`;

  document.getElementById('main').innerHTML = `
  <div class="ph"><h1>${ic('radar', 's22')} Overview</h1><div class="sp"></div></div>
  <div class="card">
    <div class="hd"><span class="ttl">${ic('workflow', 's18')} Your lab</span><span class="q">how the parts feed each other · each box opens its screen</span></div>
    ${hub}
  </div>
  <div class="card race" style="flex:1">
    <div class="hd"><span class="ttl">${ic('timer', 's18')} The race</span><span class="q">how far each lab's best model is from yours, in days of progress · your estimate</span>
      <div class="sp"></div>
      <span class="row t3" style="font-size:12.5px;gap:16px"><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#d4732a;display:inline-block"></i>US lab</span><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:50%;background:#e05a9c;display:inline-block"></i>China</span><span class="row" style="gap:6px"><i style="width:22px;height:8px;border-radius:4px;background:#d4732a;opacity:.4;display:inline-block"></i><u>likely range</u></span></span>
    </div>
    <div class="lanes" style="margin-top:40px">${axis}${lanes}</div>
  </div>
  ${location.hash === '#tip' ? window.OV_TIP : ''}`;
})();
