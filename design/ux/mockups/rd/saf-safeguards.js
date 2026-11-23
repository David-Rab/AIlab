// SAFETY › Safeguards (SAFETY-REDESIGN §3.3, §3.8; UI-IA SAFETY Safeguards row, OQ-7). Day 400.
// Deployments and items: data400c.json deployments (guards, safeguards), data400c-mon.json (monitor per AI staff job:
// watched, flag, acted-on), data400b.json act tables (block, catch, stop per act), spend (monitor compute ask / got),
// framework rules (data400c.json framework.fw). Stop-rate story: the Sabotages research row of Atlas-2.8 (block 0.488,
// catch 0.657; catch split by believedInternalOversight parts). Previews: same terms, other settings. DATA-c.md.
(function () {
  const { ic } = window.C;
  document.getElementById('main').innerHTML = window.SAFHEAD(400, 'Safeguards') + '<div class="body2" id="body" style="grid-template-columns:minmax(0,1fr) 600px"></div>';
  const on = (txt, sub, req) => `<div class="sgc on"><span class="row" style="gap:5px;color:#fff;font-size:12.5px;font-weight:600">${ic('check', 's12')}${txt}${req ? `<span style="color:var(--saf)">${ic('scroll-text', 's12')}</span>` : ''}</span>${sub ? `<span class="t3" style="font-size:11.5px">${sub}</span>` : ''}</div>`;
  const off = (txt) => `<div class="sgc"><span class="t3" style="font-size:12px">${txt || ''}</span></div>`;
  const shared = (txt, sub) => `<div class="sgc on shared"><span class="row" style="gap:5px;color:#fff;font-size:12.5px;font-weight:600">${txt}</span><span class="t3" style="font-size:11.5px">${sub}</span></div>`;
  const stop = (lo, hi, lab) => `<div style="line-height:1.25"><span class="mono w" style="font-size:13px">${lo === hi ? lo : `${lo}–${hi}`}%</span><br><span class="t3" style="font-size:11px">${lab}</span></div>`;
  const C = 'display:grid;grid-template-columns:232px repeat(5, minmax(0,1fr)) 110px 74px;gap:8px;align-items:stretch;padding:0 16px';
  const head = `<div style="${C};padding-top:4px;padding-bottom:7px;border-bottom:1px solid var(--line)">
    <span class="th2">Deployment · model</span>${['Monitor', 'Control protocol', 'Human review', 'Restriction', 'Product safeguards'].map((h) => `<span class="th2"><u>${h}</u></span>`).join('')}<span class="th2"><u>Stop rate</u></span><span class="th2"><u>Slowdown</u></span></div>`;
  const prodRow = (n) => `<div style="${C};padding-top:4px;padding-bottom:4px">
      <div style="line-height:1.25;padding:4px 0"><span class="w" style="font-size:13.5px;font-weight:600">${n}</span><br><span class="t3" style="font-size:12px">${ic('brain', 's12')} Atlas-2.8 + 5 · same on all 3</span></div>
      ${off('no monitor · + Add')}${off()}${off()}${off()}${on('Classifiers', 'stop bio, cyber help')}
      <div style="font-size:12px;line-height:1.35"><span class="mono w">0%</span> <span class="t3">misbehaviour</span><br><span class="mono w">56%</span> <span class="t3">misuse</span></div><span class="mono t2" style="align-self:center">0%</span></div>`;
  const job = (n, m, mon, row, sel) => `<div style="grid-column:1;grid-row:${row};line-height:1.25;padding:6px 0 6px 8px;${sel ? 'background:rgba(58,138,224,.10);box-shadow:inset 3px 0 0 var(--you);border-radius:4px' : ''}"><span class="w" style="font-size:13.5px;font-weight:600">${n}</span><br><span class="t3" style="font-size:12px">${ic('brain', 's12')} ${m}</span></div><div style="grid-column:2;grid-row:${row};display:flex">${mon}</div>`;
  const staff = `<div style="${C};grid-template-rows:repeat(3,auto);row-gap:6px;padding-top:4px;padding-bottom:6px">
      ${job('Engineering', 'Atlas-2.8', off('no monitor · + Add'), 1, true)}
      ${job('Experiments', 'Atlas-2.10', on('Atlas-2.8', '<span class="warn">same family</span> · watched 1.2%'), 2)}
      ${job('Ideas', 'Atlas-2.8', on('Atlas-2.6', 'trusted · watched 1.2%'), 3)}
      <div style="grid-column:3;grid-row:1 / span 3;display:flex">${on('Defer 10% to trusted', 'blocks 49% of risky actions · lets ×0.45 of the rest slip by', true)}</div>
      <div style="grid-column:4;grid-row:1 / span 3;display:flex">${on('19 people', 'catch 12% of what they review')}</div>
      <div style="grid-column:5;grid-row:1 / span 3;display:flex">${off('+ Add')}</div>
      <div style="grid-column:6;grid-row:1 / span 3;display:flex">${off()}</div>
      <div style="grid-column:7;grid-row:1 / span 3;align-self:center">${stop(80, 89, 'by act')}</div>
      <div style="grid-column:8;grid-row:1 / span 3;align-self:center" class="mono w">7%</div>
    </div>`;
  const body = `<div class="cap" style="padding:8px 16px 4px;display:flex;gap:8px;align-items:center">${ic('bot', 's14')} AI staff work <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">· one deployment, one model per job · Safety: no AI staff</span></div>${staff}
    <div class="cap" style="padding:8px 16px 4px;display:flex;gap:8px;align-items:center;border-top:1px solid rgba(36,48,65,.7)">${ic('boxes', 's14')} Products <span class="t3" style="text-transform:none;letter-spacing:0;font-weight:500">· each serves Atlas-2.8 and a lineup of 5 smaller models</span></div>${prodRow('Chat · API · Enterprise')}`;
  const matrix = `<div class="card" style="flex:0 0 auto;padding-bottom:6px">
    <div class="hd" style="padding-bottom:8px"><span class="ttl">${ic('shield', 's16')} What stops harmful acts, where</span><span class="q">Owned safeguards on each deployment</span><div class="sp"></div>
      <span class="row t3" style="font-size:12px;gap:6px"><span style="color:var(--saf)">${ic('scroll-text', 's12')}</span>required by your framework</span></div>
    ${head}${body}</div>`;
  // stop-rate story: 100 attempts at "Sabotages research" by Atlas-2.8 on engineering work
  const S = [['Blocked by control protocol', 48.8, '#1a7e73'], ['Flagged by monitor, stopped', 6.8, '#22a394'], ['Caught in human review', 5.2, '#7fe0cf'], ['Deferred to trusted model', 21.7, '#4f9e95'], ['Get through', 17.5, '#e9b44c']];
  let acc = 0;
  const seg = S.map(([n, v, c]) => { const l = acc; acc += v; return `<span style="position:absolute;top:0;bottom:0;left:${l}%;width:${v}%;background:${c};${n === 'Get through' ? '' : 'box-shadow:inset -1px 0 0 rgba(11,15,21,.6)'}"></span>`; }).join('');
  acc = 0;
  const labs = S.map(([n, v, c]) => { const l = acc; acc += v; return `<div style="position:absolute;left:${l}%;width:${v}%;padding:0 6px;border-left:2px solid ${c};font-size:12px;line-height:1.3"><b class="mono" style="color:#fff;font-size:13.5px">${Math.round(v)}</b><br><span class="t2">${n}</span></div>`; }).join('');
  const legend = S.map(([n, v, c]) => `<span class="row" style="gap:6px;font-size:12.5px"><span style="width:12px;height:12px;border-radius:3px;background:${c}"></span><b class="mono w">${Math.round(v)}</b><span class="t2">${n.toLowerCase()}</span></span>`).join('');
  const lever = (what, from, to, cost, best) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 150px 210px 78px;gap:12px;align-items:center;padding:8px 0;border-top:1px solid rgba(36,48,65,.7);font-size:13px">
    <span class="w">${what}</span><span class="prev">${from} → <b style="${best ? '' : 'color:#cfe3ff'}">${to}</b></span><span class="t2 mono" style="font-size:12px">${cost}</span><span class="btn sm" style="justify-content:center">Apply</span></div>`;
  const story = `<div class="card fl" style="flex:1">
    <div class="hd"><span class="ttl">${ic('filter', 's16')} <span><u>Stop rate</u>, step by step</span></span><span class="q">every 100 attempts at <b class="w">Sabotages research</b> by Atlas-2.8 doing engineering</span><div class="sp"></div><span class="link sm">act row ${ic('chevron-right', 's12')}</span></div>
    <div style="padding:14px 16px 0">
      <div style="position:relative;height:26px;border-radius:5px;overflow:hidden;background:var(--bg-2)">${seg}</div>
      <div class="row" style="gap:16px;margin-top:8px;flex-wrap:wrap">${legend}</div>
      <div class="row" style="gap:10px;margin-top:10px;font-size:13px"><span>Stop rate <b class="mono w">83%</b> on this act</span><span class="t3">·</span><span class="t2"><u>What binds</u>: the monitor reads with your reasoning and internals instruments, which see about <b class="mono w">26%</b> of it; it also watches only <b class="mono w">1.2%</b> of actions</span></div>
    </div>
    <div style="padding:10px 16px 6px;margin-top:auto">
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 150px 210px 78px;gap:12px" class="th2"><span>Change</span><span>Stop rate on this act</span><span>Cost</span><span></span></div>
      ${lever('Control protocol: resample suspicious actions', '83%', '95%', 'slowdown 7% → 5%', true)}
      ${lever('Control protocol: defer 20% to trusted', '83%', '92%', 'slowdown 7% → 17%')}
      ${lever('Fund monitors fully (watched 1.2% → 100%)', '83%', '85%', '+129k H100e (3.4% of compute)')}
    </div>
  </div>`;
  // framework
  const R = [
    ['AI R&D: Critical', 'AI research', 3.57, 10, 'Training', 'control protocol, human review', 'eval suite, external evaluation'],
    ['Biological: High', 'Bio', 0.57, 6.4, 'Release', 'classifiers', 'eval suite'],
    ['Biological: Critical', 'Bio', 0.57, 10, 'Release', 'hardened safeguards', 'eval suite, external evaluation'],
    ['Cyber: High', 'Cyber', 1.51, 6.4, 'Release', 'classifiers', 'eval suite'],
    ['Cyber: Critical', 'Cyber', 1.51, 10, 'Release', 'hardened safeguards', 'eval suite, external evaluation'],
  ];
  const ruler = (v, th) => { const x = (L) => (L / 12) * 100; return `<div class="skr" style="height:12px"><div class="tk med" style="left:${x(6.4)}%;top:-3px;bottom:-3px"></div><div class="tk best" style="left:${x(10)}%;top:-3px;bottom:-3px"></div><div class="sb" style="width:${x(v)}%;top:2px;bottom:2px"></div><span style="position:absolute;top:-6px;bottom:-6px;left:${x(th)}%;width:0;border-left:2px dashed var(--warn)"></span></div>`; };
  const always = `<div style="padding:8px 0;border-top:1px solid rgba(36,48,65,.7)"><div class="row" style="gap:8px"><b class="w" style="font-size:13.5px">AI staff work</b><span class="t3" style="font-size:12px">always</span><div class="sp"></div><span class="chip good">${ic('check', 's12')} met</span></div><div class="t3" style="font-size:12px;margin-top:5px">needs: control protocol on every model doing AI staff work</div></div>`;
  const rules = R.map(([n, sk, v, th, holds, sg, ev]) => `<div style="padding:8px 0;border-top:1px solid rgba(36,48,65,.7)">
      <div class="row" style="gap:8px"><b class="w" style="font-size:13.5px">${n}</b><span class="t3" style="font-size:12px">${sk} at ${th >= 10 ? 'best human' : 'median expert'}</span><div class="sp"></div><span class="chip">${ic('octagon-pause', 's12')} holds ${holds.toLowerCase()}</span></div>
      <div style="display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center;margin-top:6px">${ruler(v, th)}<span class="t3" style="font-size:12px">needs: ${sg} · ${ev}</span></div>
    </div>`).join('');
  const fw = `<div class="card fl" style="min-height:0">
    <div class="hd"><span class="ttl">${ic('scroll-text', 's16')} <u>Safety framework</u></span><span class="chip">not published</span><div class="sp"></div><span class="btn sm">${ic('pencil', 's14')} Edit rules</span></div>
    <div class="sub" style="padding:4px 16px 2px">Your own rules: when a model reaches a line, the safeguards it needs are added for you, and it is held until the evidence is in.</div>
    <div class="row t3" style="gap:12px;font-size:11.5px;padding:6px 16px 2px"><span class="row" style="gap:5px"><span style="width:16px;height:8px;background:var(--cap);border-radius:2px"></span>Atlas-2.8's skill</span><span class="row" style="gap:5px"><span style="width:2px;height:11px;background:#8da2bd"></span>median expert</span><span class="row" style="gap:5px"><span style="width:2px;height:11px;background:#fff"></span>best human</span><span class="row" style="gap:5px"><span style="height:11px;border-left:2px dashed var(--warn)"></span>the rule's line</span></div>
    <div style="padding:4px 16px 0">${always}${rules}
      <div style="padding:8px 0;border-top:1px solid rgba(36,48,65,.7)">
        <div class="row" style="gap:8px"><b class="w" style="font-size:13.5px">Misalignment signs</b><span class="t3" style="font-size:12px">top of a hidden-goal belief over 30%</span><div class="sp"></div><span class="chip">${ic('octagon-pause', 's12')} holds training</span></div>
        <div class="t3" style="font-size:12px;margin-top:5px">needs: control protocol · only for models able to work around oversight. Atlas-2.8 is not; its <u>Alignment faking</u> top is 32%.</div>
      </div>
    </div>
    <div style="margin-top:auto;padding:10px 16px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:center;font-size:12.5px">
      <span class="t2">${ic('megaphone', 's14')} Publishing it is a public promise: breaking it later is seen.</span><div class="sp"></div><span class="btn sm">Publish</span></div>
  </div>`;
  document.getElementById('body').innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;min-height:0">${matrix}${story}</div>` + fw;
  if (location.hash === '#edit') window.SGEDIT && window.SGEDIT();
})();
