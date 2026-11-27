// LAB's L2 tabs (UB-B; approved mockups design/ux/mockups/rd/lab-hiring.png, lab-aistaff.png, lab-security.png; sources
// DATA-b.md). Hiring & teams: teams by role (tiles), hiring targets, payroll, what the next team buys, offers, payroll
// split, hiring speed, morale, star hire. AI staff & needs: the AI staff per job and the needs lists (their one home;
// the LAB board's rows link here). Security: weight security against the industry baseline, theft odds, access, what a
// higher level costs, the budget and the security log. Reads facts, beliefs and measurements only.
import type { ReactNode } from 'react';
import {
  believedTheftChance, dateOf, engAllocView, fillWeeks, fmtDate, fullTeamPayroll, payrollOf, reAllocView, safReAllocView,
  securityLevelsView, securityLogView, teamGain, teamPayroll, teamsOfKey, weeklyHires,
} from '../../../engine/v2';
import { privilegedOf } from '../../../engine/v2/security/security';
import { theftIntent } from '../../../engine/v2/world/chinagov';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { COLUMN_LABEL, TEAM_SIZE } from '../../../data/v2/teams';
import { P0, PREMIUM_STEPS, W0 } from '../../../data/v2/labourMarket';
import { startOf } from '../../../data/v2/starts';
import { humanTasteMean } from '../../../engine/v2/departments/workfit';
import { nextKeyOf, offerOf, openPositions, otherLabHeads, outsideHeads, playerHeads, poachShare, premiumOf, teamGap } from '../../../engine/v2/departments/market';
import { hirableStars, humanTasteWith, playerStars, starTopShare } from '../../../engine/v2/departments/stars';
import type { Column, GameStateV2, Star, Team, TeamDept, TeamKey, TeamRole } from '../../../engine/v2';
import { AIStaffJobs } from './Agents';
import { NeedsBoard } from './Work';
import { ActBtn, Limit, Term, Tip, TipCard, Why } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { SPHERE } from '../theme';

// ───────── Hiring & teams ─────────
const ROLE_ICON: Record<TeamRole, typeof ICON.L> = { eng: ICON.roleEng, re: ICON.roleRE, sci: ICON.roleSci };
const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const KEY_NAME: Record<TeamKey, string> = { eng: 'Engineers', 're.cap': 'Research engineers', 'sci.cap': 'Scientists', 're.saf': 'Research engineers', 'sci.saf': 'Scientists' };
const KEY_FULL: Record<TeamKey, string> = { eng: 'Engineers', 're.cap': 'Capability research engineers', 'sci.cap': 'Capability scientists', 're.saf': 'Safety research engineers', 'sci.saf': 'Safety scientists' };
const KEY_TERM: Record<TeamKey, string> = { eng: 'roleEng', 're.cap': 'roleRE', 'sci.cap': 'roleSci', 're.saf': 'roleRE', 'sci.saf': 'roleSci' };
const KEY_COLOR: Record<TeamKey, string> = { eng: '#6f8fb5', 're.cap': '#9b6be0', 'sci.cap': '#7a52b8', 're.saf': '#22a394', 'sci.saf': '#1a8a7d' };
const roleOf = (k: TeamKey): TeamRole => (k === 'eng' ? 'eng' : (k.split('.')[0] as TeamRole));
const deptOf = (k: TeamKey): TeamDept => (k === 'eng' ? 'cap' : (k.split('.')[1] as TeamDept));
const teamTitle = (t: Pick<Team, 'role' | 'dept'>) => (t.role === 'eng' ? 'Engineers' : t.role === 're' ? (t.dept === 'saf' ? 'Safety research engineers' : 'Research engineers') : t.dept === 'saf' ? 'Safety scientists' : 'Scientists');
const t1 = (x: number) => (x >= 10 ? F.count(x) : x.toFixed(1).replace(/\.0$/, ''));

/** One tile per team; the next team (hires so far, not yet a team) is hatched up to its share hired. */
function TeamTile({ s, t, filling }: { s: GameStateV2; t: Team; filling?: boolean }) {
  const wk = filling ? fillWeeks(s, t.role) : 0;
  const Ic = t.role === 'sci' && t.specialty ? COL_ICON[t.specialty] : ROLE_ICON[t.role];
  return (
    <Tip content={() => <TipCard title={<span className="row-i"><Ic size={13} />{teamTitle(t)}{t.specialty ? ` · ${COLUMN_LABEL[t.specialty]}` : ''}</span>} rows={[
      { label: 'People', value: `${F.count(t.heads)} of ${t.size}` },
      { label: <Term id="payroll">Payroll</Term>, value: F.money(teamPayroll(s.player, t), { perYear: true }) },
      ...(t.role === 'sci' ? [{ label: 'Programme', value: t.projectId ? (PROJECT_BY_ID[t.projectId]?.name ?? t.projectId) : 'none (idle)' }] : []),
      ...(filling ? [{ label: 'Next team in', value: Number.isFinite(wk) ? `~${wk} wk` : 'stalled' }] : []),
    ]}>{filling ? 'People hired so far toward the next team. The team arrives whole, when it is full.' : 'A team on staff.'}</TipCard>}>
      <span className={`lh-tile ${filling ? 'filling' : ''}`} data-team={t.id}>
        {filling ? <i className="fillp" style={{ width: `${(t.heads / Math.max(1, t.size)) * 100}%` }} /> : null}
      </span>
    </Tip>
  );
}

/** What one more standard team of a kind buys today, in its department's currency (teamGain, as on the LAB board's
 *  Best moves / Won't help). */
function nextTeamBuys(s: GameStateV2, k: TeamKey): { text: ReactNode; tip: string; quiet: boolean } {
  const role = roleOf(k);
  const dept = deptOf(k);
  if (k === 'eng') {
    const e = engAllocView(s);
    const spare = e.cap > 0 ? e.idle / e.cap : 0;
    if (spare > 0.05) return { text: `nothing now · ${F.pct(spare)} spare`, tip: 'Engineering capacity no need takes: another team would sit spare.', quiet: true };
    const g = teamGain(s, { role, dept });
    return { text: <><Term id="buildCapacity">Build capacity</Term> <b className="num tone-pos">+{F.num(g.amount, 1)}</b> teams</>, tip: 'Build capacity in team-weeks per week after one day of engineering with the team.', quiet: false };
  }
  if (k === 're.cap') {
    const r = reAllocView(s);
    if (r.idle >= 0.5) return { text: `nothing now · ${t1(r.idle)} teams idle`, tip: `${r.idleWhy} Another team would sit idle.`, quiet: true };
    const g = teamGain(s, { role, dept });
    return g.amount > 0 ? { text: <>next project <b className="num tone-pos">{F.num(g.amount, 0)} d</b> sooner</>, tip: `Days sooner for the capability project these research engineers speed most, after one research day with them${g.target ? `: ${g.target}` : ''}.`, quiet: false }
      : { text: 'little · no project needs more', tip: 'No capability project moves faster with them today.', quiet: true };
  }
  if (k === 'sci.cap') {
    const g = teamGain(s, { role, dept, specialty: 'pretraining' });
    return g.amount > 0 ? { text: <>next project <b className="num tone-pos">{F.num(g.amount, 0)} d</b> sooner</>, tip: `Days sooner for the capability project a new science team speeds most, after one research day with it${g.target ? `: ${g.target}` : ''}.`, quiet: false }
      : { text: 'little · no programme waits for a team', tip: 'Every capability programme already has the science teams it takes.', quiet: true };
  }
  const g = teamGain(s, { role, dept: 'saf', ...(role === 'sci' ? { specialty: 'alignment' as const } : {}) });
  if (!(g.currency === 'alignment' && g.amount > 0.005)) return { text: role === 'sci' ? 'little · no programme waits for a team' : 'little · no need is short', tip: 'No safety programme moves faster with them today.', quiet: true };
  const saf = safReAllocView(s);
  const short = saf.needs.filter((n) => n.short > 1e-6 && Number.isFinite(n.demand)).reduce((a, n) => a + n.short, 0);
  return {
    text: <><Term id="safetyResults">Safety results</Term> <b className="num tone-pos">+{F.num(g.amount, g.amount < 0.1 ? 2 : 1)}</b> /yr{role === 're' && short >= 1 ? ` · ends the ${t1(short)}-person shortage` : ''}</>,
    tip: 'Safety research results per year across your programmes, after one research day with the team.', quiet: false,
  };
}

function TeamRow({ s, k }: { s: GameStateV2; k: TeamKey }) {
  const p = s.player;
  const role = roleOf(k);
  const Ic = ROLE_ICON[role];
  const ts = teamsOfKey(p, k);
  const prog = p.hiring.progress[role];
  const pending = teamGap(p, k) > 0 && nextKeyOf(p, role) === k; // the next team of this kind is this key's
  const next: Team = { id: 'next', role, dept: deptOf(k), size: TEAM_SIZE[role], heads: pending ? prog.heads : 0 };
  const people = ts.reduce((a, t) => a + t.heads, 0);
  const target = p.hiring.targets[k] ?? 0;
  const perTeam = fullTeamPayroll(s, role);
  const pay = ts.reduce((a, t) => a + teamPayroll(p, t), 0);
  const nextWk = pending ? fillWeeks(s, role) : Infinity;
  const buys = nextTeamBuys(s, k);
  const newest = ts[ts.length - 1];
  return (
    <div className="lh-row" data-key={k}>
      <div className="lh-name">
        <span className="lh-ic"><Ic size={16} /></span>
        <div>
          <b><Term id={KEY_TERM[k]}>{KEY_NAME[k]}</Term></b>
          <Tip content={() => <TipCard title={KEY_FULL[k]} rows={[{ label: 'People', value: F.count(people) }, { label: 'Teams', value: String(ts.length) }]}>People on these teams now.</TipCard>}>
            <div className="small dim"><span className="num">{F.count(people)}</span> people · {ts.length} team{ts.length === 1 ? '' : 's'}</div>
          </Tip>
        </div>
      </div>
      <div className="lh-tiles-w">
        <div className="lh-tiles">
          {ts.map((t) => <TeamTile key={t.id} s={s} t={t} />)}
          {pending && <TeamTile s={s} t={next} filling />}
          {newest && <span className="lh-acts"><ActBtn id="teams.release" testId={`teams.release.${k}`} params={{ team: newest.id }} icon={ICON.release} label="" ariaLabel={`Let go the newest ${KEY_FULL[k].toLowerCase()} team`} />{role === 're' && <ActBtn id="teams.move" testId={`teams.move.${k}`} params={{ team: newest.id }} icon={ICON.move} label="" ariaLabel="Move the newest team to the other department" />}</span>}
        </div>
        {pending && (
          <Tip content={() => <TipCard title={<Term id="nextTeam">Next team</Term>} rows={[{ label: 'People hired so far', value: `${F.count(next.heads)} of ${next.size}` }, { label: 'Next team in', value: Number.isFinite(nextWk) ? `~${nextWk} weeks` : 'stalled' }]}>Hires add up; the team arrives whole when it is full.</TipCard>}>
            <div className="small dim lh-fill" data-test={`next.${k}`}><ICON.hiring size={11} /> <span className="num">{F.count(next.heads)}</span> of {next.size} · next team in {Number.isFinite(nextWk) ? `~${nextWk} wk` : 'a while (stalled)'}</div>
          </Tip>
        )}
      </div>
      <div className="lh-target">
        <span className="stepper">
          <ActBtn id="teams.target" testId={`teams.target.down.${k}`} params={{ key: k, n: Math.max(0, target - 1) }} icon={ICON.minus} label="" block={target <= 0 ? 'Already 0' : undefined} ariaLabel="Lower the hiring target" />
          <Tip content={() => <TipCard title={<Term id="keepHiring">Hiring target</Term>} value={`${target} teams`} rows={[{ label: 'Teams now', value: String(ts.length) }, { label: 'Still to hire', value: String(Math.max(0, target - ts.length)) }]}>Keep-hiring hires toward a new whole team whenever you have fewer than the target.</TipCard>}><b className="num" data-test={`target-${k}`}>{target}</b></Tip>
          <ActBtn id="teams.target" testId={`teams.target.up.${k}`} params={{ key: k, n: target + 1 }} icon={ICON.plus} label="" ariaLabel="Raise the hiring target" />
        </span>
        <Tip content={() => <TipCard title="Cost of a team" value={F.money(perTeam, { perYear: true })}>A full team&apos;s yearly pay.</TipCard>}><div className="small dim"><span className="num">{F.money(perTeam)}</span>/yr a team</div></Tip>
      </div>
      <div className="lh-pay">
        <Tip content={() => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(pay, { perYear: true })} rows={ts.map((t, i) => ({ label: `Team ${i + 1}`, value: F.money(teamPayroll(p, t), { perYear: true }) }))}>Paid monthly from cash.</TipCard>}><span><b className="num">{F.money(pay)}</b> <span className="dim small">/yr</span></span></Tip>
      </div>
      <Tip content={() => <TipCard title="Next team buys">{buys.tip}</TipCard>}>
        <div className={`lh-buys ${buys.quiet ? 'dim' : ''}`} data-test={`buys.${k}`}>{buys.text}</div>
      </Tip>
    </div>
  );
}

function Teams({ s }: { s: GameStateV2 }) {
  const grp = (d: TeamDept) => (
    <div className="lh-grp" style={{ color: d === 'cap' ? SPHERE.cap : SPHERE.saf }}>{d === 'cap' ? <ICON.capabilities size={13} /> : <ICON.safety size={13} />} {d === 'cap' ? 'Capability' : 'Safety'}</div>
  );
  return (
    <Card home="teams" className="lh-teams" title={<span className="row-i"><ICON.staff size={15} /><Term id="team">Teams</Term> <span className="dim small lc">the people you employ, by role</span></span>}>
      <div className="lh-head"><span>Role</span><span>Teams</span><span><Term id="keepHiring">Hiring target</Term></span><span><Term id="payroll">Payroll</Term></span><span>Next team buys</span></div>
      <TeamRow s={s} k="eng" />
      {grp('cap')}
      <TeamRow s={s} k="re.cap" />
      <TeamRow s={s} k="sci.cap" />
      {grp('saf')}
      <TeamRow s={s} k="re.saf" />
      <TeamRow s={s} k="sci.saf" />
      <div className="lh-foot small dim"><ICON.split size={12} /> Scientists&apos; split between capability and safety is set on <Ref id="sciSplit" to={{ panel: 'lab', tab: 'board', anchor: 'sciSplit' }}>Allocation</Ref></div>
    </Card>
  );
}


// ───────── Labour market (L16; LABOUR-ROUND §4) ─────────
const KINDS: TeamRole[] = ['eng', 're', 'sci'];
const KIND_NAME_L: Record<TeamRole, string> = { eng: 'Engineers', re: 'Research engineers', sci: 'Scientists' };
const KIND_TERM_L: Record<TeamRole, string> = { eng: 'roleEng', re: 'roleRE', sci: 'roleSci' };
const wageM = (x: number) => `$${x.toFixed(2)}M`;
const premLabel = (x: number) => (x > 0 ? `+${Math.round(x * 100)}%` : 'none');

function LabourRow({ s, k }: { s: GameStateV2; k: TeamRole }) {
  const p = s.player;
  const pool = s.labour.pools[k];
  const Ic = ROLE_ICON[k];
  const pi = premiumOf(p, k);
  const w = pool.w;
  const pay = p.pay[k];
  const offer = offerOf(s, k);
  const catching = Math.abs(offer - pay) / Math.max(1e-9, offer) > 0.02;
  const up = offer > pay;
  const U = outsideHeads(s, k);
  const share = U / pool.P;
  const start = (pool.U0 ?? U) / P0[k];
  const dShare = (share - start) * 100;
  const mine = playerHeads(p, k);
  const china = otherLabHeads({ rivals: [], china: s.china }, k);
  const rivals = otherLabHeads(s, k) - china;
  const V = openPositions(p, k);
  const hires = weeklyHires(s, k);
  const wk = fillWeeks(s, k);
  const dTone = dShare < -0.005 ? 'tone-neg' : dShare > 0.005 ? 'tone-pos' : 'dim';
  const wageTip = () => (
    <TipCard title={<Term id="marketWage">Market wage</Term>} value={`${wageM(w)} a person-year`} rows={[
      { label: 'Your average pay', value: wageM(pay) },
      { label: 'Your offer now', value: `${wageM(offer)}${pi > 0 ? ` (${premLabel(pi)})` : ''}` },
      { label: 'At the start', value: wageM(W0[k]) },
      { label: 'AI labs hold', value: `${F.pct(1 - share, 1)} of the pool` },
    ]}>
      Wages rise as AI labs hire the pool down, yours and your rivals&apos;. A <Term id="premiumPay">pay premium</Term> pulls people from rivals but costs more on everyone of that kind. Your average pay catches up with your offer over about a year{catching ? `: it is moving ${up ? 'up' : 'down'} to ${wageM(offer)}` : ''}.
    </TipCard>
  );
  const talentTip = () => (
    <TipCard title={<Term id="talentOutside">Talent outside AI labs</Term>} value={F.pct(share, 1)} rows={[
      { label: 'Everyone able to do the job', value: F.count(pool.P) },
      { label: 'You employ', value: F.count(mine) },
      { label: 'Other labs employ', value: F.count(rivals) },
      { label: 'China\'s labs employ', value: F.count(china) },
      { label: 'Outside AI labs', value: F.count(U) },
      { label: 'Since the start', value: F.pp(dShare, Math.abs(dShare) < 1 ? 2 : 1) },
    ]}>
      Who you can hire. Labs hire from this pool and it thins: hiring slows and the <Term id="marketWage">market wage</Term> rises. New graduates refill it slowly.
    </TipCard>
  );
  const speedTip = () => (
    <TipCard title={<Term id="weeklyHireCap">Hiring speed</Term>} value={V > 0 ? `${t1(hires)} people a week` : 'no open positions'} rows={[
      { label: 'Open positions', value: F.count(V) },
      { label: `Next team of ${TEAM_SIZE[k]}`, value: Number.isFinite(wk) ? `about ${wk} weeks` : 'none open' },
      { label: <Term id="talentPull">Talent pull</Term>, value: F.num(startOf(s).mods.talentPull, 0, true) },
      { label: <Term id="premiumPay">Pay premium</Term>, value: premLabel(pi) },
    ]}>
      People you hire this week for your open positions. More openings, talent pull, morale and a premium raise it; a thinner pool slows it. Hires add up and a team arrives whole, when it is full.
    </TipCard>
  );
  return (
    <div className="lm-row" data-kind={k}>
      <div className="lh-name">
        <span className="lh-ic"><Ic size={16} /></span>
        <b><Term id={KIND_TERM_L[k]}>{KIND_NAME_L[k]}</Term></b>
      </div>
      <Tip content={wageTip}>
        <div className="lm-cell" data-test={`lm-wage.${k}`}>
          <span><b className="num lm-big">{wageM(w)}</b> <span className="dim small">market</span></span>
          <span className="small dim">you pay <b className="num">{wageM(pay)}</b>{catching && <span className={up ? 'tone-warn' : 'tone-pos'}> {up ? '▲' : '▼'} {wageM(offer)}</span>}</span>
        </div>
      </Tip>
      <Tip content={talentTip}>
        <div className="lm-cell" data-test={`lm-talent.${k}`}>
          <span className="row-i"><span className="lh-meter lm-meter"><i style={{ width: `${share * 100}%` }} /></span><b className="num">{F.pct(share, 1)}</b></span>
          <span className={`small ${dTone}`}>{dShare < -0.005 ? '▼' : dShare > 0.005 ? '▲' : '▬'} <span className="num">{F.pp(dShare, Math.abs(dShare) < 1 ? 2 : 1)}</span> <span className="dim">since the start</span></span>
        </div>
      </Tip>
      <Tip content={speedTip}>
        <div className="lm-cell" data-test={`lm-speed.${k}`}>
          {V > 0 ? <span><b className="num lm-big">{t1(hires)}</b> <span className="dim small">a week</span></span> : <span className="dim">no open positions</span>}
          <span className="small dim" data-test={`lm-next.${k}`}>{Number.isFinite(wk) ? `next team in ~${wk} wk` : 'no team being hired'}</span>
        </div>
      </Tip>
      <div className="lm-cell lm-prem" data-test={`lm-premium.${k}`}>
        <span className="seg-row">
          {PREMIUM_STEPS.map((x) => (Math.abs(x - pi) < 1e-9
            ? <Tip key={x} content={() => <TipCard title={<Term id="premiumPay">Pay premium</Term>} value={premLabel(x)} rows={[{ label: 'Your offer', value: `${wageM(offer)} a person-year` }, { label: <Term id="poaching">Poaching</Term>, value: x > 0 ? `${F.pct(poachShare(x))} of your hires come from rivals` : 'none' }]}>Your current premium on the market wage for {KIND_NAME_L[k].toLowerCase()}.</TipCard>}><span className="seg-on" data-test={`premium.${k}.${x}`}>{premLabel(x)}</span></Tip>
            : <ActBtn key={x} id="hiring.premium" testId={`premium.${k}.${x}`} params={{ kind: k, step: x }} label={premLabel(x)} />))}
        </span>
        <span className="small dim">{pi > 0 ? <>offering <b className="num">{wageM(offer)}</b>, poaching from rivals</> : 'pay at the market wage'}</span>
      </div>
    </div>
  );
}

function LabourMarket({ s }: { s: GameStateV2 }) {
  return (
    <Card home="labour" className="lm-card" title={<span className="row-i"><ICON.staff size={15} />Labour market <span className="dim small lc">$M per person-year</span></span>}>
      <div className="lm-head"><span>Staff</span><span><Term id="marketWage">Market wage</Term></span><span><Term id="talentOutside">Talent outside AI labs</Term></span><span><Term id="weeklyHireCap">Hiring speed</Term></span><span><Term id="premiumPay">Pay premium</Term></span></div>
      {KINDS.map((k) => <LabourRow key={k} s={s} k={k} />)}
    </Card>
  );
}


// ───────── Stars ─────────
const STAR_COLOR = '#e0b04a';
const wageY = (m: number) => `$${m >= 100 ? Math.round(m) : m.toFixed(m < 10 ? 1 : 0)}M/yr`;
const idx3 = (x: number) => `×${x.toFixed(3)}`;
const topLabel = (share: number) => `top ${(share * 100).toFixed(share < 0.0001 ? 3 : share < 0.001 ? 2 : 1)}%`;
const SHOWN_STARS = 6;

/** A star's tooltip: how its taste joins the researchers' mean. */
function StarTasteTip({ s, star, pay }: { s: GameStateV2; star: Star; pay?: number }) {
  const now = humanTasteMean(s);
  const mineAlready = star.employer === 'player';
  const after = mineAlready ? now : humanTasteWith(s, star);
  return (
    <TipCard title={<span className="row-i"><ICON.taste size={13} />{star.name}</span>} value={`taste ×${star.taste.toFixed(1)}`} rows={[
      { label: <Term id="tastePercentile">Standing</Term>, value: `${topLabel(starTopShare(s, star))} of researchers` },
      { label: <Term id="researchTaste">Your researchers' taste</Term>, value: mineAlready ? idx3(now) : `${idx3(now)} → ${idx3(after)}` },
      { label: 'Pay', value: wageY(pay ?? star.pay) },
    ]}>
      {mineAlready
        ? "Counted as one more researcher in your scientists' average taste. They add no work, only better ideas: the lift is small beside hundreds of scientists, but it lasts as long as they stay."
        : `Joins your scientists' average taste as one more researcher, worth ×${star.taste.toFixed(1)} an average one. Against hundreds of scientists the lift is small, but it lasts and is paid for every year.`}
    </TipCard>
  );
}

function StarName({ s, star, pay, tail }: { s: GameStateV2; star: Star; pay?: number; tail?: ReactNode }) {
  return (
    <span className="st-name">
      <Tip content={() => <StarTasteTip s={s} star={star} pay={pay} />}><span className="row-i"><ICON.taste size={13} style={{ color: STAR_COLOR }} /><b>{star.name}</b></span></Tip>
      {tail}
    </span>
  );
}

function StarStats({ s, star }: { s: GameStateV2; star: Star }) {
  const top = starTopShare(s, star);
  return (
    <span className="st-stats">
      <Tip content={() => <TipCard title={<Term id="tastePercentile">Standing</Term>} value={topLabel(top)}>{`${(top * 100).toFixed(top < 0.001 ? 3 : 2)}% of researchers are better than this one. Stars are the top 0.1%.`}</TipCard>}><span className="num dim">{topLabel(top)}</span></Tip>
      <Tip content={() => <TipCard title={<Term id="researchTaste">Taste</Term>} value={`×${star.taste.toFixed(1)}`}>How good this researcher's ideas are, against an average researcher at ×1.</TipCard>}><b className="num">taste ×{star.taste.toFixed(1)}</b></Tip>
    </span>
  );
}

function StarsCard({ s }: { s: GameStateV2 }) {
  const mine = [...playerStars(s)].sort((a, b) => b.taste - a.taste);
  const others = [...hirableStars(s)].sort((a, b) => b.taste - a.taste).slice(0, SHOWN_STARS);
  const best = others[0];
  const now = humanTasteMean(s);
  const after = best ? humanTasteWith(s, best) : now;
  return (
    <Card home="stars" className="st-card" title={<span className="row-i"><ICON.taste size={15} /><Term id="star">Stars</Term> <span className="dim small lc">top researchers, hired by name</span></span>}
      right={<Tip content={() => <TipCard title={<Term id="researchTaste">Your researchers' taste</Term>} value={idx3(now)} rows={[{ label: 'At the start', value: idx3(1) }, ...(best ? [{ label: `With ${best.name}`, value: idx3(after) }, { label: 'Change', value: F.pct(after / now - 1, 1, true) }] : [])]}>The average taste of your scientists, stars included, where ×1 is your lab at the start. A star counts as one more researcher in that average, so one star among hundreds moves it a little, for as long as they stay. Capability research only.</TipCard>}>
        <span className="st-taste" data-test="stars-taste"><span className="dim small">research taste</span> <b className="num lh-big">{idx3(now)}</b>{best && <span className="small dim"> · with {best.name} <b className="num tone-pos">{idx3(after)}</b></span>}</span>
      </Tip>}>
      <div className="cap2">Your stars</div>
      {mine.length === 0 && <div className="small dim st-none">None on staff. A star lifts your researchers' taste across the lab.</div>}
      {mine.map((x) => (
        <div key={x.id} className="st-row" data-star={x.id}>
          <StarName s={s} star={x} />
          <StarStats s={s} star={x} />
          <Tip content={() => <TipCard title="Pay" value={wageY(x.pay)}>Paid every year with your payroll.</TipCard>}><span className="num st-pay">{wageY(x.pay)}</span></Tip>
          <span />
        </div>
      ))}
      <div className="st-hd"><span className="cap2">Available</span></div>
      {others.map((x) => (
        <div key={x.id} className="st-row" data-star={x.id}>
          <StarName s={s} star={x} />
          <StarStats s={s} star={x} />
          <Tip content={() => <TipCard title="Pay" value={wageY(x.pay)}>Joins at the going star pay, paid every year.</TipCard>}><span className="num st-pay">{wageY(x.pay)}</span></Tip>
          <ActBtn id="starHire" testId={`starHire.${x.id}`} params={{ star: x.id }} label="Hire" />
        </div>
      ))}
      {best && <div className="small dim st-foot">Best you can hire: <b>{best.name}</b> at {wageY(best.pay)} lifts your researchers' taste {idx3(now)} → {idx3(after)}.</div>}
    </Card>
  );
}

const PAY_KEYS: TeamKey[] = ['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'];
const PAY_COLOR: Record<TeamKey | 'stars', string> = { ...KEY_COLOR, stars: '#e0b04a' };
function PayrollCard({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const total = payrollOf(s);
  const starPay = playerStars(s).reduce((a, x) => a + x.pay, 0) / 1000;
  const byKey: { k: TeamKey | 'stars'; v: number }[] = [...PAY_KEYS.map((k) => ({ k, v: teamsOfKey(p, k).reduce((a, t) => a + teamPayroll(p, t), 0) })), { k: 'stars', v: starPay }];
  const payTip = () => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(total, { perYear: true })} rows={[...byKey.map((x) => ({ label: x.k === 'stars' ? 'Stars' : KEY_FULL[x.k], value: F.money(x.v, { perYear: true }) })), { label: 'Hired toward the next teams', value: F.money(payrollOf(s) - starPay - byKey.reduce((a, x) => a + (x.k === 'stars' ? 0 : x.v), 0), { perYear: true }) }]}>Paid monthly from cash.</TipCard>;
  return (
    <Card home="payroll" className="lh-paycard" title={<span className="row-i"><ICON.cash size={15} /><Term id="payroll">Payroll</Term></span>}
      right={<Tip content={payTip}><span><b className="num lh-big">{F.money(total)}</b> <span className="dim small">/yr</span></span></Tip>}>
      <Tip content={payTip}><div className="lh-paybar">{byKey.map((x) => x.v > 0 && <i key={x.k} style={{ flex: x.v, background: PAY_COLOR[x.k] }} />)}</div></Tip>
      <div className="lh-legend small">{byKey.map((x) => <span key={x.k}><i style={{ background: PAY_COLOR[x.k] }} />{x.k === 'stars' ? 'Stars' : KEY_FULL[x.k]}</span>)}</div>
      <div className="lh-kv">
        <div className="row" data-home="morale"><Term id="morale">Morale</Term><Why k="morale" title="Morale" body="See [[morale]]."><span className="lh-meter"><i style={{ width: `${p.morale.overall}%` }} /></span><b className="num">{F.idx(p.morale.overall)}</b></Why></div>
        <div className="row sub" data-home="moraleSafety"><span>Safety staff</span><Why k="morale.safety" title="Safety staff morale"><span className="lh-meter"><i style={{ width: `${p.morale.safety}%` }} /></span><b className="num">{F.idx(p.morale.safety)}</b></Why></div>
      </div>
    </Card>
  );
}

/** LAB › Hiring & teams. */
export function LabPeople({ s }: { s: GameStateV2 }) {
  return (
    <div className="lh-grid" data-test="lab-hiring">
      <div className="lh-main">
        <LabourMarket s={s} />
        <StarsCard s={s} />
        <Teams s={s} />
      </div>
      <div className="lh-side">
        <PayrollCard s={s} />
      </div>
    </div>
  );
}

/** LAB › AI staff & needs: the AI staff per job, then the needs lists (their one home). */
export function LabWork({ s }: { s: GameStateV2 }) {
  return (
    <div className="la-wrap" data-test="lab-aistaff">
      <AIStaffJobs s={s} />
      <NeedsBoard s={s} />
    </div>
  );
}

// ───────── Security ─────────
const SCALE_LO = 2;
const SCALE_HI = 5;
const sx = (v: number) => `${((Math.max(SCALE_LO, Math.min(SCALE_HI, v)) - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100}%`;
const lvl = (x: number) => x.toFixed(1);
const theftPct = (x: number) => (x < 0.01 ? '< 1%' : F.pct(x));
const dur = (d: number) => (d <= 0 ? 'now' : d < 90 ? `${d} d` : `${Math.round(d / 30.4)} mo`);

function WeightSecurity({ s }: { s: GameStateV2 }) {
  const sec = s.player.security;
  const v = securityLevelsView(s);
  const below = sec.target < v.floorNow - 1e-6;
  const holds = v.rows.filter((r) => !r.now && r.spend <= sec.spendRate + 1e-9).length > 0;
  const atBase = Math.abs(v.floorNow - sec.wsl) < 0.05;
  return (
    <Card home="wsl" className="ls-wsl" title={<span className="row-i"><ICON.wsl size={15} /><Term id="wsl">Weight security</Term> <span className="dim small lc">how hard it is to steal your models</span></span>}
      right={<Tip content={() => <TipCard title={<Term id="wsl">Weight security</Term>} value={lvl(sec.wsl)} rows={[{ label: <Term id="wslTarget">Your target</Term>, value: lvl(sec.target) }, { label: <Term id="securityFloor">Industry baseline</Term>, value: `${lvl(v.floorNow)} now · ${lvl(v.floor2027)} from Jan 2027` }, { label: 'Rises while funded', value: `${v.rate} a day` }]}>Level n holds against an attacker of tier n trying for two months. It climbs toward your target while the budget covers it, and never falls below the industry baseline.</TipCard>}><b className="num ls-big" data-test="wsl-now">{lvl(sec.wsl)}</b></Tip>}>
      <div className="ls-scale">
        <div className="ls-track"><i className="you" style={{ width: sx(sec.wsl) }} /></div>
        <Tip content={() => <TipCard title={<Term id="wslTarget">Your target</Term>} value={lvl(sec.target)}>The level the security team builds toward. Set it in What a higher level costs.</TipCard>}>
          <span className="ls-mk tgt" style={{ left: sx(sec.target) }}><span className="lbl">your target <b className="num">{lvl(sec.target)}</b></span><i className="tri" /></span>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="securityFloor">Industry baseline</Term>} value={lvl(v.floorNow)} rows={[{ label: 'From Jan 2027', value: lvl(v.floor2027) }]}>The level frontier labs now keep. Yours never falls below it.</TipCard>}>
          <span className="ls-mk base" style={{ left: sx(v.floorNow) }}><span className="lbl up">{atBase ? 'you · industry baseline' : 'industry baseline'}</span></span>
        </Tip>
        {v.floor2027 > v.floorNow + 0.05 && <span className="ls-mk base later" style={{ left: sx(v.floor2027) }}><span className="lbl">baseline {lvl(v.floor2027)} from Jan 2027</span></span>}
        <div className="ls-ticks">{[2, 3, 4, 5].map((x) => <span key={x} style={{ left: sx(x) }} className="num">{x}</span>)}</div>
      </div>
      {below && <Tip as="div" content={() => <TipCard title="Baseline sets your level" rows={[{ label: 'Your target', value: lvl(sec.target) }, { label: 'Industry baseline', value: lvl(v.floorNow) }, { label: 'Your budget', value: F.money(sec.spendRate, { perYear: true }) }]}>To go higher, Set a level in What a higher level costs.</TipCard>}><div className="ls-note small" data-test="wsl-below"><ICON.alert size={13} /> Your target is below the baseline, so <Limit id="security.floor" tone="bind">the baseline sets your level</Limit>.{holds ? '' : ` Your ${F.money(sec.spendRate)} a year holds nothing higher.`}</div></Tip>}
    </Card>
  );
}

function TheftRisk({ s }: { s: GameStateV2 }) {
  const sec = s.player.security;
  const intent = theftIntent(s);
  const p = believedTheftChance(sec.wsl, intent);
  const partW = Math.max(0, 0.05 + (3.5 - sec.wsl) * 0.15);
  const partI = Math.max(0, Math.min(100, intent)) / 300;
  const tot = Math.max(1e-9, partW + partI);
  const detected = sec.detectedThefts.length;
  return (
    <Card home="theftOdds" className="ls-theft" title={<span className="row-i"><ICON.theft size={15} /><Term id="theftOdds">Theft risk</Term> <span className="dim small lc">your estimate</span></span>}
      right={<Tip content={() => <TipCard title={<Term id="theftOdds">Theft risk</Term>} value={theftPct(p)} rows={[{ label: 'From your weight security', value: F.pct(partW) }, { label: "From China's theft intent", value: F.pct(partI) }]}>How likely a determined attempt on your weights gets through, as your security team judges it. Odds per attempt, not per year.</TipCard>}><b className="num ls-big" data-test="theft-odds">{theftPct(p)}</b></Tip>}>
      <div className="cap2">What drives it</div>
      <Tip content={() => <TipCard title="Weight security's part" value={F.pct(partW)}>Falls as weight security rises; nothing past 3.8.</TipCard>}>
        <div className="ls-drv"><span>Weight security</span><span className="lh-meter w"><i style={{ width: `${(partW / tot) * 100}%`, background: '#6f8fb5' }} /></span><span className="num dim">{F.pct(partW / tot)}</span></div>
      </Tip>
      <Tip content={() => <TipCard title="China's intent's part" value={F.pct(partI)}>Rises with China&apos;s theft intent.</TipCard>}>
        <div className="ls-drv"><span>China&apos;s intent</span><span className="lh-meter w"><i style={{ width: `${(partI / tot) * 100}%`, background: '#d0804a' }} /></span><span className="num dim">{F.pct(partI / tot)}</span></div>
      </Tip>
      <div className="ls-kv">
        <div className="row"><span>Who wants your weights</span><span><b>{s.china.lab.core.name}</b> <span className="dim">· China</span></span></div>
        <div className="row"><Term id="theftIntent">Theft intent</Term><b className="num">{intent.toFixed(0)}</b></div>
        <Tip content={() => <TipCard title="Thefts detected" value={detected ? String(detected) : 'none'}>Thefts of your weights your security team has found.</TipCard>}>
          <div className="row"><span>Thefts detected</span><b className={detected ? 'tone-neg' : ''}>{detected ? detected : <span className="row-i"><ICON.check size={12} /> none</span>}</b></div>
        </Tip>
      </div>
    </Card>
  );
}

const SILO: { lv: 0 | 1 | 2; label: string }[] = [{ lv: 0, label: 'Open' }, { lv: 1, label: 'Partial' }, { lv: 2, label: 'Strict' }];
function Access({ s }: { s: GameStateV2 }) {
  const sec = s.player.security;
  const at = (lv: 0 | 1 | 2) => privilegedOf(s.player.staff, lv);
  return (
    <Card home="access" className="ls-access" title={<span className="row-i"><ICON.L size={15} /><Term id="privileged">Access</Term> <span className="dim small lc">who can reach the weights</span></span>}>
      <div className="ls-kv">
        <Tip content={() => <TipCard title={<Term id="privileged">People with access</Term>} value={F.count(sec.privileged)}>Staff who can reach the weights or recent secrets. Each is a door a spy could use.</TipCard>}>
          <div className="row"><span>People with access</span><b className="num ls-mid">{F.count(sec.privileged)}</b></div>
        </Tip>
        <div className="row"><Term id="siloing">Need-to-know access</Term>
          <span className="ls-seg" data-test="silo">
            {SILO.map((o) => (sec.siloing === o.lv ? <span key={o.lv} className="seg-on" data-test={`SEC_SILO.${o.lv}`}>{o.label}</span> : <ActBtn key={o.lv} id="SEC_SILO" testId={`SEC_SILO.${o.lv}`} params={{ level: o.lv }} label={o.label} />))}
          </span>
        </div>
        <Tip content={() => <TipCard title="People with access, by setting" rows={SILO.map((o) => ({ label: o.label, value: F.count(at(o.lv)) }))} footer="Each step costs 5% of every team's output and 3 morale.">Need-to-know cuts who can reach the weights by 30% a step.</TipCard>}>
          <div className="row sub"><span>people with access</span><span className="num">{SILO.map((o) => F.count(at(o.lv))).join(' · ')}</span></div>
        </Tip>
        <div className="row"><Term id="counterIntel">Counter-intelligence</Term><span className="row-i"><Tip content={() => <TipCard title={<Term id="counterIntel">Counter-intelligence</Term>} value={F.pct(sec.counterIntel)}>Finds thefts and spies. Each step +20% for $0.1B a year.</TipCard>}><b className="num">{F.pct(sec.counterIntel)}</b></Tip><ActBtn id="SEC_CI" icon={ICON.plus} label="" ariaLabel="More counter-intelligence" /></span></div>
        <Tip content={() => <TipCard title={<Term id="clearances">Security clearances</Term>} value={sec.clearances ? 'required' : 'not required'}>Government clearances for frontier work: fewer spies get in.</TipCard>}>
          <div className="row"><Term id="clearances">Security clearances</Term><b>{sec.clearances ? 'required' : 'not required'}</b></div>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="ssl">Secrets security</Term>} value={lvl(sec.ssl)}>How hard your know-how is to leak. It follows weight security, 0.6 behind.</TipCard>}>
          <div className="row"><span><Term id="ssl">Secrets security</Term> <span className="dim">· know-how</span></span><b className="num">{lvl(sec.ssl)}</b></div>
        </Tip>
      </div>
    </Card>
  );
}

function Levels({ s }: { s: GameStateV2 }) {
  const sec = s.player.security;
  const v = securityLevelsView(s);
  const maxSpend = Math.max(...v.rows.map((r) => r.spend), sec.spendRate);
  const atBase = Math.abs(v.floorNow - sec.wsl) < 0.05;
  return (
    <Card home="wslCosts" className="ls-levels" title={<span className="row-i"><ICON.lead size={15} />What a higher level costs</span>}
      right={<Tip content={() => <TipCard title={<Term id="securityBudget">Your budget</Term>} value={F.money(sec.spendRate, { perYear: true })}>The tick on each bar.</TipCard>}><span className="small dim row-i"><i className="ls-tick-sw" /> your budget <span className="num">{F.money(sec.spendRate)}</span></span></Tip>}>
      <div className="ls-lh small"><span>Level</span><span>Spend to reach and hold</span><span>A year</span><span><Term id="theftOdds">Theft risk</Term></span><span>To reach</span><span /></div>
      {v.rows.map((r) => (
        <div key={r.level} className={`ls-lr ${r.now ? 'now' : ''}`} data-level={r.level}>
          <b className="num">{lvl(r.level)}</b>
          <Tip content={() => <TipCard title={`Level ${lvl(r.level)}`} rows={[{ label: 'Spend a year', value: F.money(r.spend, { perYear: true }) }, { label: 'Your budget', value: F.money(sec.spendRate, { perYear: true }) }]}>Spend rises with the level and with your compute online.</TipCard>}>
            <span className="ls-bar"><i style={{ width: `${(r.spend / maxSpend) * 100}%` }} /><i className="tick" style={{ left: `${(sec.spendRate / maxSpend) * 100}%` }} /></span>
          </Tip>
          <span className="num">{r.now ? <span className="dim">—</span> : F.money(r.spend)}</span>
          <Tip content={() => <TipCard title={<Term id="theftOdds">Theft risk at this level</Term>} value={theftPct(r.theft)}>Your estimate per determined attempt, at today&apos;s China theft intent.</TipCard>}><span className="num">{theftPct(r.theft)}</span></Tip>
          <Tip content={() => <TipCard title="Time to reach" value={dur(r.days)}>{`Weight security climbs ${v.rate} a day while the budget covers the target.`}</TipCard>}><span className="num">{dur(r.days)}</span></Tip>
          {r.now ? <Tip content={() => <TipCard title={atBase ? <Term id="securityFloor">Industry baseline</Term> : 'You'}>{atBase ? 'You are at the industry baseline.' : 'Your level now.'}</TipCard>}><span className="ls-pill">{atBase ? 'baseline' : 'you'}</span></Tip>
            : <ActBtn id="SEC_TARGET" testId={`SEC_TARGET.${r.level}`} params={{ level: r.level }} label="Set" block={Math.abs(sec.target - r.level) < 1e-6 ? 'Already your target' : undefined} />}
        </div>
      ))}
    </Card>
  );
}

function Budget({ s }: { s: GameStateV2 }) {
  const sec = s.player.security;
  const log = securityLogView(s);
  return (
    <Card home="securityBudget" className="ls-budget" title={<span className="row-i"><ICON.cash size={15} /><Term id="securityBudget">Security budget</Term></span>}
      right={<Tip content={() => <TipCard title={<Term id="securityBudget">Security budget</Term>} value={F.money(sec.spendRate, { perYear: true })} rows={[{ label: 'Counter-intelligence', value: F.pct(sec.counterIntel) }]}>Set by your target (Set charges what the level needs) and by counter-intelligence (+$0.1B a year a step).</TipCard>}><b className="num" data-test="sec-budget">{F.money(sec.spendRate)}/yr</b></Tip>}>
      <div className="cap2">Security log</div>
      {log.map((l, i) => <div key={i} className="ls-log small"><span className="num dim">{fmtDate(dateOf(s, l.day))}</span><span>{l.text}</span></div>)}
      {sec.detectedThefts.length === 0 && <div className="small dim ls-none">No thefts detected.</div>}
    </Card>
  );
}

/** LAB › Security. */
export function LabSecurity({ s }: { s: GameStateV2 }) {
  return (
    <div className="ls-grid" data-test="lab-security">
      <div className="ls-left">
        <WeightSecurity s={s} />
        <div className="ls-pair"><TheftRisk s={s} /><Access s={s} /></div>
      </div>
      <div className="ls-right">
        <Levels s={s} />
        <Budget s={s} />
      </div>
    </div>
  );
}
