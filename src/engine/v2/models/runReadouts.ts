// UB-B readouts for TRAINING › Runs: what each run made, when it ended, its launch forecast against the measurement.
// Pure views on facts (runs, bases, versions), the lab's frozen launch forecast and measured evals; never true levels.
import type { BaseModel, Day, GameStateV2, ModelVersion, RunKind, TrainingRun } from '../types';
import { measuredSd } from './benchmarks';
import { forecastBand } from './runs';

export type RunLane = 'pre' | 'post' | 'distil';
export const RUN_LANE: Record<RunKind, RunLane> = { base: 'pre', continue: 'pre', post: 'post', distill: 'distil' };
export interface RunResultRef { id: string; name: string; kind: 'base' | 'version'; day: Day }
export interface RunMeasure { L: number; sd: number; day?: Day; versionName: string }
export interface RunHistoryRow {
  run: TrainingRun;
  /** "Pretraining 32", "Post-training 33", "Distil 34": the kind and the run's number. */
  title: string;
  lane: RunLane;
  start: Day;
  /** Finish day (stored from UB-B on; before it, the result's day). */
  end?: Day;
  result?: RunResultRef;
  /** The model the run started from (post-training: its base; distil: the teacher). */
  from?: string;
  /** Launch forecast (the lab's, frozen at launch) and its 90% range; absent when nothing was measured at launch. */
  forecast?: { mid: number; sd: number; band: [number, number] };
  /** The measured level of what it made (a base: the first model post-trained on it). */
  measured?: RunMeasure;
  /** Where the measurement fell against the forecast range; z = (measured − forecast) ÷ the forecast's sd. */
  check?: { verdict: 'inside' | 'below' | 'above'; z: number };
}

const KIND_TITLE: Record<RunKind, string> = { base: 'Pretraining', continue: 'Pretraining', post: 'Post-training', distill: 'Distil' };
const runNo = (r: TrainingRun) => r.id.replace(/\D+/g, '') || r.id;
export const runHistoryTitle = (r: TrainingRun) => `${KIND_TITLE[r.kind]} ${runNo(r)}`;

/** What each finished run made: the stored link, else (runs finished before UB-B) the pairing by kind, order and dates:
 *  a pretraining run → the base that started on its launch day; a post-training run → the first unpaired full version
 *  on its base made after launch; a distil → the first unpaired smaller version of its teacher made after launch. */
export function runResults(s: GameStateV2): Map<string, RunResultRef> {
  const m = s.player.models;
  const out = new Map<string, RunResultRef>();
  const used = new Set<string>();
  const ref = (x: BaseModel | ModelVersion, kind: 'base' | 'version'): RunResultRef => ({ id: x.id, name: x.name, kind, day: x.day });
  const runs = [...m.runs].filter((r) => r.status === 'done').sort((a, b) => a.startDay - b.startDay);
  for (const r of runs) {
    if (!r.resultId) continue;
    const b = m.bases.find((x) => x.id === r.resultId);
    const v = m.versions.find((x) => x.id === r.resultId);
    if (b) out.set(r.id, ref(b, 'base'));
    else if (v) out.set(r.id, ref(v, 'version'));
    used.add(r.resultId);
  }
  const versions = [...m.versions].sort((a, b) => a.day - b.day);
  for (const r of runs) {
    if (out.has(r.id)) continue;
    if (r.kind === 'base' || r.kind === 'continue') {
      const b = m.bases.find((x) => x.startDay === r.startDay && !used.has(x.id));
      if (b) { out.set(r.id, ref(b, 'base')); used.add(b.id); }
      continue;
    }
    const v = r.kind === 'distill'
      ? versions.find((x) => x.variant === 'mini' && x.parentVersionId === r.teacherVersionId && x.day >= r.startDay && !used.has(x.id))
      : versions.find((x) => x.variant === 'full' && x.baseId === r.baseId && x.day > r.startDay && !used.has(x.id));
    if (v) { out.set(r.id, ref(v, 'version')); used.add(v.id); }
  }
  return out;
}

function measureOf(s: GameStateV2, res: RunResultRef | undefined): RunMeasure | undefined {
  if (!res) return undefined;
  const vs = s.player.models.versions;
  const v = res.kind === 'version' ? vs.find((x) => x.id === res.id) : [...vs].filter((x) => x.baseId === res.id && x.variant === 'full').sort((a, b) => a.day - b.day)[0];
  if (!v || v.evals.measuredL === undefined) return undefined;
  return { L: v.evals.measuredL, sd: measuredSd(v), day: v.evals.suiteDay, versionName: v.name };
}

/** Every run that is running, paused or finished, oldest first, with its result, forecast and measured check. */
export function runHistory(s: GameStateV2): RunHistoryRow[] {
  const m = s.player.models;
  const res = runResults(s);
  return [...m.runs].filter((r) => r.status === 'done' || r.status === 'running' || r.status === 'paused').sort((a, b) => a.startDay - b.startDay).map((r) => {
    const result = res.get(r.id);
    const fc = r.forecast ? { mid: r.forecast.mid, sd: r.forecast.sd, band: forecastBand(r.forecast.mid, r.forecast.sd) } : undefined;
    const measured = r.status === 'done' ? measureOf(s, result) : undefined;
    const from = r.kind === 'distill' ? m.versions.find((v) => v.id === r.teacherVersionId)?.name : m.bases.find((b) => b.id === r.baseId)?.name;
    let check: RunHistoryRow['check'];
    if (fc && measured) {
      const z = (measured.L - fc.mid) / Math.max(1e-6, fc.sd);
      check = { verdict: measured.L < fc.band[0] ? 'below' : measured.L > fc.band[1] ? 'above' : 'inside', z };
    }
    return {
      run: r, title: runHistoryTitle(r), lane: RUN_LANE[r.kind], start: r.startDay,
      ...(r.endDay !== undefined ? { end: r.endDay } : result ? { end: result.day } : {}),
      ...(result ? { result } : {}), ...(from ? { from } : {}), ...(fc ? { forecast: fc } : {}), ...(measured ? { measured } : {}), ...(check ? { check } : {}),
    };
  });
}

/** UB-B (NEW readout, DATA-b): a word for a run's hacking pressure (0–1, the lab's belief from its suites and budget):
 *  thirds of the scale. */
export type PressureLevel = 'Low' | 'Medium' | 'High';
export const pressureLevel = (x: number): PressureLevel => (x < 1 / 3 ? 'Low' : x < 2 / 3 ? 'Medium' : 'High');
