const fs = require('fs');
const rep = (f, pairs) => { let t = fs.readFileSync(f, 'utf8'); for (const [a, b] of pairs) { if (!t.includes(a)) { console.error('MISSING in', f, ':', a.slice(0, 90)); process.exitCode = 1; continue; } t = t.split(a).join(b); } fs.writeFileSync(f, t); };
rep('src/ui/v2/panels/Safety.tsx', [
  ['function UTip({ s, sv, fams, cand, ifU }:', 'function UTip({ s, sv, cand, ifU }:'],
  ['function DetectionCard({ s, sv }:', 'function DetectionCard({ s }:'],
]);
rep('src/ui/v2/shell/TopStrip.tsx', [
  ['safetyView, SLOT_KEYS, understandingBand, upkeepView }', 'safetyView, SLOT_KEYS }'],
  ['  const u = engine.understanding(s);\n  const ev = internalEval(s);\n  const sv = safetyView(s);\n  const band = understandingBand(s);', '  const u = engine.sightLimit(s);\n  const ev = internalEval(s);\n  const sv = safetyView(s);'],
  ['  const up = upkeepView(s);\n', ''],
  ['title="The race: capability vs understanding" value={`${u.margin >= 0 ? \'+\' : \'−\'}${Math.abs(u.margin).toFixed(1)}`}', 'title="Sight limit vs capability" value={`Sight limit L ${F.level(u.L)} (${F.level(u.lo)}–${F.level(u.hi)})`}'],
  ["Teal: <Term id=\"U\">understanding</Term>, the highest level your tools still read. Past teal you are <Term id=\"gap\">flying blind</Term>.</div>", "Teal: your <Term id=\"sightLimit\">sight limit</Term>, the highest level at which your instruments still read the hidden-goal traits at 50% or better (dashed: its range). Gap {F.num(u.gap, 1, true)} levels.</div>"],
  ["      <div className=\"tip-sec\">\n        <div className=\"det-row\"><span className=\"det-lbl\"><ICON.U size={12} /><Term id=\"validatedTo\">Tools validated to</Term></span><span /><span className=\"num\" data-test=\"validated-to\">{up.validatedTo !== undefined ? `L ${F.level(up.validatedTo)}` : '—'}</span></div>\n        <div className=\"small dim\">How far above today's model your tools were re-checked. Understanding can sit lower: it is where detection of the critical traits stays at 50% or more.</div>\n        <div className=\"det-row\"><span className=\"det-lbl\"><ICON.U size={12} /><Term id=\"uRange\">Likely range</Term></span><span /><span className=\"num\" data-test=\"u-range\">L {F.level(band.lo)}–{F.level(band.hi)}</span></div>\n      </div>\n", ''],
  ['<div className="tip-cap">Can your tools see it? detection at L vs 50%</div>', '<div className="tip-cap">Reading at the model\'s level vs 50%</div>'],
  ['<div className="tip-cap">Why understanding moved · last 90 d', '<div className="tip-cap">Why the sight limit moved · last 90 d'],
  ['  const u = engine.understanding(s);\n  const ev = internalEval(s);\n  const L = ev.L;\n  const U = u.U;\n  const band = understandingBand(s);', '  const u = engine.sightLimit(s);\n  const ev = internalEval(s);\n  const L = ev.L;\n  const U = u.L;\n  const band = u;'],
  ['  const gap = u.margin;', '  const gap = u.gap;'],
  ["{gap < 0 ? <ICON.blind size={12} /> : <ICON.check size={12} />} {Math.abs(gap).toFixed(1)} {gap < 0 ? 'BLIND' : 'AHEAD'}", "{gap < 0 ? <ICON.blind size={12} /> : <ICON.check size={12} />} {F.num(gap, 1, true)}"],
  ['<span className="race2-und">UNDERSTANDING <ICON.U size={12} /></span>', '<span className="race2-und">SIGHT LIMIT <ICON.U size={12} /></span>'],
]);
rep('src/ui/v2/panels/Company.tsx', [
  ['  const u = engine.understanding(s);\n', '  const u = engine.sightLimit(s);\n'],
  ["saf: { label: 'Understanding', tag: u.margin < 0 ? { t: `${Math.abs(u.margin).toFixed(1)} behind`, tone: 'bad' } : { t: 'ahead', tone: 'good' }, ref: 'U',", "saf: { label: 'Sight limit', tag: { t: `L ${u.L.toFixed(1)} (${u.lo.toFixed(1)}–${u.hi.toFixed(1)})`, tone: u.gap < 0 ? 'bad' : 'good' }, ref: 'sightLimit',"],
]);
rep('src/ui/v2/panels/CoreLoop.tsx', [
  ["  const u = engine.understanding(s);\n  out.assurance = { text: u.margin >= 0 ? 'ahead' : 'blind', tone: u.margin >= 0.3 ? 'good' : u.margin >= 0 ? 'watch' : 'bad', tip: [{ label: <Term id=\"gap\">Understanding − capability</Term>, value: F.num(u.margin, 1, true) }] };",
   "  const u = engine.sightLimit(s);\n  out.assurance = { text: `sight limit L ${F.level(u.L)}`, tone: u.gap >= 0.3 ? 'good' : u.gap >= 0 ? 'watch' : 'bad', tip: [{ label: <Term id=\"sightLimit\">Sight limit</Term>, value: `L ${F.level(u.L)} (${F.level(u.lo)}–${F.level(u.hi)}) · ${F.num(u.gap, 1, true)} vs capability` }] };"],
]);
rep('src/ui/v2/panels/Overview.tsx', [
  ['    const u = engine.understanding(s);', '    const u = engine.sightLimit(s);'],
  ['{ label: <Term id="U">Understanding</Term>, value: F.level(u.U) }', '{ label: <Term id="sightLimit">Sight limit</Term>, value: `L ${F.level(u.L)} (${F.level(u.lo)}–${F.level(u.hi)})` }'],
  ['understanding {F.level(u.U)}</b>', 'sight limit {F.level(u.L)}</b>'],
]);
rep('src/ui/v2/panels/TraitGraph.tsx', [
  ['  const u = understanding(s);', '  const u = sightLimit(s);'],
]);
rep('src/ui/v2/shell/watch.ts', [['  const u = engine.understanding(s);', '  const u = engine.sightLimit(s);']]);
rep('src/ui/v2/store.ts', [['U: engine.understanding(s).U,', 'U: engine.sightLimit(s).L,']]);
let t = fs.readFileSync('src/ui/v2/panels/TraitGraph.tsx', 'utf8');
t = t.replace(/(import \{[^}]*)\bunderstanding\b([^}]*\} from '..\/..\/..\/engine\/v2')/, '$1sightLimit$2');
fs.writeFileSync('src/ui/v2/panels/TraitGraph.tsx', t);
