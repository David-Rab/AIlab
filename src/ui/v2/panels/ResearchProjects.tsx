// Research › Projects (model v3 V2b; mockups-v3/v3-v2b-research, IA v3-v2b-IA.md). L1: the priority list of capability
// projects (order, teams wanted, stage track, what binds, next result) with the lab's risk policy; L2: the selected
// project's card under the list (B4: full width, its sections side by side, so a short list leaves no empty column) (stage track, belief band, odds, inputs c and ℓ, the line's pool, its teams and why). The game assigns
// teams, research engineers and compute down this list; the player only orders it, sets teams wanted and the policy.
// One home per datum: research speed lives on Company › Flow, research engineers' needs on Company › Work (links).
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { addableProjects, capPriorityList, dateOf, fmtDate, PROJECT_MAX_TEAMS, researchMods, STAGES, UNLOCK_STAGES } from '../../../engine/v2';
import type { CapProjectView, GameStateV2, StageId } from '../../../engine/v2';
import { COLUMN_LABEL, QUALITY } from '../../../data/v2/teams';
import type { Column } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import { ICON } from '../icons';
import * as F from '../fmt';

const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const STAGE_LABEL: Record<StageId, string> = { test: 'Test', ideation: 'Ideas', small: 'Small test', scale: 'Big test', adoption: 'Build-in' };
const STAGE_SHORT: Record<StageId, string> = { test: 'Test', ideation: 'Ideas', small: 'Small test', scale: 'Big test', adoption: 'Build-in' };
const STAGE_TERM: Record<StageId, string> = { test: 'stageTest', ideation: 'stageIdeation', small: 'stageSmall', scale: 'stageScale', adoption: 'stageAdoption' };
const STACK_NAME: Record<string, string> = { pre: 'pretraining', rlMid: 'RL efficiency', rlCeil: 'RL ceiling', train: 'training throughput', serve: 'serving' };
const RISK_OPTS = [{ v: 'safe', label: 'Safe' }, { v: 'balanced', label: 'Balanced' }, { v: 'speculative', label: 'Speculative' }] as const;

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
export const eta = (d: number) => (!Number.isFinite(d) ? '—' : d < 1 ? '<1 d' : F.days(d));
/** Effect in its unit: OOM (stack ideas) with enough digits for small numbers, × of design (domain effects). */
export const fmtEff = (x: number, unit: CapProjectView['unit'] = 'oom', signed = true) => {
  if (unit === 'design') return `×${x.toFixed(2)}`;
  const a = Math.abs(x);
  const s = signed && x > 0 ? '+' : x < 0 ? '−' : '';
  if (a > 0 && a < 0.001) return `${s}${a.toExponential(1).replace('e-', 'e−')}`;
  const d = a === 0 ? 2 : a < 0.01 ? 4 : a < 0.1 ? 3 : 2;
  return `${s}${a.toFixed(d)}`;
};
/** RD-R05: an unlock project's steps (test, build-in); the idea pipeline's four otherwise. */
const stagesOfView = (v: CapProjectView): readonly StageId[] => (v.unlock ? UNLOCK_STAGES : STAGES);
const sci = (x: number) => (x > 0 ? x.toExponential(1).replace('e+', 'e') : '0');
const Q_N = { solid: 1, strong: 2, elite: 3 } as const;

/** Four-step stage track: done steps filled, the current one partial, later ones empty. */
export function StageTrack({ v, big = false }: { v: CapProjectView; big?: boolean }) {
  const steps = stagesOfView(v);
  const cur = steps.indexOf(v.stage);
  const failed = v.state === 'failed';
  return (
    <div className={`rp-track ${big ? 'big' : ''} ${failed ? 'failed' : ''} ${v.state === 'waiting' ? 'waiting' : ''}`} data-test={`track.${v.id}`} data-stage={v.stage}>
      {steps.map((st, i) => (
        <Tip key={st} content={() => <TipCard title={<Term id={STAGE_TERM[st]}>{STAGE_LABEL[st]}</Term>} value={i < cur ? 'done' : i === cur ? (st === 'adoption' ? `engineers: ${eta(v.adoption?.eta ?? Infinity)}` : F.pct(v.stageFrac)) : 'later'}>
          {st === 'test' ? `Chance it works: ${F.pct(v.odds)}. Science teams, research engineers and compute do the work; then it works or it doesn't.` : st === 'ideation' ? `Candidates found: ${v.cands} (the team tests one once it has ${v.pickAt}).` : st === 'adoption' && v.adoption ? `${v.adoption.tw.toFixed(1)} engineer team-weeks left.` : undefined}
        </TipCard>}>
          <i className={i < cur ? 'done' : i === cur ? 'cur' : ''}>{i === cur && <b style={{ width: `${Math.round((st === 'adoption' ? 1 : v.stageFrac) * 100)}%` }} />}</i>
        </Tip>
      ))}
    </div>
  );
}

function TeamDots({ v }: { v: CapProjectView }) {
  const n = Math.max(v.want, v.teams.length);
  return (
    <span className="rp-dots">
      {Array.from({ length: n }, (_, i) => {
        const t = v.teams[i];
        return (
          <Tip key={i} content={() => t ? <TipCard title={`${t.specialty ? COLUMN_LABEL[t.specialty as Column] : 'Science'} team`} value={QUALITY[t.quality].label} rows={[{ label: 'People', value: F.count(t.heads) }, { label: <Term id="specialtyBonus">Specialty</Term>, value: t.match ? '×1.5' : '×1.0' }]}><Term id="scienceWhy">Why here</Term>: {t.why}</TipCard>
            : <TipCard title="Wanted, not placed">No free team: higher-priority projects took them. Hire science teams or lower another project's teams wanted.</TipCard>}>
            <i className={t ? (t.quality === 'elite' ? 'el' : '') : 'off'} data-team={t?.id} />
          </Tip>
        );
      })}
    </span>
  );
}

/** Teams-wanted stepper (0 pauses the project, max 6) and the Auto toggle (B4: the game picks the number by priority and
 *  fit; − / + from auto fix the number at the placed count ∓ 1). */
function WantStepper({ v }: { v: CapProjectView }) {
  const shown = v.auto ? 'auto' : v.want === PROJECT_MAX_TEAMS ? 'max' : String(v.want);
  return (
    <span className="stepper" data-test={`want.${v.id}`}>
      <ActBtn id="research.want" testId={`want-down.${v.id}`} ariaLabel={`Fewer teams wanted for ${v.name}`} params={{ id: v.id, n: Math.max(0, v.want - 1) }} icon={ICON.minus} label="" block={v.want <= 0 && !v.auto ? 'Already 0 (paused)' : undefined} />
      <Tip content={() => <TipCard title={<Term id="teamsWanted">Teams wanted</Term>} value={shown} rows={[{ label: 'Placed', value: String(v.teams.length) }]}>{v.auto ? 'Auto: one team first, then the spare science teams go where they add the most progress, by priority and fit. Fixed numbers on other projects are filled first; − or + fixes the number.' : v.want === 0 ? 'No science teams: no new candidates. A candidate already in test keeps its engineers and compute until it is read.' : 'The game fills the list in order, best specialty first.'}</TipCard>}>
        <b className={`num ${v.auto ? 'rp-auto-n' : ''}`} data-test={`want-n.${v.id}`}>{v.auto ? <>{v.want}<span className="dim small"> auto</span></> : shown}</b>
      </Tip>
      <ActBtn id="research.want" testId={`want-up.${v.id}`} ariaLabel={`More teams wanted for ${v.name}`} params={{ id: v.id, n: Math.min(PROJECT_MAX_TEAMS, v.want + 1) }} icon={ICON.plus} label="" block={v.want >= PROJECT_MAX_TEAMS ? `At most ${PROJECT_MAX_TEAMS} teams per project` : undefined} />
      <Tip content={() => <TipCard title={<Term id="teamsWantedAuto">Auto teams wanted</Term>} value={v.auto ? 'on' : 'off'}>{v.auto ? `On: the game picks how many teams ${v.name} gets, by priority and fit. Click to fix it at ${v.want}.` : 'Let the game pick the number: one team first, then spare science teams where they add the most progress, by priority and fit.'}</TipCard>}>
        <button className={`btn btn-sm rp-auto ${v.auto ? 'on' : 'btn-ghost'}`} data-act={`want-auto.${v.id}`} aria-pressed={v.auto} aria-label={`Auto teams wanted for ${v.name}`}
          onClick={() => store.act('research.want', v.auto ? { id: v.id, n: v.want } : { id: v.id, auto: true })}>Auto</button>
      </Tip>
    </span>
  );
}

/** +10% of an input → believed % speed-up, with the band when it is wider than the rounding (RD-UI0a). */
const bandPct = (e: number, band: [number, number]) => {
  const f = (x: number) => F.pct(Math.pow(1.1, x) - 1, 1, true);
  return f(band[0]) === f(band[1]) ? f(e) : `${f(e)} (${f(band[0])} to ${f(band[1])})`;
};

/** What binds the project's experiments (compute or labour), believed, with the elasticities and their band. */
function Binds({ v }: { v: CapProjectView }) {
  if (v.bound === 'none' || v.state === 'adopting' || v.state === 'failed') return <span className="dim small">—</span>;
  const term = v.bound === 'compute' ? 'computeBound' : 'laborBound';
  return (
    <Tip content={() => <TipCard title={<Term id={term}>{v.bound === 'compute' ? 'Compute-bound (believed)' : 'Labour-bound (believed)'}</Term>} rows={[
      { label: <Term id="expCompute">+10% experiment compute</Term>, value: bandPct(v.eC, v.eCBand) },
      { label: <Term id="expLabour">+10% research engineers</Term>, value: bandPct(v.eL, v.eLBand) },
    ]}>{`${v.re > 0 ? 'Speed of this project\'s experiments.' : 'What would bind once it reaches experiments (it gets research engineers then).'} Believed, from the published estimate of how research responds to compute and labour; the range is its 80% band.`}</TipCard>}>
      <span className={`rp-bind ${v.bound}`} data-test={`binds.${v.id}`}>{v.bound}</span>
    </Tip>
  );
}

function Next({ v }: { v: CapProjectView }) {
  const label = v.state === 'failed' ? 'failed' : v.state === 'adopting' ? `build ${eta(v.adoption?.eta ?? Infinity)}` : v.want === 0 && !v.teams.length ? (v.stage === 'small' || v.stage === 'scale' || (v.stage === 'test' && v.re > 0) ? 'test only' : 'paused') : eta(v.eta);
  return (
    <Tip content={() => <TipCard title={v.kind === 'line' ? 'Next result' : 'Result'} value={label} rows={v.state === 'adopting' ? [{ label: <Term id="stageAdoption">Build-in</Term>, value: v.adoption ? `${v.adoption.tw.toFixed(1)} engineer team-weeks left` : 'queued' }] : v.unlock ? [
      { label: <Term id="stageTest">Test</Term>, value: eta(v.etaParts.experiments) },
      { label: <Term id="odds">Chance it works</Term>, value: F.pct(v.odds) },
    ] : [
      { label: <Term id="stageIdeation">Ideas</Term>, value: eta(v.etaParts.ideation) },
      { label: <Term id="stageSmall">Small and big tests</Term>, value: eta(v.etaParts.experiments) },
    ]}>{v.wait ? v.wait : v.unlock ? 'At today\'s teams, research engineers and compute; when the test ends it works or it does not.' : 'At today\'s teams, research engineers and compute; candidates can be dropped, which restarts the ideas step.'}</TipCard>}>
      <span className={`num ${v.state === 'failed' ? 'tone-neg' : ''}`} data-test={`next.${v.id}`}>{label}</span>
    </Tip>
  );
}

function SubLine({ v }: { v: CapProjectView }) {
  const bits: ReactNode[] = [<span key="a">{v.area}</span>];
  if (v.line) bits.push(<Tip key="l" content={() => <TipCard title={<Term id="linePool">Line so far</Term>} rows={[{ label: 'Ideas adopted or in build', value: String(v.line?.gen ?? 0) }, { label: <Term id="linePool">Realised</Term>, value: `${fmtEff(v.line?.realised ?? 0)} OOM` }]} />}><span>{v.line.gen} ideas · {fmtEff(v.line.realised)} OOM</span></Tip>);
  else bits.push(<Tip key="o" content={() => <TipCard title={<Term id="odds">Odds</Term>} value={F.pct(v.odds)}>{v.spec ? `Speculative reopening ${v.spec}: odds halved each time.` : 'Chance the direction works in this world.'}</TipCard>}><span>odds {F.pct(v.odds)}</span></Tip>);
  if (v.wait && v.state === 'waiting') bits.push(<span key="w" className="tone-warn">{v.wait}</span>);
  return <span className="small dim rp-sub">{bits.map((b, i) => <span key={i}>{i > 0 && ' · '}{b}</span>)}</span>;
}

function Row({ s, v, sel, capQ, onDrop }: { s: GameStateV2; v: CapProjectView; sel: boolean; capQ: string[]; onDrop: (from: string, to: string) => void }) {
  const q = s.player.research.queue;
  const i = capQ.indexOf(v.id);
  const Ic = COL_ICON[v.column as Column];
  const move = (d: number) => {
    const target = capQ[i + d];
    if (target) store.act('research.move', { id: v.id, to: q.indexOf(target) });
  };
  return (
    <div className={`rp-row ${sel ? 'sel' : ''} st-${v.state}`} data-project={v.id} draggable tabIndex={0} aria-label={`Priority ${v.rank}: ${v.name}. Enter opens its card; Alt+Up or Alt+Down moves it.`}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', v.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); if (from && from !== v.id) onDrop(from, v.id); }}
      onKeyDown={(e) => {
        // B4: keyboard path for reordering (the drag's equivalent): Alt+↑ / Alt+↓ on a focused row, Enter opens its card.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') { e.preventDefault(); setUi('proj', v.id); }
        else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(e.key === 'ArrowUp' ? -1 : 1); }
      }}
      onClick={() => setUi('proj', v.id)}>
      <span className="rp-grip"><GripVertical size={13} /></span>
      <Tip content={() => <TipCard title={<Term id="projectQueue">Priority</Term>} value={`#${v.rank}`}>Drag, ▲▼, or Alt+↑ / Alt+↓ on a focused row (Tab to it) to reorder. Teams, research engineers and compute go down the list.</TipCard>}><span className="rp-rk num">{v.rank}</span></Tip>
      <span className="rp-nm"><span className="row-i"><Ic size={13} /><b className="ellip">{v.name}</b><span className={`rp-kind ${v.kind}`}><Term id="projectKind">{v.kind}</Term></span></span><SubLine v={v} /></span>
      <StageTrack v={v} />
      <span className="row-i" onClick={(e) => e.stopPropagation()}><WantStepper v={v} /><TeamDots v={v} /></span>
      <Binds v={v} />
      <Next v={v} />
      <span className="rp-mv" onClick={(e) => e.stopPropagation()}>
        <Tip content={() => <TipCard title="Move up" value={i <= 0 ? 'already first' : `#${v.rank} → #${v.rank - 1}`}>Raises the priority: teams, research engineers and compute reach it sooner. Keyboard: Alt+↑ on the row.</TipCard>}>
          <button className="btn btn-sm btn-ghost" disabled={i <= 0} data-test={`prio-up.${v.id}`} aria-label={`Move ${v.name} up`} onClick={() => move(-1)}><ChevronUp size={12} /></button>
        </Tip>
        <Tip content={() => <TipCard title="Move down" value={i >= capQ.length - 1 ? 'already last' : `#${v.rank} → #${v.rank + 1}`}>Lowers the priority. Keyboard: Alt+↓ on the row.</TipCard>}>
          <button className="btn btn-sm btn-ghost" disabled={i >= capQ.length - 1} data-test={`prio-down.${v.id}`} aria-label={`Move ${v.name} down`} onClick={() => move(1)}><ChevronDown size={12} /></button>
        </Tip>
      </span>
    </div>
  );
}

/** Add an open capability project to the bottom of the list. */
function AddProject({ s }: { s: GameStateV2 }) {
  const opts = addableProjects(s);
  return (
    <Tip content={() => <TipCard title="Add a project" value={`${opts.length} open`}>Adds it to the bottom of the priority list; move it up to give it teams sooner. The Tree tab shows what each one does and needs.</TipCard>}>
      <select className="chip-select rp-add" data-test="add-project" value="" onChange={(e) => { if (e.target.value) store.act('research.queue', { id: e.target.value }); }}>
        <option value="">+ Add project</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.kind} · {o.area}</option>)}
      </select>
    </Tip>
  );
}

/** A frontier pause or a Safety framework training hold gives capability projects no experiment compute (RD-A07):
 *  say so where the projects stall, with the cause and where to act. */
function ExpHeld({ s }: { s: GameStateV2 }) {
  if (researchMods(s).frontierExp > 0) return null;
  const holds = (s.player.safety.framework?.holds ?? []).filter((h) => h.target === 'training');
  const why = holds.length
    ? holds.map((h) => `${h.versionId}: needs ${h.missing.join(', ')}`).join('; ')
    : 'frontier work is paused';
  return (
    <div className="rp-foot small" data-test="exp-held">
      <span className="tone-warn">Experiments held: capability projects get no experiment compute while {holds.length ? <>your <Term id="safetyFramework">Safety framework</Term> holds frontier training</> : 'frontier work is paused'} ({why}). The experiment compute in your split sits unused.</span>
      {holds.length > 0 && <> <Ref id="safetyFramework" to={{ panel: 'safety', tab: 'overview', anchor: 'ctl-policy' }}>Safety policies</Ref></>}
    </div>
  );
}

export function Priorities({ s }: { s: GameStateV2 }) {
  const pl = capPriorityList(s);
  const selId = ui('proj', pl.list[0]?.id ?? '');
  const risk = s.player.research.risk ?? 'balanced';
  const teams = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap');
  const placed = teams.filter((t) => t.projectId).length;
  const q = s.player.research.queue;
  const capQ = pl.list.map((x) => x.id);
  const onDrop = (from: string, to: string) => store.act('research.move', { id: from, to: q.indexOf(to) });
  return (
    <Card className="rp-list" home="priorities" title={<span className="row-i"><ICON.experiments size={14} /><Term id="projectQueue">Priorities</Term></span>}
      sub={<Tip content={() => <TipCard title="Capability science teams" rows={[{ label: 'Teams', value: String(teams.length) }, { label: 'Placed', value: String(placed) }, { label: 'Idle', value: String(teams.length - placed) }]}>The game places them down this list. Safety teams work on Safety › Research lines.</TipCard>}>
        <span>{pl.list.length} projects · {placed}/{teams.length} science teams placed</span></Tip>}
      right={(
        <span className="row-i">
          <Tip content={() => <TipCard title={<Term id="riskPolicy">Risk policy</Term>} value={risk}>Which candidate each team tests: safe = surer and smaller, speculative = bigger and less certain.</TipCard>}><span className="small dim"><Term id="riskPolicy">Risk policy</Term></span></Tip>
          <span className="seg" data-test="risk-policy">
            {RISK_OPTS.map((o) => <button key={o.v} className={`seg-btn ${risk === o.v ? 'active' : ''}`} data-opt={o.v} onClick={() => store.act('research.risk', { risk: o.v })}>{o.label}</button>)}
          </span>
          <AddProject s={s} />
        </span>
      )}>
      <div className="rp-head"><span /><span>#</span><span>Project</span><span><Term id="projectStage">Stage</Term></span><span><Term id="teamsWanted">Teams wanted</Term></span><span><Term id="bottleneck">Binds</Term></span><span>Next</span><span /></div>
      <ExpHeld s={s} />
      {pl.list.length === 0 && <div className="dim small rs-empty">No capability projects. Add one with + Add project, or from the Tree tab.</div>}
      {pl.list.map((v) => <Row key={v.id} s={s} v={v} sel={v.id === selId} capQ={capQ} onDrop={onDrop} />)}
      {pl.failed.map((v) => (
        <div key={v.id} className="rp-fail" data-failed={v.id} onClick={() => setUi('proj', v.id)}>
          <span className={`rp-kind ${v.kind}`}>{v.kind}</span><b>{v.name}</b>
          <Tip content={() => <TipCard title="Failed" rows={[{ label: 'Candidates dropped', value: String(v.maxDrops) }, { label: <Term id="odds">Odds if reopened</Term>, value: F.pct(v.odds) }]}><Term id="reopenSpeculative">Reopen</Term>: odds halve, the expected effect falls to 70% and the spread widens.</TipCard>}>
            <span className="dim small">failed: {v.maxDrops} candidates dropped · reopen at {F.pct(v.odds)}</span>
          </Tip>
          <span className="sp" />
          <ActBtn id="research.reopen" params={{ id: v.id }} label="Reopen as speculative" testId={`reopen.${v.id}`} />
        </div>
      ))}
      {pl.idleTeams.length > 0 && <div className="rp-foot small"><Tip content={() => <TipCard title="Idle science teams" rows={pl.idleTeams.map((t) => ({ label: t.id, value: '' }))}>{pl.idleTeams[0].why}</TipCard>}><span className="tone-warn" data-test="idle-teams">{pl.idleTeams.length} idle: {pl.idleTeams[0].why.replace(/^Idle: /, '')}</span></Tip></div>}
    </Card>
  );
}

/** Belief band on a number line from 0: the band (± 1 SD), its mean, and a reference marker (the next prior). */
function BeliefBand({ mu, sd, ref, unit }: { mu: number; sd: number; ref?: number; unit: CapProjectView['unit'] }) {
  const hi = Math.max(1e-12, mu + 2.2 * sd, (ref ?? 0) * 1.3, mu * 1.4);
  const lo = Math.min(0, mu - 2.2 * sd);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="rp-band" data-test="belief-band">
      <i className="ax" /><i className="zero" style={{ left: x(0) }} />
      <i className="bd" style={{ left: x(mu - sd), width: `${((2 * sd) / (hi - lo)) * 100}%` }} />
      <i className="mu" style={{ left: x(mu) }} />
      {ref !== undefined && <i className="pr" style={{ left: x(ref) }} />}
      <span className="lo small dim">{fmtEff(lo, unit, false)}</span><span className="hi small dim">{fmtEff(hi, unit, false)}</span>
    </div>
  );
}

function Sec({ k, children, term }: { k: string; term?: string; children: ReactNode }) {
  return <div className="rp-sec"><div className="rp-k">{term ? <Term id={term}>{k}</Term> : k}</div>{children}</div>;
}
function KVr({ k, v, tip }: { k: ReactNode; v: ReactNode; tip: () => ReactNode }) {
  return <div className="rp-kv"><span>{k}</span><Tip content={tip}><span className="num">{v}</span></Tip></div>;
}

/** L2 card of the selected project. */
export function ProjectCard({ s }: { s: GameStateV2 }) {
  const pl = capPriorityList(s);
  const all = [...pl.list, ...pl.failed];
  const v = all.find((x) => x.id === ui('proj')) ?? all[0];
  if (!v) return <Card className="rp-card" title="Project"><div className="dim small">Add a capability project to see its stages, beliefs and inputs.</div></Card>;
  const Ic = COL_ICON[v.column as Column];
  const unitLbl = v.unit === 'oom' ? 'OOM' : v.unit === 'design' ? 'of design' : '';
  const steps = stagesOfView(v);
  const cur = steps.indexOf(v.stage);
  const cMax = Math.max(v.c, v.l, 1);
  const rel = (x: number) => Math.min(100, (Math.log10(1 + x) / Math.log10(1 + cMax * 1.2)) * 100);
  return (
    <Card className="rp-card" home="projectCard" title={<span className="row-i"><Ic size={15} /><span data-test="project-card" data-card={v.id}>{v.name}</span></span>}
      sub={<span className="row-i"><span className={`rp-kind ${v.kind}`}><Term id="projectKind">{v.kind}</Term></span><span>{v.area}{v.stack ? ` · ${STACK_NAME[v.stack]} stack` : v.unit === 'design' ? ' · domain effect' : ' · unlock'}</span></span>}
      right={<span className="row-i">{v.state !== 'failed' && <ActBtn id="research.dequeue" params={{ id: v.id }} icon={X} label="Remove" testId={`dequeue.${v.id}`} />}<button className="btn btn-sm btn-ghost" data-test="project-tree" onClick={() => { setUi('sel', v.id); store.setTab('research', 'tree'); }}>Tree ›</button></span>}>
      <StageTrack v={v} big />
      <div className="rp-tlab">{steps.map((st, i) => <span key={st} className={i === cur ? 'cur' : ''}><Term id={STAGE_TERM[st]}>{STAGE_SHORT[st]}</Term>{i === cur && (st === 'small' || st === 'scale' || st === 'ideation' || st === 'test') ? <Tip content={() => <TipCard title={STAGE_LABEL[st]} value={F.pct(v.stageFrac)}>{st === 'ideation' ? 'Toward the candidates a team picks from.' : 'Work done in this stage.'}</TipCard>}><span> {F.pct(v.stageFrac)}</span></Tip> : null}</span>)}</div>
      <div className="rp-secs">
      {v.state === 'failed' && <div className="rp-sec"><span className="tone-neg small">{v.unlock ? <>The test showed it does not work on this attempt. A speculative reopening works with odds {F.pct(v.odds)}.</> : <>The team gave up after {v.maxDrops} weak candidates. Weak results can be bad luck: a speculative reopening works with odds {F.pct(v.odds)}.</>}</span> <ActBtn id="research.reopen" params={{ id: v.id }} label="Reopen as speculative" /></div>}
      {(v.belief || v.result) && (
        <Sec k={v.result && !v.belief ? 'Result · estimate at your latest base' : 'Belief · candidate in test'} term="beliefBand">
          {v.belief && <BeliefBand mu={v.belief.mu} sd={v.belief.sd} ref={v.line?.nextPrior !== undefined ? v.line.nextPrior * v.belief.b : undefined} unit={v.unit} />}
          {v.belief && <KVr k={<>Effect at small scale{v.belief.b > 1 ? ` (${v.belief.b} ideas)` : ''}</>} v={`${fmtEff(v.belief.mu, v.unit)} ± ${fmtEff(v.belief.sd, v.unit, false)} ${unitLbl}`} tip={() => <TipCard title={<Term id="beliefBand">Belief</Term>} rows={[{ label: 'Novelty', value: F.pct(v.belief?.nov ?? 0) }, { label: <Term id="researchTaste">Team taste</Term>, value: `×${v.taste.toFixed(2)}` }]}>Mean ± one SD. Novel candidates are bigger if they work and less certain; small experiments narrow the band, the scale test reads it at scale.</TipCard>} />}
          {v.belief && v.unit === 'oom' && <KVr k={<Term id="scaleBehaviour">Scale behaviour</Term>} v={`${v.belief.sMu > 0.02 ? 'grows' : v.belief.sMu < -0.02 ? 'fades' : 'holds'} (s ${F.num(v.belief.sMu, 2, true)} ± ${v.belief.sSd.toFixed(2)})`} tip={() => <TipCard title={<Term id="scaleBehaviour">Scale behaviour</Term>} value={v.belief?.tested ? 'measured at the scale test' : 'prior'}>Effect × (run FLOP ÷ test FLOP)^s.</TipCard>} />}
          {v.line && <KVr k={<><Term id="nextPrior">Next idea's prior</Term> <span className="dim">(dashed)</span></>} v={`${fmtEff(v.line.nextPrior * (v.belief?.b ?? 1))} OOM`} tip={() => <TipCard title={<Term id="nextPrior">Next prior</Term>} value={`${fmtEff(v.line?.nextPrior ?? 0)} OOM per idea`}>What your teams on it expect from the line's next idea now (their taste is research input per idea).</TipCard>} />}
          {v.result && <KVr k={<Term id="stageResult">Estimate at latest base</Term>} v={`${fmtEff(v.result.est, v.unit)} ± ${fmtEff(v.result.estSd, v.unit, false)} ${unitLbl}`} tip={() => <TipCard title={<Term id="stageResult">Result</Term>} value={fmtDate(dateOf(s, v.result?.day ?? 0))}>The final estimate band. The true effect shows on Recipe once a model trained with it is evaluated.</TipCard>} />}
        </Sec>
      )}
      {v.unlock && v.state !== 'failed' && v.state !== 'known' && <Sec k="Test" term="stageTest"><KVr k={<Term id="odds">Chance it works</Term>} v={F.pct(v.odds)} tip={() => <TipCard title={<Term id="odds">Chance it works</Term>} rows={[{ label: 'Speculative reopenings', value: String(v.spec) }]}>One test: when its work is done it works (the engineers build it in) or it does not (reopen at half the odds).</TipCard>} />{v.state !== 'adopting' && <KVr k="Time left" v={eta(v.eta)} tip={() => <TipCard title={<Term id="stageTest">Test</Term>} value={F.pct(v.stageFrac)}>At today's science teams, research engineers and compute.</TipCard>} />}</Sec>}
      {v.kind !== 'line' && !v.unlock && v.state !== 'failed' && <Sec k="Odds" term="odds"><KVr k="Works in this world" v={F.pct(v.odds)} tip={() => <TipCard title={<Term id="odds">Odds</Term>} rows={[{ label: 'Candidates dropped', value: `${v.drops} of ${v.maxDrops}` }, { label: 'Speculative reopenings', value: String(v.spec) }]}>Three dropped candidates in a row end the project as failed.</TipCard>} /></Sec>}
      {v.state !== 'failed' && v.state !== 'adopting' && (
        <Sec k="Inputs today" term="prodfn">
          <div className="rp-bars">
            <Tip content={() => <TipCard title={<Term id="expCompute">Experiment compute c</Term>} value={`×${v.c.toFixed(2)}`} rows={[{ label: 'FLOP per day', value: sci(v.flopDay) }]}>Leader lab's day-0 project = 1.</TipCard>}><span className="row-i"><Term id="expCompute">Compute c</Term></span></Tip>
            <span className="hb"><i style={{ width: `${rel(v.c)}%`, background: 'var(--warn)' }} /></span><Tip content={() => <TipCard title="c" value={`×${v.c.toFixed(2)}`} />}><span className="num">×{v.c.toFixed(1)}</span></Tip>
            <Tip content={() => <TipCard title={<Term id="expLabour">Experiment labour ℓ</Term>} value={`×${v.l.toFixed(2)}`} rows={[{ label: 'Research engineers', value: `${v.re.toFixed(1)} team-eq` }]}>With the agents' help, to the power λ.</TipCard>}><span className="row-i"><Term id="expLabour">Labour ℓ</Term></span></Tip>
            <span className="hb"><i style={{ width: `${rel(v.l)}%`, background: '#5aa9ff' }} /></span><Tip content={() => <TipCard title="ℓ" value={`×${v.l.toFixed(2)}`} />}><span className="num">×{v.l.toFixed(1)}</span></Tip>
          </div>
          <div className="rp-kv"><span>What binds</span><Binds v={v} /></div>
          <KVr k={<>Research engineers · FLOP</>} v={v.re > 0 ? `${v.re.toFixed(1)} team-eq · ${sci(v.flopDay)}/day` : 'none yet (in ideation)'} tip={() => <TipCard title="Research engineers on it" value={`${v.re.toFixed(1)} team-eq`} rows={[{ label: 'Experiment FLOP per day', value: sci(v.flopDay) }]}>Given to projects in experiments in priority order; compute follows them.</TipCard>} />
          <div className="rp-kv"><span /><Limit id="research.rePerProject" tone={v.re >= 2 - 1e-9 ? 'warn' : 'quiet'}>≤ 2 team-eq per project</Limit><Ref id="reNeeds" to={{ panel: 'company', tab: 'work' }}>Research engineers</Ref></div>
        </Sec>
      )}
      {v.line && (
        <Sec k="Pool · ideas get harder" term="linePool">
          <KVr k={<Term id="linePool">Realised so far</Term>} v={`${fmtEff(v.line.realised)} OOM · ${v.line.gen} ideas`} tip={() => <TipCard title={<Term id="linePool">Line</Term>} rows={[{ label: 'Returns r of the line', value: v.line?.r.toFixed(2) ?? '' }, { label: 'Research input so far', value: F.short(v.line?.input ?? 0) }]}>r × log₁₀ of the research input over the start.</TipCard>} />
          <KVr k="Ideas harder than at the start" v={`×${F.short(v.line.harder)}`} tip={() => <TipCard title={<Term id="linePool">Ideas get harder</Term>} value={`×${F.short(v.line?.harder ?? 1)}`}>Each result raises the line's research input; the next idea's prior falls with it.</TipCard>} />
        </Sec>
      )}
      <Sec k="Science teams · why here" term="scienceWhy">
        {v.teams.length === 0 && <div className="small dim">{v.want === 0 ? (v.stage === 'test' ? 'Teams wanted 0: research engineers and compute carry the test on.' : v.stage === 'small' || v.stage === 'scale' ? 'Teams wanted 0: no new candidates; the test in progress continues.' : 'Teams wanted 0: paused.') : 'None placed: higher-priority projects took the teams.'}</div>}
        {v.teams.map((t, k) => {
          const TI = t.specialty ? COL_ICON[t.specialty as Column] : ICON.roleSci;
          // F6d: teams of the same specialty are numbered (two "Pretraining" rows read as a duplicate).
          const same = v.teams.filter((x) => x.specialty === t.specialty);
          const nth = same.length > 1 ? ` ${v.teams.slice(0, k + 1).filter((x) => x.specialty === t.specialty).length}` : '';
          return (
            <div key={t.id} className="rp-team" data-team={t.id}>
              <TI size={13} /><b>{t.specialty ? COLUMN_LABEL[t.specialty as Column] : 'Science'}{nth}</b>
              <Tip content={() => <TipCard title={<Term id="teamQuality">{QUALITY[t.quality].label}</Term>} rows={[{ label: 'People', value: F.count(t.heads) }]} />}><span className={`qdots q-${t.quality}`}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[t.quality] ? 'on' : ''} />)}</span></Tip>
              <span className="why small">{t.why}</span>
            </div>
          );
        })}
        <div className="rp-kv"><span /><Limit id="research.maxTeams" tone={v.want >= PROJECT_MAX_TEAMS ? 'warn' : 'quiet'}>max {PROJECT_MAX_TEAMS} teams</Limit></div>
      </Sec>
      </div>
    </Card>
  );
}
