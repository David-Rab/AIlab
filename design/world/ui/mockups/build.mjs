// Builds the W8a mockup HTML sources and renders them to PNG with headless Edge.
// Run from the repo root: node design/world/ui/mockups/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const OUT = path.resolve('design/world/ui/mockups');
const KIT = '../../../ux/mockups/kit.css';

// lucide icons (the set the game uses), inlined
const iconCache = {};
function ic(name, cls = '') {
  if (!iconCache[name]) {
    let node;
    try {
      const src = fs.readFileSync(path.resolve(`node_modules/lucide-react/dist/esm/icons/${name}.mjs`), 'utf8');
      node = eval(src.match(/node: (\[[\s\S]*?\n  \])\n\};/)[1]);
    } catch { node = [['circle', { cx: 12, cy: 12, r: 9 }]]; }
    iconCache[name] = node.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  }
  return `<svg class="i ${cls}" viewBox="0 0 24 24">${iconCache[name]}</svg>`;
}
const T = (txt) => `<span class="term">${txt}</span>`;

const NAV = [
  ['overview', 'Overview', 'radar'], ['grp', 'R&D'], ['compute', 'Compute', 'server'], ['lab', 'Lab', 'workflow'], ['research', 'Research', 'flask-conical'],
  ['training', 'Training', 'rocket'], ['models', 'Models', 'brain'], ['products', 'Products', 'boxes'], ['safety', 'Safety', 'microscope'],
  ['grp', 'COMPANY & WORLD'], ['finance', 'Finance', 'landmark'], ['powers', 'Powers', 'handshake', 1], ['world', 'World', 'globe'],
];
const nav = (active) => `<nav class="nav">${NAV.map(([id, label, icon, badge]) => id === 'grp' ? `<div class="grp">${label}</div>` : `<div class="it ${id === active ? 'on' : ''}">${badge ? '<span class="badge" style="background:var(--warn)">1</span>' : ''}${ic(icon, 's20')}<span>${label}</span></div>`).join('')}<div class="sp"></div><div class="it">${ic('book-open', 's20')}<span>Codex</span></div></nav>`;
const stat = (icon, label, v, sub, col = '') => `<div class="stat" style="min-width:150px"><span class="ic">${ic(icon, 's14')}</span><div><div class="l">${label}</div><div class="v num" style="${col}">${v} <span class="t3" style="font-size:11px;font-weight:400">${sub}</span></div></div></div>`;
const top = `<div class="top"><div class="seg" style="gap:8px">${['play', 'pause', 'chevrons-right', 'fast-forward'].map((n) => `<span class="btn sm ghost" style="padding:5px 7px">${ic(n, 's14')}</span>`).join('')}<div style="margin-left:6px"><div class="num w" style="font-size:15px;font-weight:600">Dec 18, 2027</div><div class="tiny t3">Act 3 · Automation</div></div></div>${stat('gauge', 'RESEARCH SPEED', '×6.0', '')}${stat('timer', 'LEAD', '287 d', 'ahead of Xuanmu Lab', 'color:var(--good)')}${stat('wallet', 'CASH · RUNWAY', '$48.4B', '8+ qtrs')}${stat('skull', 'LOSS-OF-CONTROL RISK', '&lt; 0.1%', '')}<div class="sp"></div></div>`;
const bottom = `<div class="bottom"><span class="dchip">${ic('clock', 's14')} 2 to watch · 4 alerts</span><div class="sp"></div><span class="t3 small">${ic('newspaper', 's14')} Washington asks frontier labs for security expectations</span></div>`;

const CSS = `
.body2{display:grid;grid-template-columns:76px minmax(0,1fr);min-height:0}
.center2{padding:12px 14px;display:flex;flex-direction:column;gap:11px;min-height:0;overflow:hidden;position:relative}
.nav .sp{flex:1}
.ph{display:flex;align-items:center;gap:10px}
.ph h1{margin:0;font-size:18px;font-weight:650;color:#fff}
.tabs{display:flex;gap:2px;margin-left:14px;padding:3px;background:var(--bg-2);border:1px solid var(--line);border-radius:8px}
.tabs span{padding:4px 12px;border-radius:6px;font-size:12.5px;color:var(--text-2);font-weight:600}
.tabs span.on{background:#1d2a3b;color:#fff;box-shadow:inset 0 -2px 0 var(--you)}
.cols{display:grid;gap:11px;min-height:0}
.card{padding:11px 14px}
.ghd{display:flex;align-items:center;gap:8px;margin-bottom:9px}
.ghd .ico{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;background:var(--panel-2)}
.ghd b{font-size:14px;color:#fff;font-weight:650}
.ghd .r{margin-left:auto;display:flex;align-items:center;gap:8px}
.big{font:700 24px/1 var(--mono);color:#fff}
.cap2{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);font-weight:600}
.lad{display:flex;flex-direction:column;gap:4px}
.lr{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:10px;padding:9px 10px;border-radius:6px;border:1px solid transparent;color:var(--text-3)}
.lr .n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 11px var(--mono);background:var(--line);color:var(--text-3)}
.lr .nm{font-size:13.5px;font-weight:600;color:var(--text-2)}
.lr .fx{font-size:12px;color:var(--text-3)}
.lr.past .n{background:rgba(159,176,195,.25);color:var(--text)}
.lr.now{background:var(--panel-2);border-color:var(--line-2)}
.lr.now .nm{color:#fff}.lr.now .fx{color:var(--text-2)}
.lr.next{border:1px dashed var(--line-2)}
.lr.now.us .n{background:var(--you);color:#fff}.lr.now.cn .n{background:var(--china);color:#fff}
.lr.now.us{box-shadow:inset 3px 0 0 var(--you)}.lr.now.cn{box-shadow:inset 3px 0 0 var(--china)}
.need{grid-column:2/4;font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:8px}
.hold{flex:1;max-width:120px;height:4px;border-radius:2px;background:var(--line)}.hold i{display:block;height:100%;border-radius:2px;background:var(--warn)}
.laws{display:flex;flex-wrap:wrap;gap:5px}
.law{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid var(--line);color:var(--text-3)}
.law.on{color:#fff;background:var(--panel-2);border-color:var(--line-2)}
.law i{width:6px;height:6px;border-radius:50%;background:var(--line-2)}
.law.on i{background:var(--good)}
.lgrp{font-size:10.5px;color:var(--text-3);letter-spacing:.06em;text-transform:uppercase;margin:9px 0 4px;font-weight:600}
.seg3{display:inline-flex;border:1px solid var(--line-2);border-radius:7px;overflow:hidden}
.seg3 span{padding:4px 12px;font-size:12px;font-weight:600;color:var(--text-2);background:var(--panel-2);border-right:1px solid var(--line-2)}
.seg3 span:last-child{border:0}.seg3 span.on{background:#2f7fd6;color:#fff}
.lever{border:1px solid #36507a;background:rgba(58,138,224,.07);border-radius:8px;padding:8px 10px;margin-top:9px}
.lever .eff{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.sv text{font-family:var(--sans)}
.refc{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px dashed var(--line-2);border-radius:6px;font-size:11.5px;color:#9fc4f0;background:rgba(58,138,224,.05)}
.tile4{display:flex;flex-direction:column;gap:5px;padding:11px 14px;background:var(--panel);border:1px solid var(--line);border-radius:8px}
.tile4 .v{font:700 26px/1 var(--mono);color:#fff}
`;
const page = (title, active, inner, extraBody = '') => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${KIT}"><style>${CSS}</style></head><body><div class="app">${top}<div class="body2">${nav(active)}<main class="center2">${inner}</main></div>${bottom}</div>${extraBody}</body></html>`;

function spark(vals, w, h, col, { fill = false } = {}) {
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - ((v - lo) / sp) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" class="sv">${fill ? `<path d="${d} L${w} ${h} L0 ${h}Z" fill="${col}" opacity=".13"/>` : ''}<path d="${d}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2.6" fill="${col}"/></svg>`;
}
const trend = (txt, cls) => `<span class="trend ${cls}">${txt}</span>`;

// ── Powers home ───────────────────────────────────────────────────────────
function railTrack() {
  const ms = [
    { n: 'Reliable agent', stage: 'stage 1', done: true },
    { n: 'Research agent', stage: 'stage 2 · concern +6', mine: true },
    { n: 'Superhuman coder', stage: 'stage 2' },
    { n: 'Superhuman AI researcher', stage: 'stage 3' },
    { n: 'Superintelligent researcher', stage: 'stage 4 path' },
    { n: 'Superintelligence', stage: '' },
  ];
  const W = 1120, x0 = 80, step = (W - 2 * x0) / 5;
  let s = `<svg width="${W}" height="82" class="sv"><line x1="${x0}" y1="30" x2="${W - x0}" y2="30" stroke="var(--line-2)" stroke-width="3" stroke-linecap="round"/><line x1="${x0}" y1="30" x2="${x0 + step * 0.5}" y2="30" stroke="var(--rival)" stroke-width="3" stroke-linecap="round"/>`;
  ms.forEach((m, i) => {
    const x = x0 + i * step;
    if (m.mine) s += `<circle cx="${x}" cy="30" r="8" fill="var(--bg)" stroke="var(--you)" stroke-width="2.5" stroke-dasharray="3 2.5"/><text x="${x}" y="10" text-anchor="middle" font-size="10.5" fill="var(--you)" font-weight="700">YOURS · INTERNAL</text>`;
    else s += `<circle cx="${x}" cy="30" r="7" fill="${m.done ? 'var(--rival)' : 'var(--bg)'}" stroke="${m.done ? 'var(--rival)' : 'var(--line-2)'}" stroke-width="2.5"/>${m.done ? `<text x="${x}" y="10" text-anchor="middle" font-size="10.5" fill="var(--rival)" font-weight="700">SEEN · ZORVANE</text>` : ''}`;
    s += `<text x="${x}" y="54" text-anchor="middle" font-size="12" fill="${m.done || m.mine ? '#fff' : 'var(--text-2)'}" font-weight="600">${m.n}</text>`;
    if (m.stage) s += `<text x="${x}" y="70" text-anchor="middle" font-size="10.5" fill="var(--text-3)">${m.stage}</text>`;
  });
  return s + '</svg>';
}

function concernBar(hot) {
  const W = 360, X = (v) => (v / 100) * W;
  return `<svg width="${W}" height="66" class="sv" style="overflow:visible" id="concernbar">
  <rect x="0" y="24" width="${W}" height="10" rx="5" fill="var(--line)"/>
  <rect x="${X(70)}" y="24" width="${X(100) - X(70)}" height="10" fill="rgba(239,107,107,.2)"/>
  <rect x="0" y="24" width="${X(55.3)}" height="10" rx="5" fill="var(--warn)" ${hot ? 'stroke="#fff" stroke-width="1.5"' : ''}/>
  <path d="M${X(57.5)} 20 l-4 -7 h8z" fill="none" stroke="var(--warn)" stroke-width="1.6" stroke-dasharray="2 2"/>
  <text x="${X(57.5)}" y="9" text-anchor="middle" font-size="10" fill="var(--warn)">heading to 58</text>
  ${[[50, '50', 0], [70, 'licensing', 0], [75, 'human mandate', 11]].map(([v, l, dy]) => `<line x1="${X(v)}" y1="22" x2="${X(v)}" y2="38" stroke="var(--text-3)"/><text x="${X(v) + (dy ? 14 : 0)}" y="${52 + dy}" text-anchor="middle" font-size="10" fill="var(--text-3)">${l}</text>`).join('')}
  </svg>`;
}
function approvalBar() {
  const W = 360, c = W / 2, x = c + (-13.9 / 100) * c;
  return `<svg width="${W}" height="38" class="sv"><rect x="0" y="10" width="${W}" height="10" rx="5" fill="var(--line)"/><rect x="${x}" y="10" width="${c - x}" height="10" fill="var(--bad)" opacity=".85"/><line x1="${c}" y1="6" x2="${c}" y2="24" stroke="var(--text-2)"/><text x="2" y="34" font-size="10" fill="var(--text-3)">−100</text><text x="${c}" y="34" text-anchor="middle" font-size="10" fill="var(--text-3)">0</text><text x="${W - 2}" y="34" text-anchor="end" font-size="10" fill="var(--text-3)">+100</text></svg>`;
}
function publicCard(hot) {
  return `<section class="card" style="display:flex;flex-direction:column">
  <div class="ghd"><span class="ico" style="color:var(--neutral-actor)">${ic('users', 's14')}</span><b>The public</b></div>
  <div class="row" style="align-items:flex-end;gap:12px"><div><div class="cap2">${T('Concern')}</div><div class="big" style="margin-top:4px">55 <span class="trend up badup" style="font-size:12px;vertical-align:3px">▲ 1.2 · 90 d</span></div></div><div class="sp"></div>${spark([50, 50.4, 51.2, 52.6, 52.4, 53.8, 54.1, 53.9, 54.6, 55.3, 55.0, 55.3], 130, 40, 'var(--warn)', { fill: true })}</div>
  <div style="margin:6px 0">${concernBar(hot)}</div>
  <div class="row" style="align-items:flex-end;gap:12px;margin-top:8px"><div><div class="cap2">${T('Approval of you')}</div><div class="big" style="margin-top:4px;color:var(--bad)">−14 <span class="trend dn" style="font-size:12px;vertical-align:3px">▼ 3.1 · 90 d</span></div></div><div class="sp"></div>${spark([2, 1, -1, -3, -5, -6, -8, -10, -11, -12, -14, -13.9], 130, 40, 'var(--bad)', { fill: true })}</div>
  <div style="margin-top:4px">${approvalBar()}</div>
  <div class="cap2" style="margin:10px 0 5px">What moves with it</div>
  <div class="row small" style="gap:6px;flex-wrap:wrap"><span class="refc">${ic('boxes', 's12')} Product demand</span><span class="refc">${ic('user-plus', 's12')} Hiring pull</span><span class="refc">${ic('factory', 's12')} Site opposition</span></div>
  </section>`;
}
function laws() {
  const L = (name, on) => `<span class="law ${on ? 'on' : ''}"><i></i>${name}</span>`;
  return `<div class="laws">${L('EU AI Act', 1)}${L('California SB 53', 1)}${L('New York RAISE', 1)}${L('SB 243 companions', 1)}${L('Chip exports · case by case', 1)}</div>
  <div class="laws" style="margin-top:5px">${L('Frontier licensing', 0)}${L('Human-in-the-loop', 0)}${L('Worker relief', 0)}${L('Basic income', 0)}${L('Economic zones', 0)}${L('FDA fast track', 0)}</div>`;
}
function usCard() {
  const row = (n, nm, fx, cls, need) => `<div class="lr us ${cls}"><span class="n">${cls === 'past' ? '✓' : n}</span><span class="nm">${nm}</span><span class="fx">${fx}</span>${need ?? ''}</div>`;
  const need2 = `<div class="need"><span>needs ${T('Research agent')} or ${T('Superhuman coder')} seen</span><span class="hold"><i style="width:0%"></i></span><span class="num">0 / 90 d</span></div>`;
  return `<section class="card" style="display:flex;flex-direction:column">
  <div class="ghd"><span class="ico" style="color:var(--neutral-actor)">${ic('landmark', 's14')}</span><b>US government</b><div class="r"><span class="cap2">${T('Trust in you')}</span><span class="num w" style="font-size:16px;font-weight:700">61</span><svg width="70" height="8" class="sv"><rect width="70" height="6" y="1" rx="3" fill="var(--line)"/><rect width="42.7" height="6" y="1" rx="3" fill="var(--good)"/></svg>${trend('▲ 2', 'up')}</div></div>
  <div class="cap2" style="margin-bottom:5px">${T('Security stage')} · what it asks of you</div>
  <div class="lad">
  ${row(0, 'Business as usual', 'no requirements', 'past')}
  ${row(1, 'Security expectations', `industry security floor · you meet it <span class="good">✓</span>`, 'now us')}
  ${row(2, 'Clearances', 'staff clearances, officials embedded', 'next', need2)}
  ${row(3, 'Oversight committee', 'reviews on your launches', '')}
  ${row(4, 'Consolidation', 'labs pooled, or taken over', '')}
  </div>
  <div class="lever">
    <div class="row"><span class="cap2" style="color:#9fc4f0">${ic('eye', 's12')} ${T('What Washington sees of your lab')}</span><span class="sp"></span><span class="seg3"><span>None</span><span class="on">Partial</span><span>Full</span></span></div>
    <div class="tiny t2" style="margin-top:6px">Partial: your internal milestones reach Washington <b class="w">90 d late</b>. Your ${T('Research agent')} (internal, 41 d ago) shows in <b class="w">49 d</b>.</div>
    <div class="eff"><span class="pill gain">Full: seen now · stage 2 hold starts 49 d sooner</span><span class="pill gain">trust +0.5 / month</span></div>
  </div>
  <div class="lgrp">Laws in force</div>
  ${laws()}
  </section>`;
}
function chinaCard() {
  const row = (n, nm, fx, cls) => `<div class="lr cn ${cls}"><span class="n">${cls === 'past' ? '✓' : n}</span><span class="nm">${nm}</span><span class="fx">${fx}</span></div>`;
  const W = 330, X = (m) => (m / 16) * W;
  const lead = `<svg width="${W}" height="64" class="sv" style="overflow:visible"><rect x="0" y="24" width="${W}" height="10" rx="5" fill="var(--line)"/><rect x="0" y="24" width="${X(10.4)}" height="10" rx="5" fill="var(--you)"/>${[[6, 'tension 1'], [9, 'tension 2']].map(([m, l]) => `<line x1="${X(m)}" y1="20" x2="${X(m)}" y2="38" stroke="var(--text-2)"/><text x="${X(m)}" y="51" text-anchor="middle" font-size="10" fill="var(--text-3)">${l}</text><text x="${X(m)}" y="62" text-anchor="middle" font-size="10" fill="var(--text-3)">${m} mo</text>`).join('')}<text x="${X(10.4) + 24}" y="14" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">10.4 mo</text></svg>`;
  return `<section class="card" style="display:flex;flex-direction:column">
  <div class="ghd"><span class="ico" style="color:var(--china)">${ic('flag', 's14')}</span><b>China</b><div class="r"><span class="cap2">${T('US lead over China')}</span>${spark([5.1, 5.8, 6.3, 7.0, 8.2, 9.6, 10.4], 60, 22, 'var(--you)')}</div></div>
  ${lead}
  <div class="cap2" style="margin:6px 0 5px">${T('Tension')} · what it does to you</div>
  <div class="lad">
  ${row(0, 'Competition', '—', 'past')}${row(1, 'Acquisition push', 'more theft attempts', 'past')}${row(2, 'National collective', "China's lab pools compute", 'now')}${row(3, 'Coercion over Taiwan', 'chip shipping at risk', '')}${row(4, 'War footing', 'war risk every quarter', '')}
  </div>
  <div class="cap2" style="margin:10px 0 5px">${T('Talks')}</div>
  <div class="row" style="gap:4px;align-items:flex-start">${['No talks', 'Talks', 'Restraint pact', 'Verified treaty'].map((t, i) => `<div style="flex:1"><div style="height:6px;border-radius:3px;background:${i === 0 ? 'var(--china)' : 'var(--line)'}"></div><div class="tiny ${i === 0 ? 'w' : 't3'}" style="margin-top:3px;font-weight:600">${t}</div></div>`).join('')}</div>
  <div class="tiny t3" style="margin-top:4px">Open after a scare, or when the lead is small and Washington proposes them.</div>
  <div class="cap2" style="margin:10px 0 4px">${T('Treaty')}</div><div class="small t2">None. A verified treaty caps every lab's AI R&amp;D compute and ends the race.</div>
  <div class="sp"></div>
  <div class="row small" style="gap:6px;margin-top:8px"><span class="refc">${ic('ship', 's12')} Taiwan shipping</span><span class="refc">${ic('key-round', 's12')} Theft flows</span></div>
  </section>`;
}
function pledgesCard() {
  const rows = [['Pre-deploy testing', 'binding now', 'warn', true], ['Whistleblower channel', 'kept since Mar 2027', 'good', false]];
  return `<section class="card" style="flex:1">
  <div class="ghd"><span class="ico" style="color:var(--text-2)">${ic('scroll-text', 's14')}</span><b>${T('Pledges')} &amp; obligations</b><div class="r"><span class="small t3">kept <b class="w num">100%</b></span></div></div>
  <div style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;flex-direction:column;gap:7px">
    ${rows.map((r) => `<div class="row" style="padding:6px 10px;border:1px solid ${r[3] ? 'rgba(233,180,76,.45)' : 'var(--line)'};border-radius:7px;background:${r[3] ? 'rgba(233,180,76,.06)' : 'transparent'}"><span style="font-weight:600">${r[0]}</span><span class="small ${r[2]}">${r[1]}</span><span class="sp"></span>${r[3] ? '<span class="btn sm">Honour</span><span class="btn sm ghost">Amend</span><span class="btn sm ghost" style="color:var(--bad)">Break</span>' : ''}</div>`).join('')}
    </div>
    <div><div class="cap2" style="margin-bottom:5px">Make a pledge</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="btn sm go">Publish framework</span><span class="pill gain">approval ▲</span><span class="pill gain">trust ▲</span></div>
      <div class="tiny t3" style="margin-top:6px">A broken pledge costs approval (× your prominence) and trust.</div></div>
  </div></section>`;
}
function powers({ hot = false } = {}) {
  return `<div class="ph">${ic('handshake', 's20')}<h1>Powers</h1><span class="t3 small">Washington · Beijing · the public</span></div>
  <section class="card" style="padding:9px 14px"><div class="row" style="gap:18px;align-items:center">
    <div style="width:150px;flex-shrink:0"><div class="cap2">${T('Your prominence')}</div><div class="big" style="margin-top:3px">0.82</div><svg width="130" height="8" class="sv" style="margin-top:5px"><rect width="130" height="6" y="1" rx="3" fill="var(--line)"/><rect width="106" height="6" y="1" rx="3" fill="var(--you)"/><line x1="65" x2="65" y1="-1" y2="9" stroke="var(--text-2)"/></svg><div class="tiny t3" style="margin-top:3px">Washington's rules apply to you</div></div>
    <div style="flex:1;min-width:0"><div class="cap2" style="margin-bottom:2px">What the world has seen · ${T('public frontier')}</div>${railTrack()}</div></div></section>
  <div class="cols" style="grid-template-columns:1fr 1.22fr 1.05fr;flex:1"><div style="display:flex;flex-direction:column;gap:11px">${publicCard(hot)}${pledgesCard()}</div>${usCard()}${chinaCard()}</div>`;
}

// ── tooltip overlay: concern why, with a nested child ─────────────────────
const bars = [['Starting level', '50', 100, 'var(--line-2)'], ['Milestones the world has seen', '+6', 60, 'var(--bad)'], ['Unemployment rise · 12 mo', '+0.1', 3, 'var(--bad)'], ['Public incidents', '+1.4', 14, 'var(--bad)']];
const tipHtml = `
<div class="tip" style="left:490px;top:262px;width:376px;z-index:60">
  <div class="th"><b>${T('Concern')}</b><span class="num w" style="font-size:16px;font-weight:700">55</span><span class="trend up badup">▲ 1.2 · 90 d</span><span class="sp"></span><span class="t3 tiny">heading to 57.5</span></div>
  <div class="tiny t2" style="margin-bottom:6px">Share of the public more worried than excited about AI. It drifts to its target, halving the gap every 3 months.</div>
  <div class="sec"><div class="cap2" style="margin-bottom:5px">Why the target is 57.5</div>
    ${bars.map(([l, v, w, c], i) => `<div class="row small" style="padding:3px 0"><span style="width:196px">${i === 3 ? '<span class="term" style="background:rgba(90,169,255,.2);border-radius:3px;padding:0 3px">Public incidents</span>' : l}</span><span style="flex:1;height:7px;background:var(--line);border-radius:3px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${w}%;background:${c};border-radius:3px"></i></span><span class="num w" style="width:40px;text-align:right">${v}</span></div>`).join('')}
  </div>
  <div class="sec"><div class="cap2" style="margin-bottom:4px">What it triggers</div>
    <div class="row small"><span class="law"><i></i>Frontier licensing</span><span class="t2">above 70 for 90 d</span><span class="sp"></span><span class="num t2">15 below</span></div>
    <div class="row small" style="margin-top:4px"><span class="law"><i></i>Human-in-the-loop</span><span class="t2">above 75 after a scare</span><span class="sp"></span><span class="num t2">20 below</span></div></div>
  <div class="sec row tiny t3">12 months ${spark([50, 50.4, 51.2, 52.6, 52.4, 53.8, 54.1, 53.9, 54.6, 55.3, 55.0, 55.3], 150, 20, 'var(--warn)')}<span class="sp"></span><span class="kbd">Alt</span> lock</div>
  <div class="lockbar"></div>
</div>
<div class="tip" style="left:882px;top:330px;width:330px;z-index:61;border-color:#6d86b3">
  <div class="th"><b>${T('Public incidents')}</b><span class="num w" style="font-size:15px;font-weight:700">0.7</span><span class="t3 tiny">weight now</span></div>
  <div class="tiny t2" style="margin-bottom:6px">Incidents any lab disclosed or leaked, weighted by severity. Each fades with a half-life of about 6 months.</div>
  <div class="sec">
    ${[['Pellory leaked chat logs', 'sev 3', 'Sep 2027', 'var(--warn)', 62], ['Lanternworks model hijacked a trial', 'sev 4', 'Jun 2027', 'var(--bad)', 38], ['Your disclosed eval failure', 'sev 2', 'Oct 2027', 'var(--warn)', 78]].map(([l, s, d, c, f]) => `<div class="small" style="padding:3px 0"><div class="row"><span>${l}</span><span class="sp"></span><span class="num t2">${s}</span></div><div class="row tiny t3"><span style="width:56px">${d}</span><span style="flex:1;height:4px;background:var(--line);border-radius:2px"><i style="display:block;height:100%;width:${f}%;background:${c};border-radius:2px"></i></span><span class="num" style="margin-left:6px;width:60px;text-align:right">${f}% left</span></div></div>`).join('')}
  </div>
  <div class="sec tiny t3">Also moves ${T('approval')} of the lab that had it, × its prominence.</div>
</div>`;

// ── trimmed World tab ─────────────────────────────────────────────────────
function history() {
  const W = 760, H = 150, N = 29, ux = [], ai = [];
  for (let i = 0; i < N; i++) { ux.push(4.2 + 0.08 * Math.sin(i / 3) + (i > 24 ? 0.04 * (i - 24) : 0)); ai.push(0.3 + 2.7 * Math.pow(i / (N - 1), 2.2)); }
  const px = (i) => 36 + (i / (N - 1)) * (W - 50);
  const line = (a, lo, hi, c) => '<path d="' + a.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + (H - 24 - ((v - lo) / (hi - lo)) * (H - 40)).toFixed(1)).join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
  const grid = [0, 1, 2, 3, 4, 5].map((g) => '<line x1="36" x2="' + (W - 14) + '" y1="' + (H - 24 - (g / 5) * (H - 40)) + '" y2="' + (H - 24 - (g / 5) * (H - 40)) + '" stroke="var(--line)"/><text x="30" y="' + (H - 20 - (g / 5) * (H - 40)) + '" text-anchor="end" font-size="10" fill="var(--text-3)">' + g + '%</text>').join('');
  const xl = [['Jul 2025', 0], ['2026', 6], ['Jul 2026', 12], ['2027', 18], ['Dec 2027', 27]].map(([t, i]) => '<text x="' + px(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--text-3)">' + t + '</text>').join('');
  return '<svg width="' + W + '" height="' + H + '" class="sv">' + grid + xl + line(ux, 0, 5, 'var(--bad)') + line(ai, 0, 5, 'var(--und)') + '</svg>';
}
function worldWork() {
  const tile = (label, v, unit, tr, trc, data, col, sub) => `<div class="tile4"><div class="cap2">${T(label)}</div><div class="row" style="align-items:flex-end"><span class="v">${v}<span class="t3" style="font-size:13px;font-weight:500">${unit}</span></span><span class="sp"></span>${spark(data, 120, 36, col, { fill: true })}</div><div class="row tiny"><span class="trend ${trc}">${tr}</span><span class="t3">${sub}</span></div></div>`;
  const sectors = [['Software and IT', 25, 19, 17], ['Admin, clerical, customer service', 14, 10, 9], ['Finance, insurance, accounting', 13, 10, 9], ['Legal and compliance', 12, 8, 8], ['Creative, media, marketing', 17, 12, 11], ['Science and engineering R&D', 13, 9, 8], ['Healthcare', 3, 2, 2], ['Education', 9, 6, 6], ['Government administration', 6, 4, 4], ['Military and defense', 4, 3, 2], ['Manufacturing', 5, 3, 3], ['Transport and logistics', 3, 2, 2], ['Energy and utilities', 3, 2, 2], ['Retail and hospitality', 3, 2, 2]];
  const cell = (v) => `<td style="padding:0"><div style="margin:2px 1px;height:30px;border-radius:3px;background:rgba(34,163,148,${(0.1 + Math.min(1, v / 26) * 0.85).toFixed(2)});font:600 12px/30px var(--mono);text-align:center;color:#fff">${v}%</div></td>`;
  const barRow = (l, v, t, txt) => `<div class="row small" style="margin:6px 0"><span style="width:116px">${T(l)}</span><span style="flex:1;height:8px;background:var(--line);border-radius:4px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${v}%;background:var(--und);border-radius:4px"></i><b style="position:absolute;top:-3px;bottom:-3px;width:2px;left:${t}%;background:#fff"></b></span><span class="num" style="width:112px;text-align:right">${txt}</span></div>`;
  return `<div class="ph">${ic('globe', 's20')}<h1>World</h1><span class="t3 small">AI at work, jobs, technology</span><div class="tabs"><span class="on">Work</span><span>Risk</span><span>Tech &amp; control</span></div></div>
  <div class="cols" style="grid-template-columns:repeat(4,1fr)">
    ${tile('Unemployment · US', '4.3', '%', '▲ 0.02 pp · 12 mo', 'up badup', [4.2, 4.2, 4.25, 4.3, 4.27, 4.3, 4.28, 4.3], 'var(--bad)', 'youth 11.1%')}
    ${tile('GDP growth', '2.9', '%', '▲ 0.4 pp · 12 mo', 'up', [2.0, 2.1, 2.2, 2.4, 2.5, 2.4, 2.7, 2.9], 'var(--good)', 'US, real, yearly')}
    ${tile('AI share of income', '0.2', '%', '▲ 0.1 pp · 12 mo', 'up', [0, 0.02, 0.04, 0.06, 0.08, 0.12, 0.16, 0.2], 'var(--rival)', 'AI revenue ÷ GDP')}
    ${tile('Work done by AI', '3.0', '%', '▲ 1.8 pp · 12 mo', 'up', [0.4, 0.6, 0.9, 1.2, 1.7, 2.2, 2.6, 3.0], 'var(--und)', 'US, share of hours')}
  </div>
  <div class="cols" style="grid-template-columns:1.05fr 1fr;flex:1;align-items:start">
    <section class="card"><div class="hd"><span class="ttl capt">Sectors</span><span class="sp"></span><span class="seg3"><span class="on">Hours of use</span><span>Automated</span><span>Your share</span></span></div>
      <table style="width:100%;border-collapse:collapse"><tr class="tiny t3"><td></td><td style="text-align:center;padding-bottom:3px">US</td><td style="text-align:center">China</td><td style="text-align:center">Rest</td></tr>
      ${sectors.map(([n, a, b, c], i) => `<tr style="${i === 0 ? 'outline:1.5px solid #fff;outline-offset:-1px' : ''}"><td class="small" style="padding:0 8px 0 2px;white-space:nowrap">${n}</td>${cell(a)}${cell(b)}${cell(c)}</tr>`).join('')}</table></section>
    <div style="display:flex;flex-direction:column;gap:11px;min-height:0">
      <section class="card"><div class="hd"><span class="ttl">Software and IT · US</span><span class="sp"></span><span class="tag" style="color:var(--warn);border-color:rgba(233,180,76,.5)">binding: diffusion</span></div>
        ${barRow('Workers using AI', 74, 81, '74%')}${barRow('Hours of use', 25, 52, '25.1% of hours')}${barRow('Automated', 13, 52, '13.0% → 51.9%')}
        <div class="row small" style="margin-top:10px;gap:6px"><span class="t3">Limits</span><span class="pill neu">capability 57%</span><span class="pill neu">cost 95%</span><span class="pill neu">friction 95%</span><span class="sp"></span><span class="refc">Providers · your share ›</span></div></section>
      <section class="card"><div class="hd"><span class="ttl capt">Jobs</span><span class="sp"></span><span class="refc"><i class="dot" style="background:var(--line-2)"></i>Worker relief · not in force</span></div>
        ${[['US', 4.3], ['China', 5.2], ['Rest of world', 5.5]].map(([r, v]) => `<div class="row small" style="margin:6px 0"><span style="width:150px">Unemployment · ${r}</span><span style="flex:1;height:7px;background:var(--line);border-radius:4px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${v * 4}%;background:var(--bad);border-radius:4px"></i></span><span class="num" style="width:44px;text-align:right">${v}%</span></div>`).join('')}
        <div class="row small" style="margin:6px 0">${T('Displaced workers')} · US<span class="sp"></span><span class="num">35K people</span></div>
        <div class="row small" style="margin:6px 0;border-top:1px solid var(--line);padding-top:9px">${T('Transition fund')}<span class="num w" style="margin-left:6px">$5.0B / yr</span><span class="sp"></span><svg width="110" height="14" class="sv"><rect y="5" width="110" height="4" rx="2" fill="var(--line-2)"/><circle cx="14" cy="7" r="6" fill="var(--you)"/></svg><span class="btn sm">Set</span></div>
      </section>
      <section class="card" style="flex:1"><div class="hd"><span class="ttl capt">Since July 2025</span><span class="sp"></span><span class="small t2"><i class="dot" style="background:var(--bad)"></i> unemployment, US &nbsp; <i class="dot" style="background:var(--und)"></i> work done by AI</span></div>${history()}</section>
    </div></div>`;
}
function worldTech() {
  const techs = [['Protein structure and design', 1, 'd'], ['ML weather forecasting', 1, 'd'], ['AI drug-candidate pipeline', 0.8, 'r'], ['Autonomous labs', 0.05, 'r'], ['In-silico trials', 0, 'l'], ['New antibiotics and antivirals', 0, 'l'], ['Cancer therapeutics wave', 0, 'l'], ['Precision gene editing', 0.02, 'r'], ['AI chip-design automation', 0.1, 'r'], ['Automated mathematics', 0.5, 'r'], ['Enhanced pathogen design', 0.4, 'r'], ['Grid-scale storage', 0, 'l'], ['Fusion', 0, 'l'], ['General-purpose robotics', 0, 'l']];
  const ctl = [['Economy', 3], ['Government', 7], ['Military', 2], ['Infrastructure', 7]];
  return `<div class="ph">${ic('globe', 's20')}<h1>World</h1><span class="t3 small">AI at work, jobs, technology</span><div class="tabs"><span>Work</span><span>Risk</span><span class="on">Tech &amp; control</span></div></div>
  <div class="cols" style="grid-template-columns:1.6fr 1fr">
  <section class="card"><div class="hd"><span class="ttl capt">${T('Control index')}</span><span class="sp"></span><span class="small t2">you 0.6%</span></div>
  ${ctl.map(([d, p]) => `<div class="row small" style="margin:8px 0"><span style="width:100px">${d}</span><span style="flex:1;height:12px;background:var(--line);border-radius:3px;position:relative;overflow:hidden"><i style="position:absolute;left:0;top:0;bottom:0;width:${p * 5}%;background:repeating-linear-gradient(45deg,var(--rival) 0 4px,var(--you) 4px 8px);border-radius:3px"></i>${[10, 30, 60].map((t) => `<b style="position:absolute;left:${t}%;top:0;bottom:0;width:1px;background:var(--text-3)"></b>`).join('')}</span><span class="num" style="width:36px;text-align:right">${p}%</span></div>`).join('')}
  <div class="tiny t3" style="margin-top:4px">Ticks: entrenched · indispensable · decisive</div></section>
  <section class="card"><div class="hd"><span class="ttl capt">${T('Robots')}</span></div><div class="row" style="align-items:flex-end"><span class="big">22K<span class="t3" style="font-size:13px"> / month</span></span><span class="sp"></span>${spark([1, 2, 3, 5, 8, 12, 17, 22], 150, 40, 'var(--und)', { fill: true })}</div><div class="row tiny t3" style="margin-top:8px;gap:6px">Built worldwide · <span class="refc">Economic zones · not in force</span></div></section>
  </div>
  <section class="card"><div class="hd"><span class="ttl capt">${T('World technologies')}</span><span class="sp"></span><span class="small t3">discovered · ramping · locked</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${techs.map(([n, p, st], i) => `<div style="padding:9px 12px 10px;border:1px solid ${st === 'r' ? '#36507a' : st === 'd' ? 'rgba(76,195,138,.4)' : 'var(--line)'};border-radius:7px;opacity:${st === 'l' ? 0.6 : 1};min-height:78px"><div class="small" style="font-weight:600;color:#fff">${n}</div><div class="tiny t3" style="margin:3px 0 8px">${st === 'd' ? 'in use since ' + ['Mar 2026', 'Aug 2026'][i % 2] : st === 'r' ? 'ramping · ' + Math.round(p * 100) + '%' : 'locked · needs ' + ['Autonomous labs', 'AI drug-candidate pipeline', 'AI chip-design automation'][i % 3]}</div><div style="height:5px;background:var(--line);border-radius:3px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(p, 0.03) * 100}%;background:${st === 'd' ? 'var(--good)' : 'var(--you)'};border-radius:3px"></i></div></div>`).join('')}</div>
  <div class="row small" style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px">${T('Moonshot')}<span class="t2" style="margin-left:6px">auto · 3% of compute · from serving, max 30%</span><span class="sp"></span><svg width="140" height="14" class="sv"><rect y="5" width="140" height="4" rx="2" fill="var(--line-2)"/><circle cx="20" cy="7" r="6" fill="var(--you)"/></svg><span class="btn sm">Launch</span></div></section>`;
}

const files = {
  'powers-home': page('Powers', 'powers', powers()),
  'powers-tooltip-why': page('Powers · hover', 'powers', powers({ hot: true }), tipHtml),
  'world-work': page('World · Work', 'world', worldWork()),
  'world-tech': page('World · Tech and control', 'world', worldTech()),
};
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, html] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
  const pg = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  await pg.goto('file:///' + path.join(OUT, `${name}.html`).split(path.sep).join('/'));
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: path.join(OUT, `${name}.png`) });
  await pg.close();
  console.log('rendered', name);
}
await browser.close();
