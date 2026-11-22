const fs = require('fs');
const rep = (f, pairs) => { let t = fs.readFileSync(f, 'utf8'); for (const [a, b] of pairs) { if (!t.includes(a)) { console.error('MISSING in', f, ':', a.slice(0, 90)); process.exitCode = 1; continue; } t = t.split(a).join(b); } fs.writeFileSync(f, t); };
rep('src/ui/v2/panels/Overview.tsx', [['<Term id="U">Understanding</Term></span><span><i style={{ background: \'rgba(239,107,107,.5)\', height: 8 }} /><Term id="gap">blind</Term></span>', '<Term id="sightLimit">Sight limit</Term></span><span><i style={{ background: \'rgba(239,107,107,.5)\', height: 8 }} />past it</span>']]);
rep('src/ui/v2/panels/Safety.tsx', [['{ label: <Term id="U">Understanding</Term>, value: F.num(U[i], 2) }, { label: <Term id="blind">Blind</Term>,', '{ label: <Term id="sightLimit">Sight limit</Term>, value: F.num(U[i], 2) }, { label: \'Past it by\','],
  ['<Term id="sightLimit">Capability vs sight limit</Term>', '<Term id="sightLimit">Capability vs sight limit</Term>']]);
rep('src/ui/v2/panels/TraitGraph.tsx', [['counts toward <Ref id="U" to={{ panel: \'safety\', tab: \'overview\' }}>Understanding</Ref>', 'counts toward the <Ref id="sightLimit" to={{ panel: \'safety\', tab: \'overview\' }}>sight limit</Ref>']]);
rep('src/ui/v2/shell/Onboarding.tsx', [['vs <Term id="U">understanding</Term>', 'vs <Term id="sightLimit">sight limit</Term>'], ['{ label: <Term id="U">Understanding</Term>, icon: ICON.U,', '{ label: <Term id="sightLimit">Sight limit</Term>, icon: ICON.U,']]);
// glossary: delete U, uRange, validatedTo, blind, gap; add sightLimit
const g = 'src/data/v2/glossary.ts';
let t = fs.readFileSync(g, 'utf8');
for (const k of ['U', 'uRange', 'validatedTo', 'blind', 'gap']) {
  const re = new RegExp(`^  ${k}: \\{.*\\n`, 'm');
  if (!re.test(t)) { console.error('no glossary', k); process.exitCode = 1; }
  t = t.replace(re, k === 'U' ? "  sightLimit: { title: 'Sight limit', body: 'The highest capability level at which your instruments together still read the hidden-goal traits (scheming, faking alignment, sandbagging, power seeking) at 50% or better, on what you believe. Each instrument loses reliability the further a model is beyond the one it was validated on. The range is what your uncertainty about each instrument allows: few results leave it wide. A model past your sight limit can hide what it wants.', src: 'SAFETY-REDESIGN §2.2 (5); SR-11' },\n" : '');
}
fs.writeFileSync(g, t);
