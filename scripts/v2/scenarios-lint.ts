// Scenarios lint (design/bal/SCENARIOS.md). Run: npm run scenarios:lint
// Checks balance/scenarios.ts: unique ids, layer/timeline/align consistency, targetId in balance/targets.ts, lo <= value <= hi, p10 <= lo and hi <= p90, neverBy2100 in 0..1,
// a milestone checkpoint per timeline, history dates <= 2027.0. Prints counts per layer, timeline and status. Exit 1 on any error.
import { ALIGNMENT_LEVELS, CHECKPOINTS, TIMELINES } from '../../balance/scenarios';
import type { Checkpoint } from '../../balance/scenarios';
import { TARGETS } from '../../balance/targets';

const errors: string[] = [];
const err = (c: Checkpoint, msg: string) => errors.push(`${c.id}: ${msg}`);

const targetIds = new Set(TARGETS.map((t) => t.id));
const timelineIds = new Set<string>(TIMELINES.map((t) => t.id));
const levelIds = new Set<string>(ALIGNMENT_LEVELS.map((l) => l.id));

// Level and timeline tables.
if (timelineIds.size !== TIMELINES.length) errors.push('TIMELINES: duplicate ids');
if (levelIds.size !== ALIGNMENT_LEVELS.length) errors.push('ALIGNMENT_LEVELS: duplicate ids');

const seen = new Set<string>();
for (const c of CHECKPOINTS) {
  if (seen.has(c.id)) err(c, 'duplicate id');
  seen.add(c.id);

  // layer, timeline and align agree
  if (c.layer === 'timeline') {
    if (!c.timeline) err(c, 'layer timeline needs a timeline');
    else if (!timelineIds.has(c.timeline)) err(c, `unknown timeline ${c.timeline}`);
    if (c.align) err(c, 'layer timeline must not set align');
  } else if (c.layer === 'alignment') {
    if (!c.align) err(c, 'layer alignment needs an align level');
    else if (!levelIds.has(c.align)) err(c, `unknown align level ${c.align}`);
    if (c.timeline) err(c, 'layer alignment must not set timeline');
  } else if (c.layer === 'history') {
    if (c.timeline || c.align) err(c, 'layer history must not set timeline or align');
    if (c.date === undefined) err(c, 'history checkpoint needs a date');
    else if (c.date > 2027.0) err(c, `history date ${c.date} is after 2027.0`);
  } else err(c, `unknown layer ${String(c.layer)}`);

  // targets
  if (c.targetId !== undefined && !targetIds.has(c.targetId)) err(c, `targetId ${c.targetId} is not in TARGETS`);

  // numbers
  const { lo, hi, value } = c;
  if (lo !== undefined && hi !== undefined && lo > hi) err(c, `lo ${lo} > hi ${hi}`);
  if (value !== undefined && lo !== undefined && value < lo) err(c, `value ${value} < lo ${lo}`);
  if (value !== undefined && hi !== undefined && value > hi) err(c, `value ${value} > hi ${hi}`);
  // outer band of a distribution (p10, p90) sits outside the p25 to p75 band and needs a source band
  const { p10, p90 } = c;
  if (p10 !== undefined && (lo === undefined || p10 > lo)) err(c, `p10 ${p10} must be set with lo and be <= lo ${lo}`);
  if (p90 !== undefined && (hi === undefined || p90 < hi)) err(c, `p90 ${p90} must be set with hi and be >= hi ${hi}`);
  if ((p10 !== undefined || p90 !== undefined) && c.bandFrom !== 'source') err(c, 'has p10/p90 but bandFrom is not source');
  if (c.neverBy2100 !== undefined && !(c.neverBy2100 >= 0 && c.neverBy2100 <= 1)) err(c, `neverBy2100 ${c.neverBy2100} is not a share between 0 and 1`);
  if (c.series !== undefined && (c.layer !== 'timeline' || c.date === undefined)) err(c, 'series needs a dated timeline checkpoint');
  if ((lo !== undefined || hi !== undefined) && c.bandFrom === 'none') err(c, 'has lo/hi but bandFrom is none');
  if (c.bandFrom === 'source' && lo === undefined && hi === undefined) err(c, 'bandFrom source but no lo/hi');

  // quantity-specific fields
  if (c.quantity === 'milestone') {
    if (!c.milestone) err(c, 'milestone checkpoint needs milestone');
    if (c.value === undefined && c.status !== 'blank') err(c, 'milestone checkpoint needs a value unless blank');
  }
  if (c.quantity === 'interval' && (!c.from || !c.milestone)) err(c, 'interval checkpoint needs from and milestone');

  // status and provenance
  if (c.status === 'blank' && !c.notes) err(c, 'blank status needs a note');
  if (c.status === 'blank' && (c.value !== undefined || lo !== undefined || hi !== undefined)) err(c, 'blank status must carry no number');
  if (c.status === 'unsure' && !c.notes) err(c, 'unsure status needs a note');
  if (!c.sourceRef) err(c, 'sourceRef is empty');
  if (!c.unit) err(c, 'unit is empty');
}

// Every timeline has at least one milestone checkpoint (with a value).
for (const t of TIMELINES) {
  const ms = CHECKPOINTS.filter((c) => c.layer === 'timeline' && c.timeline === t.id && c.quantity === 'milestone' && c.value !== undefined);
  if (ms.length === 0) errors.push(`timeline ${t.id}: no milestone checkpoint`);
}
// Levels: no winBand set here (the designer sets it); five levels, three tested.
for (const l of ALIGNMENT_LEVELS) if (l.winBand) errors.push(`level ${l.id}: winBand is set (designer only)`);
if (ALIGNMENT_LEVELS.length !== 5) errors.push(`expected 5 alignment levels, found ${ALIGNMENT_LEVELS.length}`);

// Counts.
const count = (key: (c: Checkpoint) => string) => {
  const m = new Map<string, number>();
  for (const c of CHECKPOINTS) m.set(key(c), (m.get(key(c)) ?? 0) + 1);
  return [...m].map(([k, n]) => `${k} ${n}`).join(', ');
};
console.log(`checkpoints: ${CHECKPOINTS.length}`);
console.log(`per layer: ${count((c) => c.layer)}`);
console.log(`per timeline: ${count((c) => (c.layer === 'timeline' ? String(c.timeline) : '-')).replace(/(^|, )- \d+(, |$)/, '$1').replace(/, $/, '')} (history and alignment checkpoints are shared)`);
console.log(`per align level: ${CHECKPOINTS.filter((c) => c.layer === 'alignment').map((c) => c.align).join(', ')}`);
console.log(`per status: ${count((c) => c.status)}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log('scenarios lint: ok');
