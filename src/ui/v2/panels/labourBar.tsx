// L3 (design/bal/LABOUR-ROUND.md §2): what AI can do on a job, what it does now, what limits it and what more compute or
// one more team would add. The bar is shared by the job card (LAB › AI staff & needs) and the Workforce row (LAB ›
// Board); the margin lines live on the job card only (one home per datum, .scratch/L3-IA.md).
import type { ReactNode } from 'react';
import type { WorkTypeView } from '../../../engine/v2';
import { WORK_TYPES } from '../../../data/v2/workTypes';
import { TEAM_SIZE } from '../../../data/v2/teams';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import './agents.css';

/** The job's split: people, the AI staff's headroom (can do, not doing yet) and what they do now; a marker where "can do" starts. */
export function LabourBar({ canDo, doingNow, mini }: { canDo: number; doingNow: number; mini?: boolean }) {
  const can = Math.min(1, Math.max(0, canDo));
  const doing = Math.min(can, Math.max(0, doingNow));
  return (
    <span className={`lb ${mini ? 'mini' : ''}`} data-test="labour-bar" data-can={can.toFixed(3)} data-doing={doing.toFixed(3)}>
      <i className="pp" style={{ flex: Math.max(1e-6, 1 - can) }} />
      <i className="gap" style={{ flex: Math.max(0, can - doing) }} />
      <i className="ai" style={{ flex: Math.max(0, doing) }} />
      {can > 0.001 && <b className="mk" style={{ left: `${(1 - can) * 100}%` }} />}
    </span>
  );
}

const pctWork = (x: number) => `${F.pct(x, Math.abs(x) < 0.1 ? 1 : 0, true)} work`;

/** Level 2: the formula's inputs in plain words (people and AI staff in team-equivalents, what AI can do, the regime). */
function detail(w: WorkTypeView, mg: NonNullable<WorkTypeView['margins']>): { label: ReactNode; value: string }[] {
  return [
    { label: 'People (team-equivalents)', value: F.num(w.humans, 1) },
    { label: 'AI staff (team-equivalents)', value: F.num(w.ai, 1) },
    { label: <Term id="coverage">Can do</Term>, value: F.pct(mg.canDo) },
    { label: <Term id="aiDoingNow">Doing now</Term>, value: F.pct(mg.doingNow) },
    { label: <Term id="labourBottleneck">Limited by</Term>, value: mg.bottleneck === 'ai' ? 'AI staff' : 'people' },
  ];
}

/** Why the job is limited, in words (the job card's one sentence). */
function limitWords(w: WorkTypeView, mg: NonNullable<WorkTypeView['margins']>): string {
  if (!(mg.canDo > 0.005)) return 'AI cannot do this job yet: a better model adds work';
  if (!(w.ai > 0)) return 'No AI staff on this job: give it compute';
  return mg.bottleneck === 'people' ? 'Limited by people: AI already does every task it can' : 'Limited by AI staff: more AI compute adds work';
}

/** One job's two margin lines and its bottleneck, or "No staff on this job" when no people staff it. */
function MarginBlock({ w, label }: { w: WorkTypeView; label?: string }) {
  const mg = w.margins;
  if (!mg) return null;
  const noStaff = !(w.humans > 1e-9);
  const heads = TEAM_SIZE[WORK_TYPES[w.wt].who as 'eng' | 're' | 'sci']; // one real team (L15: the work type's unit is a reference size)
  if (noStaff) {
    return (
      <div className="la-mgb" data-test={`margins.${w.wt}`}>
        {label && <span className="la-mgh small dim">{label}</span>}
        <Tip content={() => <TipCard title="No staff on this job">{`No team of people works on ${w.name.toLowerCase()} yet, so there is no work to add to: hire a team on Board.`}</TipCard>}><span className="small dim" data-test={`nostaff.${w.wt}`}>No staff on this job</span></Tip>
      </div>
    );
  }
  const words = limitWords(w, mg);
  const why = mg.bottleneck === 'ai' ? 'AI and people share the tasks AI can do, so AI staff are what limits the job.' : 'AI already takes every task it can, so people are what limit the job.';
  return (
    <div className="la-mgb" data-test={`margins.${w.wt}`}>
      {label && <span className="la-mgh small dim">{label}</span>}
      <Tip content={() => <TipCard title={<Term id="marginCompute">+10% AI compute</Term>} value={pctWork(mg.plusCompute)} rows={detail(w, mg)}>{`Work this job gains from 10% more compute for its AI staff. ${why} Work done, not research speed.`}</TipCard>}>
        <div className="la-mg" data-test={`margin.compute.${w.wt}`}><Term id="marginCompute">+10% AI compute</Term><b className={`num ${mg.plusCompute > 0.0005 ? 'tone-pos' : 'dim'}`}>{pctWork(mg.plusCompute)}</b></div>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="marginTeam">+1 team</Term>} value={pctWork(mg.plusTeam)} rows={[...detail(w, mg), { label: 'One team', value: `${F.count(heads)} people` }]}>{`Work this job gains from one more team of its people. ${why} Work done, not research speed.`}</TipCard>}>
        <div className="la-mg" data-test={`margin.team.${w.wt}`}><Term id="marginTeam">+1 team</Term><b className={`num ${mg.plusTeam > 0.0005 ? 'tone-pos' : 'dim'}`}>{pctWork(mg.plusTeam)}</b></div>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="labourBottleneck">Limited by</Term>} value={mg.bottleneck === 'ai' ? 'AI staff' : 'people'} rows={detail(w, mg)}>{why}</TipCard>}>
        <div className="la-lim small dim" data-test={`bottleneck.${w.wt}`}>{words}</div>
      </Tip>
    </div>
  );
}

/** The margin lines of a job card: one block (one job) or two (safety: experiments and ideas). */
export function JobMargins({ ws }: { ws: WorkTypeView[] }) {
  const shown = ws.filter((w) => w.margins);
  if (!shown.length) return null;
  return <div className="la-mgs">{shown.map((w) => <MarginBlock key={w.wt} w={w} label={shown.length > 1 ? w.name : undefined} />)}</div>;
}
