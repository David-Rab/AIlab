// SAFETY › Incidents & cases (SAFETY-REDESIGN §3.6–3.7; UI-IA SAFETY Incidents & cases row). Day 900 (the day-400
// fixture has no incidents): data900c-inc.json incidents (apparent cause, severity, status, cause-aware response
// options), case preview (casePreview on Atlas-4.0, Scheming + Alignment faking, 20 engineers), spend (spare staff).
// Provenance: DATA-c.md.
(function () {
  const { ic } = window.C;
  const RUN = location.hash === '#running';
  document.getElementById('main').innerHTML = window.SAFHEAD(900, 'Incidents') + '<div class="body2" id="body" style="grid-template-columns:minmax(0,1fr) 560px"></div>';
  const D0 = Date.UTC(2025, 6, 1);
  const date = (d) => new Date(D0 + d * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  // [day, model, act lane, severity 1–5, where, status]
  const I = [[470, '3.0', 0, 4, 'staff', 'open'], [490, '3.0', 0, 3, 'staff', 'open'], [511, '3.3', 3, 2, 'API', 'leaked'], [606, '3.7', 0, 3, 'staff', 'open'], [613, '3.7', 0, 3, 'staff', 'open'],
    [618, '3.5', 0, 4, 'staff', 'open'], [648, '3.5', 1, 3, 'staff', 'open'], [731, '4.0', 0, 4], [749, '4.0', 0, 3], [760, '4.0', 0, 4], [768, '3.5', 2, 1, 'Enterprise', 'leaked'], [773, '4.0', 1, 3],
    [782, '4.0', 3, 3], [809, '4.0', 1, 3], [828, '4.0', 0, 3], [830, '4.0', 0, 3], [844, '4.0', 0, 3], [869, '4.0', 0, 3], [876, '4.0', 0, 3], [879, '4.0', 0, 4], [888, '4.0', 0, 4],
    [893, '4.0', 0, 3], [896, '4.0', 0, 4], [896, '4.0', 0, 3], [898, '4.0', 0, 4], [898, '4.0', 0, 3]];
  const LANES = [['Works around oversight', 'Scheming'], ['Games tests and graders', 'Reward hacking'], ['Hides its mistakes', 'Concealment'], ['Unexplained', 'no apparent trait']];
  const SEV = ['Minor', 'Serious', 'Severe', 'Critical', 'Catastrophic'], SC = ['#8da2bd', '#e9b44c', '#ef8a5b', '#ef6b6b', '#d63a6a'];
  const W = 980, LX = 230, x0 = 450, x1 = 905, X = (d) => LX + ((d - x0) / (x1 - x0)) * (W - LX - 20), LH = 30;
  const months = []; for (let m = 0; m < 15; m++) { const dt = Date.UTC(2026, 9 + m, 1); const d = Math.round((dt - D0) / 864e5); if (d >= x0 && d <= x1) months.push([d, new Date(dt).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + (m % 12 === 3 ? ' 2027' : '')]); }
  const dots = I.map(([d, m, l, s, wh, st]) => { const y = 14 + l * LH + LH / 2, r = 3 + s; const cur = m === '4.0'; return `<circle cx="${X(d)}" cy="${y}" r="${r}" fill="${cur ? SC[s - 1] : 'none'}" stroke="${SC[s - 1]}" stroke-width="${cur ? 1 : 2}" fill-opacity="${cur ? 0.85 : 0}"/>${st === 'leaked' ? `<circle cx="${X(d)}" cy="${y}" r="${r + 4}" fill="none" stroke="#fff" stroke-dasharray="2 2"/>` : ''}`; }).join('');
  const cnt = LANES.map((_, l) => I.filter((i) => i[2] === l).length);
  const tl = `<svg width="${W}" height="${14 + 4 * LH + 22}" style="display:block">
    ${LANES.map(([a, t], l) => `<line x1="${LX}" y1="${14 + l * LH + LH / 2}" x2="${W - 20}" y2="${14 + l * LH + LH / 2}" stroke="#243041"/><text x="0" y="${14 + l * LH + LH / 2 - 1}" fill="#fff" font-size="13" font-family="Segoe UI, sans-serif">${a}</text><text x="0" y="${14 + l * LH + LH / 2 + 12}" fill="#6b7c91" font-size="10.5" font-family="Segoe UI, sans-serif">${t}</text><text x="${LX - 14}" y="${14 + l * LH + LH / 2 + 4}" fill="#fff" font-size="13" text-anchor="end" font-family="Cascadia Mono, Consolas, monospace" font-weight="600">${cnt[l]}</text>`).join('')}
    ${months.map(([d, n]) => `<line x1="${X(d)}" y1="10" x2="${X(d)}" y2="${14 + 4 * LH}" stroke="#1b2430"/><text x="${X(d)}" y="${14 + 4 * LH + 16}" fill="#6b7c91" font-size="10.5" text-anchor="middle" font-family="Segoe UI, sans-serif">${n}</text>`).join('')}
    <line x1="${X(872)}" y1="6" x2="${X(872)}" y2="${14 + 4 * LH}" stroke="#e9b44c" stroke-dasharray="3 3"/><text x="${X(872) - 4}" y="9" fill="#e9b44c" font-size="10.5" text-anchor="end" font-family="Segoe UI, sans-serif">training held</text>
    ${dots}</svg>`;
  const legend = `<div class="row" style="gap:14px;font-size:12px;color:var(--text-2);flex-wrap:wrap">${SEV.slice(0, 4).map((s, i) => `<span class="row" style="gap:5px"><svg width="${2 * (4 + i) + 2}" height="${2 * (4 + i) + 2}"><circle cx="${5 + i}" cy="${5 + i}" r="${4 + i}" fill="${SC[i]}"/></svg>${s}</span>`).join('')}<span class="t3">·</span><span class="row" style="gap:5px"><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#8da2bd"/></svg>Atlas-4.0</span><span class="row" style="gap:5px"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#8da2bd" stroke-width="2"/></svg>earlier models</span><span class="row" style="gap:5px"><svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="none" stroke="#fff" stroke-dasharray="2 2"/></svg>went public</span></div>`;
  const tlCard = `<div class="card" style="flex:0 0 auto;padding-bottom:10px">
    <div class="hd"><span class="ttl">${ic('siren', 's16')} Incidents by apparent cause</span><span class="q">26 since Oct 2026 · <b class="w">24 open</b>, none investigated · 2 went public</span><div class="sp"></div>${legend}</div>
    <div style="padding:8px 16px 0">${tl}</div></div>`;
  const resp = (icon, what, pre, act, done) => `<div style="display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:8px;align-items:center;padding:3px 0;border-top:1px solid rgba(36,48,65,.7);font-size:13px">
      <span class="t3">${ic(icon, 's14')}</span><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="w">${what}</span> <span class="t3" style="font-size:12px">· ${pre}</span></div>${done ? `<span class="chip good">${ic('check', 's12')} on</span>` : `<span class="btn sm ${act === 'pri' ? 'pri' : ''}" style="padding:2px 9px">${act === 'pri' ? 'Open case' : act}</span>`}</div>`;
  const grp = (sev, title, n, where, sevs, cause, guess, body) => `<div class="card" style="padding:9px 16px">
    <div class="row" style="gap:10px"><span style="width:10px;height:10px;border-radius:50%;background:${SC[sev - 1]}"></span><b class="w" style="font-size:14px">${title}</b><span class="t3" style="font-size:12.5px">${where}</span><div class="sp"></div><span class="mono w" style="font-size:13px">${n} open</span><span class="t3" style="font-size:12px">${sevs}</span><span class="link sm">act row ${ic('chevron-right', 's12')}</span></div>
    <div class="row" style="gap:8px;margin:3px 0 3px;font-size:12.5px"><span class="t2">Apparent cause:</span><b class="w">${cause}</b><span class="t3">${guess}</span></div>
    ${body}</div>`;
  const g1 = grp(4, 'Atlas-4.0 · Works around oversight', 15, 'AI staff work · Jul 2 – Dec 16', '6 Critical · 9 Severe', 'a trait in this model', '(a guess until a case confirms it)',
    resp('search', 'Open a case: "Is Atlas-4.0 scheming?"', '~2 d · 20 engineers · 5.2k H100e', 'pri')
    + resp('lock', 'Comms lockdown on its AI staff', 'copies cover for each other half as much · slowdown 3% of AI staff work', 'Add')
    + resp('syringe', 'Add a method to later runs', 'shows in the next run\'s predicted beliefs · frontier training is held now', 'Add')
    + resp('undo-2', 'Roll back to Atlas-3.7', 'loses Atlas-4.0 · AI staff run on Atlas-3.7', 'Roll back')
    + resp('shield', 'Control protocol', 'defer 10% to trusted · already on', '', true));
  const g2 = grp(3, 'Atlas-4.0 · Games tests and graders', 2, `AI staff work · ${date(773)}, ${date(809)}`, '2 Severe', 'a training signal', '(an exploitable grader or environment)',
    resp('hammer', 'Harden environments', 'cuts the loopholes in that environment family for every later run · Training › Environments', 'Harden'));
  const g3 = grp(3, 'Atlas-4.0 · Unexplained', 1, 'AI staff work · Aug 22', '1 Severe', 'unknown', '(a case can name it; contain meanwhile)',
    resp('search', 'Open a case on this incident', '~2 d · 20 engineers', 'Open case') );
  const older = `<div class="card row" style="padding:10px 16px;gap:10px;font-size:13px"><span class="t3">${ic('history', 's14')}</span><span class="w">Earlier models</span><span class="t2">6 open on Atlas-3.0, 3.5, 3.7 · 2 went public (Atlas-3.3 API, Atlas-3.5 Enterprise)</span><div class="sp"></div><span class="link sm">show ${ic('chevron-down', 's12')}</span></div>`;
  const left = `<div style="display:flex;flex-direction:column;gap:10px;min-height:0">${tlCard}${g1}${g2}${g3}${older}</div>`;
  // cases
  const inst = [['scan-eye', 'Linear probes'], ['scan-eye', 'Deception probe'], ['clipboard-check', 'Propensity evals'], ['clipboard-check', 'Model organisms'], ['message-square-text', 'CoT monitor']];
  const caseCard = `<div class="card" style="padding:12px 16px;${RUN ? '' : 'border-style:dashed;border-color:#36507a;background:rgba(58,138,224,.05)'}">
    <div class="row" style="gap:8px"><span class="chip ${RUN ? 'good' : ''}">${RUN ? `${ic('loader', 's12')} running` : 'draft'}</span><b class="w" style="font-size:14px">Is Atlas-4.0 scheming?</b><div class="sp"></div>${RUN ? '<span class="mono w" style="font-size:12.5px">~1 d left</span>' : ''}</div>
    <div class="t3" style="font-size:12px;margin:3px 0 8px">Scheming, Alignment faking · from the 15 incidents above</div>
    ${RUN ? '<div class="pbar" style="margin-bottom:10px"><i style="width:50%"></i></div>' : ''}
    <div style="display:grid;grid-template-columns:112px minmax(0,1fr);gap:7px 10px;font-size:12.5px">
      <span class="t2">Instruments</span><span class="row" style="gap:4px;flex-wrap:wrap">${inst.map(([i, n]) => `<span class="kch">${ic(i, 's12')} ${n}</span>`).join('')}</span>
      <span class="t2"><u>Can find</u></span><span>readings on both traits · 17 kinds of <u>new failure mode</u>, if present · footholds of the Atlas-4 family · a false instrument (3 independent kinds cross-check)</span>
      <span class="t2">Shows a present goal</span><span><b class="mono w">39%</b> <span class="t3">of the time (the instruments together)</span></span>
      <span class="t2">Belief now</span><span>Scheming <b class="mono w">45%</b> <span class="t3 mono">35–55</span> · Alignment faking <b class="mono w">50%</b> <span class="t3 mono">36–63</span><div class="t3" style="font-size:11.5px">already narrow: the case mostly checks the instruments and looks for footholds</div></span>
      <span class="t2">Takes</span><span class="mono w">~2 d · 20 engineers · 5.2k H100e <span class="t3" style="font-family:var(--sans)">· AI share 0%</span></span>
    </div>
    ${RUN ? '' : `<div class="row" style="margin-top:10px;gap:8px"><span class="t3" style="font-size:12px">The verdict will say what changed.</span><div class="sp"></div><span class="btn sm">Edit</span><span class="btn pri sm">${ic('search', 's14')} Open case</span></div>`}
  </div>`;
  const cases = `<div class="card fl" style="flex:1;padding-bottom:12px">
    <div class="hd"><span class="ttl">${ic('search', 's16')} <u>Cases</u></span><span class="q">${RUN ? '1 running' : 'none open'}</span><div class="sp"></div><span class="link sm">Safety staff: <b>spare</b> ${ic('chevron-right', 's12')}</span></div>
    <div class="row" style="gap:8px;padding:8px 16px 10px;font-size:13px"><span class="warn">${ic('triangle-alert', 's14')}</span><span>${RUN ? '<b class="w">70</b> of 100 safety research engineers spare.' : '<b class="w">90</b> of 100 safety research engineers are spare, with 24 incidents open.'}</span></div>
    <div style="padding:0 16px">${caseCard}</div>
  </div>`;
  const disc = `<div class="card" style="padding:12px 16px">
    <div class="row" style="gap:8px"><span class="ttl" style="font-size:15px;font-weight:650;color:#fff;display:flex;gap:8px;align-items:center">${ic('megaphone', 's16')} <u>Disclosure</u></span><div class="sp"></div>
      <div class="tabs" style="padding:2px"><span class="t on" style="padding:3px 10px;font-size:12.5px">Legal minimum</span><span class="t" style="padding:3px 10px;font-size:12.5px">Full</span><span class="t" style="padding:3px 10px;font-size:12.5px">None</span></div></div>
    <div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 10px;margin-top:10px;font-size:12.5px">
      <b class="mono w">0</b><span class="t2">of 24 open must be reported: all stayed inside the lab</span>
      <b class="mono w">2</b><span class="t2">went public before you chose (customers saw them)</span>
    </div>
    <div class="t3" style="font-size:12px;margin-top:6px">Fixing and disclosing are separate: a fix never hides an incident.</div>
  </div>`;
  document.getElementById('body').innerHTML = left + `<div style="display:flex;flex-direction:column;gap:12px;min-height:0">${cases}${disc}</div>`;
})();
