// RD-P08 targeted check: a sector adaptation raises only its own product's coverage in its own sector; it acts once built;
// in a sector with certification, once certified (a timed process, its cash booked when it starts) its buyers face
// CERT_FRICTION_CUT less friction (RF-P3); rivals have no
// adaptations (RF-P2); no sectorPacks / LEADER_FEATURES / world certDay left in src; a rev-69 save's packs
// become adaptations on the product that had them.
// Run alone: npx tsx scripts/v2/_p08/check.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { productOffer } from '../../../src/engine/v2/worldfx/serving';
import { ADAPT_COVER, ADAPT_TW, CERT_CASH, CERT_DAYS, CERT_FRICTION_CUT, certifiedBuyerShare } from '../../../src/engine/v2/models/adaptations';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { frictionOf } from '../../../src/engine/v2/worldfx/sectors';
import { policyState } from '../../../src/engine/v2/worldfx/policy';
import { SECTOR_BY_ID } from '../../../src/data/v2/sectors';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const prod = (g: GameStateV2, ch: Deployment['channel']) => g.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;
const ent = prod(s, 'enterprise');
const api = prod(s, 'api');
const cov = (d: Deployment, sid: 'LEGAL' | 'SOFT' | 'FIN') => productOffer(s, d, sid).a;

// 1. Unregulated sector (Legal): only the adapted product, only that sector.
const e0 = { L: cov(ent, 'LEGAL'), S: cov(ent, 'SOFT'), F: cov(ent, 'FIN') };
const a0 = cov(api, 'LEGAL');
ent.adaptations.push({ sector: 'LEGAL' });
const e1 = { L: cov(ent, 'LEGAL'), S: cov(ent, 'SOFT'), F: cov(ent, 'FIN') };
const want = Math.min(1, e0.L * (1 + ADAPT_COVER));
check(e0.L > 0 && Math.abs(e1.L - want) < 1e-12, `adapted Enterprise covers ×${1 + ADAPT_COVER} of Legal tasks`, `${e0.L.toFixed(4)} → ${e1.L.toFixed(4)}`);
check(e1.S === e0.S && e1.F === e0.F, 'its coverage in other sectors is unchanged', `SOFT ${e0.S.toFixed(4)} → ${e1.S.toFixed(4)}, FIN ${e0.F.toFixed(4)} → ${e1.F.toFixed(4)}`);
check(cov(api, 'LEGAL') === a0, 'the API product (not adapted) is unchanged in Legal', `${a0.toFixed(4)}`);
ent.adaptations = [];

// 2. Regulated sector (Finance) through the action: scaffold, then certification gates it until done.
const cash0 = s.player.finance.cash;
const err = act(s, 'product.adapt', { sector: 'FIN', deploymentId: ent.id });
check(!err && s.player.build.queue.some((it) => it.kind === 'adaptation' && it.ref === 'FIN' && it.host === ent.id && it.needTW === ADAPT_TW), 'the action queues the scaffold build on the product', err ?? '');
let n = 0;
while (!ent.adaptations.some((a) => a.sector === 'FIN') && n++ < 400) tick(s);
const fa = ent.adaptations.find((a) => a.sector === 'FIN');
check(!!fa && fa.certDone !== undefined && fa.certDone - s.time.day <= CERT_DAYS && fa.certDone - s.time.day >= CERT_DAYS - 1,
  `built after ${n} ticks; certification ends ${CERT_DAYS} d after the build`, `certDone ${fa?.certDone} day ${s.time.day}`);
const certCause = Object.values(s.causes.byKey).flat().find((c) => c.source === 'sector certification');
check(!!certCause && Math.abs(certCause.delta + CERT_CASH) < 1e-9, `certification cash booked when it starts ($${CERT_CASH}B)`, `${certCause?.delta} (cash ${cash0.toFixed(2)} → ${s.player.finance.cash.toFixed(2)})`);
const fNo = productOffer(s, { ...ent, adaptations: [] }, 'FIN').a;
const fYes = cov(ent, 'FIN');
check(Math.abs(fYes - Math.min(1, fNo * (1 + ADAPT_COVER))) < 1e-12 && fYes > fNo, 'in certification: the scaffold already acts (Finance coverage ×(1 + ADAPT_COVER))', `${fNo.toFixed(4)} → ${fYes.toFixed(4)}`);
const mix = worldMix(s);
const pIdx = mix.providers.findIndex((p) => p.key === 'player');
check(certifiedBuyerShare(s, 'FIN', mix.sec.US.FIN.playerProdW) === 0, 'in certification: no friction cut yet');
const day0 = s.time.day;
s.time.day = fa!.certDone!;
const cs = certifiedBuyerShare(s, 'FIN', mix.sec.US.FIN.playerProdW);
const pol = policyState(s);
const R0 = frictionOf(s, 'US', SECTOR_BY_ID.FIN, pol);
const share = mix.sec.US.FIN.share[pIdx] * cs;
const R1 = frictionOf(s, 'US', SECTOR_BY_ID.FIN, pol, share);
check(cs > 0 && share > 0 && Math.abs(R0 - R1 - CERT_FRICTION_CUT * share) < 1e-12, `certified: US Finance friction − ${CERT_FRICTION_CUT} × the certified product's buyers' share`, `buyers ${share.toFixed(3)}, R ${R0.toFixed(4)} → ${R1.toFixed(4)}`);
check(frictionOf(s, 'ROW', SECTOR_BY_ID.FIN, pol) === frictionOf(s, 'ROW', SECTOR_BY_ID.FIN, pol, share), 'outside the US no cut');
s.time.day = day0;

// 4. Old names gone from src (the save migrations excepted).
const files: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
walk('src');
const hits = files.filter((f) => !f.endsWith(join('core', 'save.ts'))).filter((f) => /sectorPacks|LEADER_FEATURES|certDay|SECTOR_PACK|SECTOR_CERT_DAYS|wfx\.sectorProduct|rivalAdaptStep|RIVAL_ADAPT_GATE_A|adaptBuild|\.adapts\b/.test(readFileSync(f, 'utf8')));
check(hits.length === 0, 'no sectorPacks / LEADER_FEATURES / certDay / SECTOR_PACK* / rival adaptations in src (save.ts migrations excepted)', hits.join(', '));

// 5. Migration 69 → 70: packs → adaptations on the product that had them.
const g = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const old = JSON.parse(serialize(g));
old.schemaRev = 69;
old.player.features.push('sectorPacks');
for (const d of old.player.deployments) {
  delete d.adaptations;
  d.packs = d.channel === 'enterprise' ? [{ sector: 'FIN', certDay: 50 }, { sector: 'LEGAL', certDay: 40 }] : [];
}
const m = deserialize(JSON.stringify(old));
const me = prod(m, 'enterprise');
check(JSON.stringify(me.adaptations) === JSON.stringify([{ sector: 'FIN', certDone: 50 }, { sector: 'LEGAL' }]) && m.player.deployments.every((d) => !('packs' in d) && (d === me || d.adaptations.length === 0)) && !m.player.features.includes('sectorPacks'),
  'a rev-69 save: packs become adaptations on their product (certification kept where needed), the feature is gone', JSON.stringify(me.adaptations));

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
