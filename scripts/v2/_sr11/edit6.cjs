const fs = require('fs');
const rep = (f, pairs) => { let t = fs.readFileSync(f, 'utf8'); for (const [a, b] of pairs) { if (!t.includes(a)) { console.error('MISSING in', f, ':', a.slice(0, 90)); process.exitCode = 1; continue; } t = t.split(a).join(b); } fs.writeFileSync(f, t); };
// Analysis scripts: read the sight limit through a local adapter in the old shape (U = sight limit, margin = gap).
const P = "../../src/engine/v2/safety/sightLimit";
const ad = (names) => `import { sightLimit, trueSightLimit } from '${P}';\n// SR-11: the sight limit in the shape these analyses read (U = sight limit, margin = sight limit − level).\n` +
  (names.includes('u') ? "const understanding = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, margin: r.gap, perTrait: r.perTrait }; };\n" : '') +
  (names.includes('b') ? "const understandingBand = (s: GameStateV2) => { const r = sightLimit(s); return { U: r.L, lo: r.lo, hi: r.hi }; };\n" : '') +
  (names.includes('t') ? "const trueUnderstanding = (s: GameStateV2) => { const r = trueSightLimit(s); return { U: r.L, L: r.level }; };\n" : '') +
  "void trueSightLimit;";
rep('scripts/v2/oversight.ts', [[`import { understanding } from '../../src/engine/v2/safety/understanding';`, ad('u')]]);
rep('scripts/v2/ref-trace.ts', [[`import { understanding } from '../../src/engine/v2/safety/understanding';`, ad('u')]]);
rep('scripts/v2/safety-emu.ts', [[`import { trueUnderstanding, understanding, understandingBand } from '../../src/engine/v2/safety/understanding';`, ad('ubt')]]);
rep('scripts/v2/safety.ts', [[`import { understandingBand } from '../../src/engine/v2/safety/understanding';`, ad('b')]]);
rep('scripts/v2/lint-ux.ts', [[`import { internalEval, internalVersion, measuredL, understanding } from '../../src/engine/v2/index';`, `import { internalEval, internalVersion, measuredL, sightLimit } from '../../src/engine/v2/index';\nconst understanding = (s: Parameters<typeof sightLimit>[0]) => ({ U: sightLimit(s).L });`]]);
