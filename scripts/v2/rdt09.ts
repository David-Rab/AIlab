// RD-T09 targeted check: synthetic data's domain mix follows its teacher's domain profile (SYN_MIX gone).
// Run alone: npx tsx scripts/v2/rdt09.ts
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { synAssetFor, synMixOf } from '../../src/engine/v2/production/data';
import { describeSynMix } from '../../src/engine/v2/production/dataView';
import { DOMAIN_IDS } from '../../src/data/v2/calibration';

let fails = 0;
const check = (ok: boolean, name: string, detail: string) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};
const s = newGame(defaultSetupV2());
const v0 = s.player.models.versions[0];
const pct = (m: Record<string, number | undefined>) => DOMAIN_IDS.map((d) => `${d} ${((m[d] ?? 0) * 100).toFixed(0)}%`).join(', ');
const even = synMixOf(v0);
const maxEven = Math.max(...DOMAIN_IDS.map((d) => even[d] ?? 0));
check(maxEven < 1.5 / DOMAIN_IDS.length, 'a balanced teacher writes a balanced mix', `${v0.name}: ${pct(even)} → "${describeSynMix(even)}"`);
const coder = { ...v0, id: 'CODER', name: 'Coder', build: { ...v0.build!, sD: { ...v0.build!.sD, CODE: (v0.build!.sD.CODE ?? 0) + 0.3, REASON: (v0.build!.sD.REASON ?? 0) + 0.2 } } };
s.player.models.versions.push(coder);
const a = synAssetFor(s, coder, 1);
const others = DOMAIN_IDS.filter((d) => d !== 'CODE' && d !== 'REASON').map((d) => a.mix[d] ?? 0);
check((a.mix.CODE ?? 0) > 3 / DOMAIN_IDS.length && (a.mix.CODE ?? 0) > (a.mix.REASON ?? 0) && (a.mix.REASON ?? 0) > Math.max(...others),
  "a code-strong teacher's synthetic data is code-heavy", `${pct(a.mix)} → "${describeSynMix(a.mix)}"`);
const sum = DOMAIN_IDS.reduce((t, d) => t + (a.mix[d] ?? 0), 0);
check(Math.abs(sum - 1) < 1e-9, 'the mix sums to 1', sum.toFixed(12));
const tgt = synMixOf(coder, { BIO: 0 });
check((tgt.BIO ?? 0) === 0, 'a generation target weight scales its domain', `BIO ${tgt.BIO}`);
if (fails) process.exit(1);
