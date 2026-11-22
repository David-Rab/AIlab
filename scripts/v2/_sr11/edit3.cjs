const fs = require('fs');
const rep = (f, pairs) => { let t = fs.readFileSync(f, 'utf8'); for (const [a, b] of pairs) { if (!t.includes(a)) { console.error('MISSING in', f, ':', a.slice(0, 90)); process.exitCode = 1; continue; } t = t.split(a).join(b); } fs.writeFileSync(f, t); };
const f = 'src/ui/v2/panels/Safety.tsx';
rep(f, [
  ['beliefView, dateOf, detectionGrid,', 'beliefView, dateOf, sightGrid, sightLimit,'],
  ['teamsOn, understanding, versionById,', 'teamsOn, versionById,'],
  ["/** The family U depends on that the tools see least (deception or power). */\nconst weakFamily = (fams: Fams) => [...fams].filter((f) => f.critical).sort((a, b) => a.seenTo - b.seenTo)[0];",
   "/** A family's mean reading over its hidden-goal traits at the model's level (the sight limit's drill-down). */\nconst famRead = (f: Fams[number], pt: Partial<Record<TraitId, number>>) => { const ks = f.traits.filter((k) => CRITICAL_TRAITS.includes(k)); return ks.length ? ks.reduce((a, k) => a + (pt[k] ?? 0), 0) / ks.length : 1; };\n/** The hidden-goal family your instruments read least at the model's level (deception or power). */\nconst weakFamily = (fams: Fams, pt: Partial<Record<TraitId, number>>) => [...fams].filter((f) => f.critical).sort((a, b) => famRead(a, pt) - famRead(b, pt))[0];"],
  ['  const weak = weakFamily(fams);\n  if (!weak) return undefined;', '  const weak = weakFamily(fams, sightLimit(s).perTrait);\n  if (!weak) return undefined;'],
  ["  const m = sv.understanding.margin;", "  const sl = sv.sightLimit;\n  const m = sl.gap;"],
  ["const title = m < 0 ? 'Understanding lags capability' : m < 0.5 ? 'Understanding barely ahead' : unseen.length ? `Understanding ahead, but ${unseen.length} of ${fams.length} risk families unseen` : 'Understanding ahead of capability';",
   "const title = m < 0 ? 'Model past your sight limit' : m < 0.5 ? 'Sight limit barely above the model' : unseen.length ? `Sight limit above the model, but ${unseen.length} of ${fams.length} risk families unseen` : 'Sight limit above the model';"],
  ["m < 0 ? `${F.num(-m, 1)} levels blind` : `${F.num(m, 1)} levels ahead`", "`Sight limit L ${F.level(sl.L)} (${F.level(sl.lo)}–${F.level(sl.hi)})`, m < 0 ? `${F.num(-m, 1)} levels past it` : `${F.num(m, 1)} levels above the model`"],
  ["  const weak = weakFamily(fams);\n  const chains: ChainLink[][] = [];\n  if (weak && weak.seenTo < up.L + 0.5) {", "  const weak = weakFamily(fams, sl.perTrait);\n  const weakRead = weak ? famRead(weak, sl.perTrait) : 1;\n  const chains: ChainLink[][] = [];\n  if (weak && weakRead < 0.6) {"],
  ["{weak.label} {weak.seenTo < up.L ? 'unseen' : 'barely seen'}", "{weak.label} {weakRead < 0.5 ? 'unread' : 'barely read'}"],
  ["<Term id=\"U\">Understanding vs capability</Term>} value={`${F.num(m, 1, true)} levels`} rows={[\n          { label: 'Capability (measured)', value: F.level(up.L) }, { label: 'Understanding', value: F.level(up.L + m) },",
   "<Term id=\"sightLimit\">Sight limit vs capability</Term>} value={`${F.num(m, 1, true)} levels`} rows={[\n          { label: 'Capability (measured)', value: F.level(up.L) }, { label: <Term id=\"sightLimit\">Sight limit</Term>, value: `L ${F.level(sl.L)} (${F.level(sl.lo)}–${F.level(sl.hi)})` },"],
  ["          ...fams.map((f) => ({ label: `${f.label} seen to`, value: `L ${F.num(f.seenTo, 1)}${f.unseen ? ' · unseen' : ''}`, tone: (f.unseen ? 'neg' : 'neutral') as 'neg' | 'neutral' })),\n        ]}>Positive: your tools read the model past its level.",
   "        ]}>Positive: your instruments read the model past its level."],
  ['/** U if an idea works (estimate from believed efficacy): understanding with its technique unlocked. */', '/** Sight limit if an idea works (estimate from believed efficacy): with its instrument unlocked. */'],
  ['  return understanding(hypo).U;', '  return sightLimit(hypo).L;'],
  ['  const Unow = sv.understanding.U;', '  const Unow = sv.sightLimit.L;'],
  ['<Term id="U">Capability vs understanding</Term>', '<Term id="sightLimit">Capability vs sight limit</Term>'],
  ['<span><i style={{ background: C.und }} /><Term id="U">Understanding</Term></span><span><i className="hatch" /><Term id="blind">blind</Term></span>', '<span><i style={{ background: C.und }} /><Term id="sightLimit">Sight limit</Term></span><span><i className="hatch" />past it</span>'],
  ['className="sf-lab" fill={C.und}>understanding</text>', 'className="sf-lab" fill={C.und}>sight limit</text>'],
  ["/** The U tooltip (L3): what U is, the level up to which the tools see each family, tools validated to and upkeep. */", "/** The sight-limit tooltip (L3): the sight limit with its range, upkeep against capability, and the best idea's effect. */"],
  ["  const lowest = Math.min(...fams.filter((f) => f.critical).map((f) => f.seenTo));\n", ''],
  ["<TipCard title={<><Term id=\"U\">Understanding</Term> · {fmtDate(dateOf(s, s.time.day))}</>} value={F.num(sv.understanding.U, 2)} rows={[", "<TipCard title={<><Term id=\"sightLimit\">Sight limit</Term> · {fmtDate(dateOf(s, s.time.day))}</>} value={`L ${F.level(sv.sightLimit.L)} (${F.level(sv.sightLimit.lo)}–${F.level(sv.sightLimit.hi)})`} rows={["],
  ["      ...fams.map((f) => ({ label: <span className=\"row-i\">{(() => { const I = FAM_ICON[f.id]; return <I size={12} />; })()}{f.label} seen to{f.critical ? null : <span className=\"dim\"> · not in U</span>}</span>, value: <>{F.num(f.seenTo, 1)}{f.critical && f.seenTo === lowest ? <span className=\"dim\"> lowest</span> : null}</>, tone: (f.seenTo < up.L ? 'neg' : 'neutral') as 'neg' | 'neutral' })),\n      { label: <Term id=\"validatedTo\">Tools validated to</Term>, value: up.validatedTo !== undefined ? `L ${F.num(up.validatedTo, 1)}` : '—' },\n", ''],
  ["value: `${F.num(sv.understanding.U, 1)} → ${F.num(ifU, 1)}`", "value: `L ${F.num(sv.sightLimit.L, 1)} → ${F.num(ifU, 1)}`"],
  [">Level up to which your tools see the critical traits (average detection ≥ 50%). Estimates from what you believe, not the truth.</TipCard>", ">The highest level at which your instruments together still read the hidden-goal traits at 50% or better; the range is what your uncertainty about each instrument allows. From what you believe, not the truth.</TipCard>"],
  ["                { label: 'Tools see it to', value: `L ${F.num(f.seenTo, 1)}`, tone: f.unseen ? 'neg' : 'neutral' },\n", ''],
  ['const g = useMemo(() => detectionGrid(s), [s, s.time.day]);', 'const g = useMemo(() => sightGrid(s), [s, s.time.day]);'],
  ['<Card title="Can your tools see it?" sub="detection by capability level"', '<Card title="Sight limit by trait" sub="believed reading by capability level"'],
  ["50% line ({CRITICAL_TRAITS.length} critical traits average = <Ref id=\"U\" to={{ panel: 'safety', tab: 'overview' }}>Understanding</Ref>)", "50% line ({CRITICAL_TRAITS.length} hidden-goal traits average = <Ref id=\"sightLimit\" to={{ panel: 'safety', tab: 'overview' }}>Sight limit</Ref>)"],
]);
let t = fs.readFileSync(f, 'utf8');
const a = t.indexOf('      {sv.nextDecay && <Tip');
if (a < 0) { console.error('no nextDecay'); process.exitCode = 1; } else { const b = t.indexOf('\n', a); t = t.slice(0, a) + t.slice(b + 1); fs.writeFileSync(f, t); }
