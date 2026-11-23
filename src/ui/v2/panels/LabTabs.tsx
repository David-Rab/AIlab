// LAB's L2 tabs (UB-5; was the Company panel): Hiring & teams (headcount, hiring, payroll, morale), AI staff & needs
// (the AI staff per job: model, monitor, compute, AI share allowed; the needs order editor) and Security (WSL, siloing,
// counter-intel). The LAB board (Lab.tsx) is the home of the allocation, the workforce lines and Best moves.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { WSL_TARGET_RANGE, fillWeeks, fullTeamPayroll, payrollOf, queuedOfKey, securityFloorView, teamGain, teamPayroll, teamsOfKey, weeklyHireCap } from '../../../engine/v2';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { COLUMN_LABEL, MOVE_SAFETY_MORALE, QUALITY, STAR_HIRE, TEAM_KEYS, TEAM_SIZE } from '../../../data/v2/teams';
import type { Column, GameStateV2, Team, TeamDept, TeamKey, TeamQuality, TeamRole } from '../../../engine/v2';
import { AgentsAtWork } from './Agents';
import { Work } from './Work';
import { ActBtn, Limit, Slider, Term, Tip, TipCard, Why } from '../ui';
import { Card, HBar, KV, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { SPHERE } from '../theme';

// ───────── People: teams by role, hiring (STRUCTURE §4.1; mockups-v3 v3-company without the agent lanes) ─────────
const ROLE_ICON: Record<TeamRole, typeof ICON.L> = { eng: ICON.roleEng, re: ICON.roleRE, sci: ICON.roleSci };
const ROLE_TERM: Record<TeamRole, string> = { eng: 'roleEng', re: 'roleRE', sci: 'roleSci' };
const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const Q_N: Record<TeamQuality, number> = { solid: 1, strong: 2, elite: 3 };
const KEY_SHORT: Record<TeamKey, string> = { eng: 'Engineers', 're.cap': 'Research engineers', 'sci.cap': 'Scientists', 're.saf': 'Safety research engineers', 'sci.saf': 'Safety scientists' };
const keyIcon = (k: TeamKey) => ROLE_ICON[k === 'eng' ? 'eng' : (k.split('.')[0] as TeamRole)];
const teamIcon = (t: Pick<Team, 'role' | 'specialty'>) => (t.role === 'sci' && t.specialty ? COL_ICON[t.specialty] : ROLE_ICON[t.role]);
const teamTitle = (t: Pick<Team, 'role' | 'dept' | 'specialty'>) => (t.role === 'sci' ? `${t.dept === 'saf' ? 'Safety scientists' : 'Scientists'}${t.specialty ? ` · ${COLUMN_LABEL[t.specialty]}` : ''}` : t.role === 'eng' ? 'Engineers' : t.dept === 'saf' ? 'Safety research engineers' : 'Research engineers');

/** Quality as 1–3 filled dots (Solid / Strong / Elite). */
function QDots({ q }: { q: TeamQuality }) {
  return (
    <Tip content={() => <TipCard title={<Term id="teamQuality">{QUALITY[q].label}</Term>}>Output ×{QUALITY[q].out} · cost ×{QUALITY[q].cost}</TipCard>}>
      <span className={`qdots q-${q}`} data-q={q}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[q] ? 'on' : ''} />)}</span>
    </Tip>
  );
}

/** What a team adds once full, as one short chip in its department's currency (RD-B18: today's mechanisms run for one
 *  day on a copy with the team): build capacity, the capability project it speeds most, safety results per year. */
function GainChip({ s, t }: { s: GameStateV2; t: Pick<Team, 'role' | 'dept' | 'quality' | 'specialty'> }) {
  const g = teamGain(s, t);
  const text = g.currency === 'staffTime' ? `+${F.num(g.amount, 1)} build capacity`
    : g.currency === 'alignment' ? `${F.num(g.amount, 2, true)} results/yr`
    : g.unit === 'days' ? (g.amount === 0 ? 'no project faster today' : `${F.num(g.amount, 0, true)} d`)
    : `${F.num(g.amount, 2, true)} tuning`;
  const body = g.currency === 'staffTime' ? 'Build capacity in team-weeks per week, with your AI staff\'s help: what one day of engineering gives with the team.'
    : g.currency === 'alignment' ? 'Safety research results per year across your programmes, after one research day with the team (safety research engineers run experiments; a science team joins the safety work on the priority list, or waits idle if there is none).'
    : t.role === 'sci' ? 'Days sooner for the capability project this team speeds most, after one research day with it: the priority assignment places it (×1.5 on a project in its field; its quality sets its taste).'
    : 'Days sooner for the capability project these research engineers speed most, after one research day with them; when no project needs more, they go to tuning.';
  return <Tip content={() => <TipCard title="If hired, once full" value={g.target}>{body}</TipCard>}><span className={`pill2 ${g.amount < 0 ? 'cost' : 'gain'}`} data-test="team-gain">{text}</span></Tip>;
}

function Teams({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const people = p.teams.reduce((a, t) => a + t.heads, 0);
  const pay = payrollOf(p);
  const byKey = (k: TeamKey) => teamsOfKey(p, k);
  const role = (r: TeamRole) => p.teams.filter((t) => t.role === r);
  const heads = (ts: Team[]) => ts.reduce((a, t) => a + t.heads, 0);
  const vacant = (ts: Team[]) => ts.reduce((a, t) => a + t.size - t.heads, 0);
  const RoleHead = ({ r, right }: { r: TeamRole; right?: ReactNode }) => {
    const Ic = ROLE_ICON[r];
    return (
      <div className="role-hd" data-role={r}>
        <Ic size={15} /><Term id={ROLE_TERM[r]}>{r === 'eng' ? 'Engineers' : r === 're' ? 'Research engineers' : 'Scientists'}</Term>
        <Tip content={() => <TipCard title={<Term id={ROLE_TERM[r]}>{r === 'eng' ? 'Engineers' : r === 're' ? 'Research engineers' : 'Scientists'}</Term>} rows={[{ label: 'Teams', value: String(role(r).length) }, { label: 'People', value: F.count(heads(role(r))) }, { label: 'Open positions', value: F.count(vacant(role(r))) }, { label: <Term id="payroll">Payroll</Term>, value: F.money(role(r).reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) }]} />}>
          <span className="row-i"><b className="num">{role(r).length}</b><span className="dim num">· {F.count(heads(role(r)))}</span></span>
        </Tip>
        <span className="sp" />{right}
      </div>
    );
  };
  const Pile = ({ k, label, sub, actions }: { k: TeamKey; label: ReactNode; sub?: ReactNode; actions?: ReactNode }) => {
    const ts = byKey(k);
    const v = vacant(ts);
    return (
      <div className={`team-pile ${ts.length > 1 ? 'stacked' : ''}`} data-pile={k}>
        <div className="pile-top"><Tip content={() => <TipCard title={label} rows={[{ label: 'Teams', value: String(ts.length) }, { label: 'People', value: F.count(heads(ts)) }, { label: 'Open positions', value: F.count(v) }]} />}><b className="num">×{ts.length}</b></Tip><span>{label}</span><span className="sp" />{ts.map((t) => <QDots key={t.id} q={t.quality} />).slice(0, 6)}</div>
        <div className="pile-sub small">{sub}{v >= 1 && <Tip content={() => <TipCard title="Open positions" value={F.count(v)}>People still to hire into these teams; keep-hiring fills them at the weekly cap.</TipCard>}><span className="tone-warn"> · {F.count(v)} open positions</span></Tip>}<span className="sp" />{actions}</div>
      </div>
    );
  };
  const newest = (k: TeamKey) => byKey(k)[byKey(k).length - 1];
  const releaseBtn = (t: Team | undefined, label = 'Let go') => t && <ActBtn id="teams.release" params={{ team: t.id }} icon={ICON.release} label={label} />;
  const moveBtn = (t: Team | undefined) => t && <ActBtn id="teams.move" params={{ team: t.id }} icon={ICON.move} label="Move" />;
  const sci = (dept: TeamDept) => p.teams.filter((t) => t.role === 'sci' && t.dept === dept);
  const payTip = () => (
    <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(pay, { perYear: true })} rows={(['eng', 're', 'sci'] as const).map((r) => ({ label: r === 'eng' ? 'Engineers' : r === 're' ? 'Research engineers' : 'Scientists', value: F.money(p.teams.filter((t) => t.role === r).reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) })).concat([{ label: 'Queued teams', value: F.money(p.hiring.filling.reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) }])}>Paid monthly from cash.</TipCard>
  );
  return (
    <Card title={<span className="row-i"><ICON.staff size={15} /><Term id="team">Teams</Term></span>} sub={<Tip content={payTip}><span>{p.teams.length} teams · {F.count(people)} people</span></Tip>} home="teams" className="teams-card"
      right={(
        <span className="row-i chips">
          <Tip content={payTip}><span className="chip2" data-home="payroll"><Term id="payroll">Payroll</Term> <b className="num">{F.money(pay, { perYear: true })}</b></span></Tip>
          <span className="chip2" data-home="morale"><Why k="morale" title="Morale" body="See [[morale]]."><ICON.morale size={13} /> Morale <b className="num">{F.idx(p.morale.overall)}</b></Why></span>
          <span className="chip2" data-home="moraleSafety"><Why k="morale.safety" title="Safety staff morale"><ICON.safety size={13} /> Safety morale <b className="num">{F.idx(p.morale.safety)}</b></Why></span>
        </span>
      )}>
      <div className="teams-body">
        <div className="teams-col">
          <RoleHead r="eng" />
          <Pile k="eng" label="All engineers"
            sub={<Ref id="buildCapacity" to={{ panel: 'lab', tab: 'work' }}><ICON.build size={11} /> build capacity · Work</Ref>}
            actions={releaseBtn(newest('eng'))} />
          <RoleHead r="re" />
          <Pile k="re.cap" label="Capabilities"
            sub={<Ref id="reNeeds" to={{ panel: 'lab', tab: 'work' }}>experiments · tuning · run operations · Work</Ref>}
            actions={<>{moveBtn(newest('re.cap'))}{releaseBtn(newest('re.cap'))}</>} />
          <Pile k="re.saf" label="Safety" sub={<span>validations · cases</span>} actions={<>{moveBtn(newest('re.saf'))}{releaseBtn(newest('re.saf'))}</>} />
        </div>
        <div className="teams-col wide">
          <RoleHead r="sci" right={(
            <span className="row-i small">
              <Tip content={() => <TipCard title={<Term id="researchTaste">Research taste</Term>} value={`×${p.tasteHire.toFixed(2)}`} rows={[{ label: 'Stars', value: String(p.stars) }, { label: 'Per star', value: `+${F.num(STAR_HIRE.dTaste, 2)} each, up to ×${F.num(STAR_HIRE.maxTaste, 1)}` }]}>Star hires multiply the human taste of every capabilities science team. Each team's taste (its quality, the stars and AI): Research › Portfolio; AI staff's taste: Lab › AI staff & needs.</TipCard>}>
                <span><ICON.taste size={12} /> Star hire taste <b className="num">×{p.tasteHire.toFixed(2)}</b></span>
              </Tip>
              <ActBtn id="starHire" icon={ICON.hiring} label="Star hire" />
            </span>
          )} />
          {(['cap', 'saf'] as const).map((d) => (
            <div key={d}>
              <Tip as="div" content={() => <TipCard title={`${d === 'cap' ? 'Capabilities' : 'Safety'} scientists`} rows={[{ label: 'Teams', value: String(sci(d).length) }, { label: 'On a project', value: String(sci(d).filter((t) => t.projectId).length) }, { label: 'Idle', value: String(sci(d).filter((t) => !t.projectId).length) }]} />}><div className="sec-cap" style={{ color: d === 'cap' ? SPHERE.cap : SPHERE.saf }}>{d === 'cap' ? 'Capabilities' : 'Safety'} · {sci(d).length}</div></Tip>
              <div className="sci-grid">
                {sci(d).map((t) => {
                  const Ic = teamIcon(t);
                  return (
                    <div key={t.id} className={`sci-card ${d}`} data-team={t.id}>
                      <div className="row-i"><Ic size={13} /><b>{t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'}</b><span className="sp" /><QDots q={t.quality} /></div>
                      <div className="row-i small dim"><Tip content={() => <TipCard title={teamTitle(t)} rows={[{ label: 'People', value: `${F.count(t.heads)} of ${t.size}` }, { label: 'Project', value: t.projectId ? (PROJECT_BY_ID[t.projectId]?.name ?? t.projectId) : 'none (idle)' }]}>Click Research to change its project.</TipCard>}><span>{t.heads < t.size - 0.5 ? `${F.count(t.heads)}/${t.size} people` : `${t.size} people`}</span></Tip><span className="sp" />{releaseBtn(t, '')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="teams-foot small dim"><ICON.move size={12} /> <Term id="moveTeam">Safety → capabilities move</Term>: safety morale {MOVE_SAFETY_MORALE}</div>
    </Card>
  );
}

function Hiring({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const h = p.hiring;
  const nextOffer = 7 - (s.time.day % 7);
  return (
    <Card title={<span className="row-i"><ICON.hiring size={15} />Hiring</span>} home="hiring" className="hiring-card"
      right={<span className="small" data-home="talentPull"><Why k="relations.talentPull" title="Talent pull"><Term id="talentPull">Talent pull</Term> <b className="num">{F.num(s.relations.talentPull, 0, true)}</b></Why></span>}>
      <div className="sec-cap"><Term id="keepHiring">Keep hiring to</Term></div>
      {TEAM_KEYS.map((k) => {
        const Ic = keyIcon(k);
        const n = h.targets[k] ?? 0;
        const have = teamsOfKey(p, k).length;
        const q = queuedOfKey(p, k).length;
        return (
          <div key={k} className="hire-row" data-key={k}>
            <Ic size={13} /><span>{KEY_SHORT[k]}{k !== 'eng' && <span className={`dept-tag ${k.endsWith('saf') ? 'saf' : 'cap'}`}>{k.endsWith('saf') ? 'SAF' : 'CAP'}</span>}</span>
            <span className="sp" />
            {(have + q !== n || q > 0) && <Tip content={() => <TipCard title={KEY_SHORT[k]} rows={[{ label: 'Teams now', value: String(have) }, { label: 'Filling', value: String(q) }, { label: 'Target', value: String(n) }]}>Keep-hiring opens a team whenever you have fewer than the target.</TipCard>}><span className="small dim num">{have} now{q ? ` · ${q} filling` : ''}</span></Tip>}
            <span className="stepper">
              <ActBtn id="teams.target" testId={`teams.target.down.${k}`} params={{ key: k, n: Math.max(0, n - 1) }} icon={ICON.minus} label="" block={n <= 0 ? 'Already 0' : undefined} />
              <Tip content={() => <TipCard title={<Term id="keepHiring">Target</Term>} value={`${n} teams`}>Teams of this kind keep-hiring keeps you at.</TipCard>}><b className="num" data-test={`target-${k}`}>{n}</b></Tip>
              <ActBtn id="teams.target" testId={`teams.target.up.${k}`} params={{ key: k, n: n + 1 }} icon={ICON.plus} label="" />
            </span>
          </div>
        );
      })}
      {h.filling.length > 0 && (
        <>
          <div className="sec-cap"><Term id="hiringQueue">Filling</Term> <Tip content={() => <TipCard title={<Term id="weeklyHireCap">Hiring per week</Term>} rows={[{ label: 'Capabilities', value: `${F.count(weeklyHireCap(s, 'cap'))} a week` }, { label: 'Safety', value: `${F.count(weeklyHireCap(s, 'saf'))} a week` }]} />}><span className="dim">· {F.count(weeklyHireCap(s, 'cap'))}/wk cap · {F.count(weeklyHireCap(s, 'saf'))}/wk safety</span></Tip></div>
          {h.filling.map((t) => {
            const Ic = teamIcon(t);
            const wk = fillWeeks(s, t);
            return (
              <div key={t.id} className="fill-row" data-filling={t.id}>
                <Ic size={13} /><span className="ellip">{teamTitle(t)}</span><QDots q={t.quality} />
                <HBar v={t.heads} max={t.size} color={t.dept === 'saf' ? SPHERE.saf : SPHERE.cap} w={70} />
                <Tip content={() => <TipCard title="Filling" rows={[{ label: 'People', value: `${F.count(t.heads)} of ${t.size}` }, { label: 'Full in', value: Number.isFinite(wk) ? `${wk} weeks` : 'stalled' }]}>At today's hiring pace.</TipCard>}><span className="small dim num">{Number.isFinite(wk) ? `${wk} wk` : 'stalled'}</span></Tip>
                <ActBtn id="teams.release" testId="teams.cancel" params={{ team: t.id }} icon={ICON.release} label="" />
              </div>
            );
          })}
        </>
      )}
      <div className="sec-cap row-i"><Term id="teamOffer">Offers</Term><span className="sp" /><Tip content={() => <TipCard title="Next offers" value={`in ${nextOffer} d`}>New candidate teams arrive every week.</TipCard>}><span className="dim">next in {nextOffer} d</span></Tip></div>
      {h.candidates.length === 0 && <div className="small dim">No offers this week.</div>}
      {h.candidates.map((c) => {
        const Ic = teamIcon(c);
        const wk = fillWeeks(s, { ...c, size: TEAM_SIZE[c.role], heads: 0 });
        return (
          <div key={c.id} className="offer" data-offer={c.id}>
            <span className={`offer-ic ${c.dept}`}><Ic size={16} /></span>
            <div className="offer-main">
              <div className="row-i"><b>{teamTitle(c)}</b><QDots q={c.quality} /></div>
              <div className="row-i small">
                <Tip content={() => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(fullTeamPayroll(c.role, c.dept, c.quality), { perYear: true })}>The team's yearly cost once it is full.</TipCard>}><span className="num">{F.money(fullTeamPayroll(c.role, c.dept, c.quality), { perYear: true })}</span></Tip>
                <Tip content={() => <TipCard title="Ramp-up" value={Number.isFinite(wk) ? `${wk} weeks` : 'stalled'}>Weeks until the team is full, at today's hiring pace (talent pull and the hiring lane).</TipCard>}><span className="dim">· fills in {Number.isFinite(wk) ? `${wk} wk` : '— (stalled)'}</span></Tip>
                <Tip content={() => <TipCard title="Offer expires" value={`in ${c.until - s.time.day} d`}>Hire before then or the candidate team takes another offer.</TipCard>}><span className="dim">· offer ends in {c.until - s.time.day} d</span></Tip>
                <GainChip s={s} t={c} />
              </div>
            </div>
            <ActBtn id="teams.hire" params={{ candidate: c.id }} icon={ICON.hiring} label="Hire" primary />
          </div>
        );
      })}
    </Card>
  );
}

// ───────── Security ─────────
function Security({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const [wslLo, wslHi] = WSL_TARGET_RANGE;
  const [wsl, setWsl] = useState(Math.max(wslLo, Math.min(wslHi, Math.round((p.security.target + 0.5) * 2) / 2)));
  return (
    <div className="g2">
      <Card title={<Term id="wsl">Weight security</Term>} home="wsl" right={<Tip content={() => <TipCard title={<Term id="wsl">Weight security level</Term>} value={p.security.wsl.toFixed(1)} rows={[{ label: 'Target', value: p.security.target.toFixed(1) }, { label: 'Spend', value: F.money(p.security.spendRate, { perYear: true }) }]}>RAND security levels 1–5: how hard your weights are to steal.</TipCard>}><span className="num big">{p.security.wsl.toFixed(1)}</span></Tip>}>
        <KV k="Level now → target" term="wslTarget"><HBar v={p.security.wsl} max={5} color={SPHERE.sec} w={140} mark={p.security.target} /> {p.security.wsl.toFixed(1)} → {p.security.target.toFixed(1)}</KV>
        {(() => { const fl = securityFloorView(s); return <KV k="Floor" term="wsl"><Limit id="security.floor" tone={fl.binding ? 'warn' : 'quiet'}>WSL {fl.now.toFixed(1)} now · {fl.max.toFixed(1)} from 2027</Limit></KV>; })()}
        <div className="kv"><Tip content={() => <TipCard title="New target" value={wsl.toFixed(1)} rows={[{ label: 'Range', value: `${wslLo}–${wslHi}` }]}>Drag, then Set: spend rises with the level.</TipCard>}><span className="kv-k">New target {wsl.toFixed(1)}</span></Tip><span className="row-i"><Slider value={wsl} min={wslLo} max={wslHi} step={0.5} onChange={setWsl} /><ActBtn id="SEC_TARGET" params={{ level: wsl }} label="Set" reason /></span></div>
        <KV k="Security spend" term="opex">{F.money(p.security.spendRate, { perYear: true })}</KV>
        <KV k="Privileged staff" term="privileged">{F.count(p.security.privileged)}</KV>
        <div className="small dim" style={{ marginTop: 6 }}>Theft risk: <Ref id="risk.theft" to={{ panel: 'risk' }}>Risk › theft</Ref></div>
      </Card>
      <Card title="Controls">
        <KV k={`Siloing ${p.security.siloing}`} term="siloing"><span className="row-i"><ActBtn id="SEC_SILO" params={{ level: Math.min(2, p.security.siloing + 1) }} label="Silo +1" /><ActBtn id="SEC_SILO" testId="SEC_SILO.down" params={{ level: Math.max(0, p.security.siloing - 1) }} label="Silo −1" /></span></KV>
        <KV k={`Counter-intel ${F.pct(p.security.counterIntel)}`} term="counterIntel"><ActBtn id="SEC_CI" /></KV>
        {/* Jank PR6: KYC has one home, the product card; Security links there. */}
        <KV k="KYC" term="kyc"><Ref id="kyc" to={{ panel: 'products' }}>set per product on Products</Ref></KV>
      </Card>
    </div>
  );
}

/** LAB › Hiring & teams (L2: the hiring drawer of UI-IA §1). */
export function LabPeople({ s }: { s: GameStateV2 }) {
  return (
    <div className="people-grid">
      <Teams s={s} />
      <div className="col2">
        <Hiring s={s} />
      </div>
    </div>
  );
}

/** LAB › AI staff & needs (L2: AI staff detail and the needs order editor). */
export function LabWork({ s }: { s: GameStateV2 }) {
  return (
    <>
      <AgentsAtWork s={s} />
      <Work s={s} />
    </>
  );
}

/** LAB › Security (weight security, siloing, counter-intel). */
export const LabSecurity = Security;
