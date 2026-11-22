// SR-06 targeted check: beliefs carry an evidence list, never drift with time, and a new model starts from its parent's
// belief moved by the run's predicted change with a wider range. Run alone: npx tsx scripts/v2/_sr06/check.ts
//  1. a rev-55 save (no evidence lists) migrates: every belief gets a list;
//  2. over 30 ticked days a belief's (est, sd) changes only on a day an evidence entry lands (no drift);
//  3. each observation appends one entry {day, source, reading, noise}; the list is capped at 20;
//  4. a post-train's new version starts at the parent's belief moved by the predicted change, sd² = sd_parent² + w²
//     (w = 0.3·|Δ| + 0.04, capped at SD_MAX), evidence = one "inherit:<parent>" entry; identical with true traits
//     rewritten (never reads truth);
//  5. "Unknown" = 90% range > 30 points.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_REV, deserialize, serialize } from '../../../src/engine/v2/core/save';
import { makeCtx, tick } from '../../../src/engine/v2/core/loop';
import { BELIEF_EVIDENCE_CAP, SD_MAX, beliefUnknown, observeVersion } from '../../../src/engine/v2/safety/detection';
import { PREDICT_SD_FLOOR, applyRunToTraits } from '../../../src/engine/v2/safety/traits';
import { TRAIT_IDS } from '../../../src/data/v2/traits';
import type { GameStateV2, ModelVersion, TrainingRun } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (fx: string) => deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));

// 1. Migration 55 → 56.
{
  const old = JSON.parse(serialize(load('day400.json'))) as GameStateV2;
  old.schemaRev = 55;
  for (const v of old.player.models.versions) for (const b of Object.values(v.beliefs)) delete (b as { evidence?: unknown }).evidence;
  const m = deserialize(JSON.stringify(old));
  const all = m.player.models.versions.flatMap((v) => Object.values(v.beliefs));
  check(m.schemaRev === SCHEMA_REV && SCHEMA_REV >= 56 && all.length > 0 && all.every((b) => Array.isArray(b.evidence) && b.evidence.length === 0), `a rev-55 save loads at 56 with empty evidence lists (${all.length} beliefs)`);
}

for (const fx of ['day400.json', 'day900.json']) {
  // 2. No drift: over 30 days, (est, sd) moves only with a new evidence entry dated that day.
  const s = load(fx);
  const key = (v: ModelVersion, t: string) => `${v.id}.${t}`;
  const prev = new Map<string, { est: number; sd: number; n: number; last?: string }>();
  const snap = () => {
    for (const v of s.player.models.versions) for (const t of TRAIT_IDS) {
      const b = v.beliefs[t];
      if (!b) continue;
      const e = b.evidence[b.evidence.length - 1];
      prev.set(key(v, t), { est: b.est, sd: b.sd, n: b.evidence.length, last: e ? JSON.stringify(e) : undefined });
    }
  };
  snap();
  let moved = 0, still = 0, entries = 0;
  const bad: string[] = [];
  for (let d = 0; d < 30 && s.player.status === 'active'; d++) {
    const day = s.time.day;
    tick(s);
    for (const v of s.player.models.versions) for (const t of TRAIT_IDS) {
      const b = v.beliefs[t];
      const p = prev.get(key(v, t));
      if (!b || !p) continue;
      const e = b.evidence[b.evidence.length - 1];
      const newEntry = !!e && JSON.stringify(e) !== p.last && (e.day === day || e.day === s.time.day);
      if (newEntry) entries++;
      if (b.est !== p.est || b.sd !== p.sd) {
        moved++;
        if (!newEntry) bad.push(`${v.id} ${t} day ${day}: ${p.est.toFixed(4)}±${p.sd.toFixed(4)} → ${b.est.toFixed(4)}±${b.sd.toFixed(4)} n ${p.n}→${b.evidence.length} ${JSON.stringify(e)}`);
      } else if (!newEntry) still++;
    }
    snap();
  }
  check(bad.length === 0 && still > 0, `${fx}: 30 days: every belief move came with an evidence entry that day (${moved} moves, ${entries} entries, ${still} belief-days unchanged without evidence)`, bad.slice(0, 3).join('; '));

  // 3. Each observation appends one entry; the cap holds.
  {
    const s3 = load(fx);
    const v = s3.player.models.versions.find((x) => x.status !== 'retired')!;
    const ctx = makeCtx(s3);
    const n0 = v.beliefs.SCHEME.evidence.length;
    const o = observeVersion(s3, ctx.rng('safety'), s3.time.day, v, 'SCHEME', 'BB', 0.5, 1, 'test');
    const e = v.beliefs.SCHEME.evidence[v.beliefs.SCHEME.evidence.length - 1];
    check(v.beliefs.SCHEME.evidence.length === Math.min(BELIEF_EVIDENCE_CAP, n0 + 1) && e.source === 'test/BB' && e.day === s3.time.day && Math.abs(e.reading - o) < 5e-4 && Math.abs(e.noise - 0.12 / 0.5) < 5e-4,
      `${fx}: one observation → one entry {day, source, reading, noise}`, JSON.stringify(e));
    for (let i = 0; i < 30; i++) observeVersion(s3, ctx.rng('safety'), s3.time.day + i, v, 'SCHEME', 'WB', 0.4, 1, 'test');
    const ev = v.beliefs.SCHEME.evidence;
    check(ev.length === BELIEF_EVIDENCE_CAP && ev[ev.length - 1].day === s3.time.day + 29 && ev[0].day === s3.time.day + 10, `${fx}: 31 more readings keep the last ${BELIEF_EVIDENCE_CAP}, oldest first`);
  }

  // 4. A new version from a post-train starts at parent ± predicted change, wider by w.
  {
    const s4 = load(fx);
    const parent = s4.player.models.versions.filter((x) => x.status !== 'retired' && x.variant === 'full').sort((a, b) => b.day - a.day)[0];
    const make = (st: GameStateV2) => {
      const p = st.player.models.versions.find((x) => x.id === parent.id)!;
      const run = { id: 'R-SR06', kind: 'post', baseId: p.baseId, name: 'SR06 post', post: { ...p.design } } as unknown as TrainingRun;
      const v = { ...structuredClone(p), id: 'V-SR06', parentVersionId: p.id } as ModelVersion;
      applyRunToTraits(st, makeCtx(st), run, v);
      return { p, v };
    };
    const { p, v } = make(s4);
    const bad4: string[] = [];
    let wider = 0;
    for (const t of TRAIT_IDS) {
      const a = p.beliefs[t], b = v.beliefs[t];
      const w = 0.3 * Math.abs(b.est - a.est) + PREDICT_SD_FLOOR;
      const sdWant = Math.min(SD_MAX, Math.sqrt(a.sd * a.sd + w * w));
      if (Math.abs(b.sd - sdWant) > 1e-12) bad4.push(`${t} sd ${b.sd} ≠ ${sdWant}`);
      if (b.sd > a.sd || a.sd >= SD_MAX) wider++;
      if (b.evidence.length !== 1 || b.evidence[0].source !== `inherit:${p.id}` || Math.abs(b.evidence[0].reading - b.est) > 5e-4 || Math.abs(b.evidence[0].noise - w) > 5e-4) bad4.push(`${t} evidence ${JSON.stringify(b.evidence)}`);
    }
    const moves = TRAIT_IDS.filter((t) => Math.abs(v.beliefs[t].est - p.beliefs[t].est) > 1e-9).length;
    check(bad4.length === 0 && wider === TRAIT_IDS.length, `${fx}: new version from ${p.id}: est = parent moved by the prediction (${moves}/${TRAIT_IDS.length} traits move), sd² = sd_parent² + (0.3·|Δ| + 0.04)², one inherit entry`, bad4.slice(0, 3).join('; '));
    const s4b = load(fx);
    for (const x of s4b.player.models.versions) for (const t of TRAIT_IDS) x.traitsTrue[t] = 1 - x.traitsTrue[t];
    const { v: vb } = make(s4b);
    const same = TRAIT_IDS.every((t) => vb.beliefs[t].est === v.beliefs[t].est && vb.beliefs[t].sd === v.beliefs[t].sd);
    check(same, `${fx}: the new version's starting beliefs are identical with every true trait rewritten`);
  }
}

// 5. Unknown flag.
check(beliefUnknown({ sd: 0.1 }) && !beliefUnknown({ sd: 0.09 }) && beliefUnknown(undefined), '"Unknown" = 90% range (3.28·sd) > 30 points');

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
