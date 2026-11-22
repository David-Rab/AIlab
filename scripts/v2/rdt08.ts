// RD-T08 targeted check: the quality and hazard filters act through the data draw (no flat offsets).
// Run alone: npx tsx scripts/v2/rdt08.ts
import { readFileSync } from 'node:fs';
import { REFERENCE_BASE } from '../../src/data/v2/runDesign';
import { designTarget, drawData, startPortfolio } from '../../src/engine/v2/production/data';
import { baseEffect } from '../../src/engine/v2/models/design';
import type { BaseDesign } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, name: string, detail: string) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};
const p = startPortfolio();
const tokens = REFERENCE_BASE.params * REFERENCE_BASE.tpp;
const des = (c: Partial<BaseDesign['curation']>): BaseDesign => ({ ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation, ...c } });
const on = drawData(p, tokens, designTarget(des({ quality: true, hazard: false })));
const off = drawData(p, tokens, designTarget(des({ quality: false, hazard: false })));
check(on.quality > off.quality * 1.1 && on.uMix < off.uMix * 0.95, 'quality filter raises drawn quality and lowers unique tokens',
  `mean q ${off.quality.toFixed(3)} → ${on.quality.toFixed(3)}; unique tokens ${(off.uMix / 1e12).toFixed(0)}T → ${(on.uMix / 1e12).toFixed(0)}T`);
const hz = drawData(p, tokens, designTarget(des({ hazard: true })));
const bio = (d: typeof on) => (d.share.BIO ?? 0) * d.tokens;
check(bio(hz) < bio(on) * 0.7 && (hz.sD.BIO ?? 0) < -0.2 && (hz.share.CYBER ?? 0) < (on.share.CYBER ?? 0) * 0.7 && Math.abs(hz.tokens - on.tokens) < 1,
  'hazard filter removes BIO (and CYBER) tokens from the draw; BIO specialisation follows',
  `BIO tokens ${(bio(on) / 1e12).toFixed(2)}T → ${(bio(hz) / 1e12).toFixed(2)}T, s_BIO ${(hz.sD.BIO ?? 0).toFixed(2)} OOM; CYBER share ${((on.share.CYBER ?? 0) * 100).toFixed(2)}% → ${((hz.share.CYBER ?? 0) * 100).toFixed(2)}%`);
const e0 = baseEffect(des({ quality: false, hazard: true }));
check(e0.dg === 0 && !('sD' in e0), 'no flat curation offsets left in baseEffect', JSON.stringify(e0));
const src = readFileSync('src/data/v2/runDesign.ts', 'utf8');
check(!/Δp × B|qualityOffDg|flopMult|cashMult|TPP_FREE_MAX/.test(src), 'runDesign has no v2 Δp × B constants, flopMult, cashMult or tpp gate', '');
if (fails) process.exit(1);
