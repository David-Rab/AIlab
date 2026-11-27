// LAB's L2 tabs (UB-B; approved mockups design/ux/mockups/rd/lab-hiring.png, lab-aistaff.png, lab-security.png; sources
// DATA-b.md). Hiring & teams: teams by role (tiles), hiring targets, payroll, what the next team buys, offers, payroll
// split, hiring speed, morale, star hire. AI staff & needs: the AI staff per job and the needs lists (their one home;
// the LAB board's rows link here). Security: weight security against the industry baseline, theft odds, access, what a
// higher level costs, the budget and the security log. Reads facts, beliefs and measurements only.
import type { ReactNode } from 'react';
import {
  believedTheftChance, dateOf, engAllocView, fillWeeks, fmtDate, fullTeamPayroll, payrollOf, queuedOfKey, reAllocView, safReAllocView,
  securityLevelsView, securityLogView, teamGain, teamPayroll, teamsOfKey, weeklyHireCap,
} from '../../../engine/v2';
import { privilegedOf } from '../../../engine/v2/security/security';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { COLUMN_LABEL, STAR_HIRE, TEAM_SIZE } from '../../../data/v2/teams';
import type { Column, GameStateV2, Team, TeamDept, TeamKey, TeamRole } from '../../../engine/v2';
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

/** One tile per team; a filling team is hatched up to its share hired. */
function TeamTile({ s, t, filling }: { s: GameStateV2; t: Team; filling?: boolean }) {
  const wk = filling ? fillWeeks(s, t) : 0;
  const Ic = t.role === 'sci' && t.specialty ? COL_ICON[t.specialty] : ROLE_ICON[t.role];
  return (
    <Tip content={() => <TipCard title={<span className="row-i"><Ic size={13} />{teamTitle(t)}{t.specialty ? ` · ${COLUMN_LABEL[t.specialty]}` : ''}</span>} rows={[
      { label: 'People', value: `${F.count(t.heads)} of ${t.size}` },
      { label: <Term id="payroll">Payroll</Term>, value: F.money(teamPayroll(t), { perYear: true }) },
      ...(t.role === 'sci' ? [{ label: 'Programme', value: t.projectId ? (PROJECT_BY_ID[t.projectId]?.name ?? t.projectId) : 'none (idle)' }] : []),
      ...(filling ? [{ label: 'Full in', value: Number.isFinite(wk) ? `${wk} weeks` : 'stalled' }] : []),
    ]}>{filling ? 'Being hired at the weekly hiring speed.' : 'A team on staff.'}</TipCard>}>
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
  const dept = deptOf(k);
  const Ic = ROLE_ICON[role];
  const ts = teamsOfKey(p, k);
  const fills = queuedOfKey(p, k);
  const people = ts.reduce((a, t) => a + t.heads, 0);
  const target = p.hiring.targets[k] ?? 0;
  const perTeam = fullTeamPayroll(role, dept);
  const pay = ts.reduce((a, t) => a + teamPayroll(t), 0);
  const wk = fillWeeks(s, { role, dept, size: TEAM_SIZE[role], heads: 0 });
  const f0 = fills[0];
  const f0wk = f0 ? fillWeeks(s, f0) : 0;
  const buys = nextTeamBuys(s, k);
  const newest = ts[ts.length - 1];
  return (
    <div className="lh-row" data-key={k}>
      <div className="lh-name">
        <span className="lh-ic"><Ic size={16} /></span>
        <div>
          <b><Term id={KEY_TERM[k]}>{KEY_NAME[k]}</Term></b>
          <Tip content={() => <TipCard title={KEY_FULL[k]} rows={[{ label: 'People', value: F.count(people) }, { label: 'Teams', value: String(ts.length) }, { label: 'Open positions', value: F.count(ts.reduce((a, t) => a + t.size - t.heads, 0)) }]}>People on these teams now.</TipCard>}>
            <div className="small dim"><span className="num">{F.count(people)}</span> people · {ts.length} team{ts.length === 1 ? '' : 's'}</div>
          </Tip>
        </div>
      </div>
      <div className="lh-tiles-w">
        <div className="lh-tiles">
          {ts.map((t) => <TeamTile key={t.id} s={s} t={t} />)}
          {fills.map((t) => <TeamTile key={t.id} s={s} t={t} filling />)}
          {newest && <span className="lh-acts"><ActBtn id="teams.release" testId={`teams.release.${k}`} params={{ team: newest.id }} icon={ICON.release} label="" ariaLabel={`Let go the newest ${KEY_FULL[k].toLowerCase()} team`} />{role === 're' && <ActBtn id="teams.move" testId={`teams.move.${k}`} params={{ team: newest.id }} icon={ICON.move} label="" ariaLabel="Move the newest team to the other department" />}</span>}
        </div>
        {f0 && (
          <Tip content={() => <TipCard title="Filling" rows={[{ label: 'People', value: `${F.count(f0.heads)} of ${f0.size}` }, { label: 'Full in', value: Number.isFinite(f0wk) ? `${f0wk} weeks` : 'stalled' }]}>At today&apos;s hiring speed.</TipCard>}>
            <div className="small dim lh-fill" data-test={`filling.${k}`}><ICON.hiring size={11} /> <span className="num">{F.count(f0.heads)}</span> of {f0.size} · {Number.isFinite(f0wk) ? `${f0wk} wk left` : 'stalled'}{fills.length > 1 ? ` · +${fills.length - 1} more` : ''}<ActBtn id="teams.release" testId="teams.cancel" params={{ team: f0.id }} icon={ICON.release} label="" ariaLabel="Stop hiring this team" /></div>
          </Tip>
        )}
      </div>
      <div className="lh-target">
        <span className="stepper">
          <ActBtn id="teams.target" testId={`teams.target.down.${k}`} params={{ key: k, n: Math.max(0, target - 1) }} icon={ICON.minus} label="" block={target <= 0 ? 'Already 0' : undefined} ariaLabel="Lower the hiring target" />
          <Tip content={() => <TipCard title={<Term id="keepHiring">Hiring target</Term>} value={`${target} teams`} rows={[{ label: 'Teams now', value: String(ts.length) }, { label: 'Filling', value: String(fills.length) }]}>Keep-hiring opens a team whenever you have fewer than the target.</TipCard>}><b className="num" data-test={`target-${k}`}>{target}</b></Tip>
          <ActBtn id="teams.target" testId={`teams.target.up.${k}`} params={{ key: k, n: target + 1 }} icon={ICON.plus} label="" ariaLabel="Raise the hiring target" />
        </span>
        <Tip content={() => <TipCard title="Cost of a team" value={F.money(perTeam, { perYear: true })}>A full Strong team&apos;s yearly pay.</TipCard>}><div className="small dim"><span className="num">{F.money(perTeam)}</span>/yr a team</div></Tip>
      </div>
      <div className="lh-pay">
        <Tip content={() => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(pay, { perYear: true })} rows={ts.map((t, i) => ({ label: `Team ${i + 1}`, value: F.money(teamPayroll(t), { perYear: true }) }))}>Paid monthly from cash.</TipCard>}><span><b className="num">{F.money(pay)}</b> <span className="dim small">/yr</span></span></Tip>
        <Tip content={() => <TipCard title="Time to hire a team" value={Number.isFinite(wk) ? `~${wk} weeks` : 'stalled'}>Weeks to fill one new team at today&apos;s hiring speed (talent pull and morale set it; teams already filling go first).</TipCard>}><div className="small dim">{Number.isFinite(wk) ? `~${wk} wk a team` : 'hiring stalled'}</div></Tip>
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


const PAY_KEYS: TeamKey[] = ['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'];
function PayrollCard({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const total = payrollOf(p);
  const byKey = PAY_KEYS.map((k) => ({ k, v: teamsOfKey(p, k).reduce((a, t) => a + teamPayroll(t), 0) }));
  const capW = weeklyHireCap(s, 'cap');
  const safW = weeklyHireCap(s, 'saf');
  const payTip = () => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(total, { perYear: true })} rows={[...byKey.map((x) => ({ label: KEY_FULL[x.k], value: F.money(x.v, { perYear: true }) })), { label: 'Teams filling', value: F.money(p.hiring.filling.reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) }]}>Paid monthly from cash.</TipCard>;
  return (
    <Card home="payroll" className="lh-paycard" title={<span className="row-i"><ICON.cash size={15} /><Term id="payroll">Payroll</Term></span>}
      right={<Tip content={payTip}><span><b className="num lh-big">{F.money(total)}</b> <span className="dim small">/yr</span></span></Tip>}>
      <Tip content={payTip}><div className="lh-paybar">{byKey.map((x) => x.v > 0 && <i key={x.k} style={{ flex: x.v, background: KEY_COLOR[x.k] }} />)}</div></Tip>
      <div className="lh-legend small">{byKey.map((x) => <span key={x.k}><i style={{ background: KEY_COLOR[x.k] }} />{KEY_FULL[x.k]}</span>)}</div>
      <div className="lh-kv">
        <Tip content={() => <TipCard title={<Term id="weeklyHireCap">Hiring speed</Term>} rows={[{ label: 'Capability', value: `${F.count(capW)} people a week` }, { label: 'Safety', value: `${F.count(safW)} people a week` }, { label: <Term id="talentPull">Talent pull</Term>, value: F.num(s.relations.talentPull, 0, true) }]}>People you can hire a week. Talent pull raises it; low morale slows it.</TipCard>}>
          <div className="row"><Term id="weeklyHireCap">Hiring speed</Term><span><b className="num">{F.count(capW)}</b> <span className="dim small">people a week</span> · <b className="num">{F.count(safW)}</b> <span className="dim small">safety</span></span></div>
        </Tip>
        <div className="row" data-home="morale"><Term id="morale">Morale</Term><Why k="morale" title="Morale" body="See [[morale]]."><span className="lh-meter"><i style={{ width: `${p.morale.overall}%` }} /></span><b className="num">{F.idx(p.morale.overall)}</b></Why></div>
        <div className="row sub" data-home="moraleSafety"><span>Safety staff</span><Why k="morale.safety" title="Safety staff morale"><span className="lh-meter"><i style={{ width: `${p.morale.safety}%` }} /></span><b className="num">{F.idx(p.morale.safety)}</b></Why></div>
      </div>
      <div className="lh-star">
        <div>
          <Tip content={() => <TipCard title={<Term id="starHire">Star hire</Term>} rows={[{ label: 'Stars on staff', value: String(p.stars ?? 0) }, { label: <Term id="researchTaste">Research taste</Term>, value: `×${p.tasteHire.toFixed(2)} (up to ×${F.num(STAR_HIRE.maxTaste, 1)})` }, { label: 'Each star', value: `+${F.num(STAR_HIRE.dTaste, 2)} taste · team cooperation ${STAR_HIRE.cooperation}` }, { label: 'Cost', value: F.money(STAR_HIRE.cost) }]}>A star researcher raises the idea quality of every capability science team.</TipCard>}>
            <span><Term id="starHire">Star hire</Term> <span className="dim small">· {p.stars ? `${p.stars} on staff` : 'none on staff'}</span></span>
          </Tip>
          <Tip content={() => <TipCard title={<Term id="starHire">Star hire</Term>} rows={[{ label: 'Idea quality', value: `+${F.num(STAR_HIRE.dTaste, 2)} taste` }, { label: 'Team cooperation', value: String(STAR_HIRE.cooperation) }, { label: 'Cost', value: F.money(STAR_HIRE.cost) }]}>What one star brings and costs.</TipCard>}><div className="small dim">idea quality <span className="tone-pos">▲</span> · team cooperation <span className="tone-neg">{STAR_HIRE.cooperation}</span> · {F.money(STAR_HIRE.cost)}</div></Tip>
        </div>
        <ActBtn id="starHire" icon={ICON.taste} label="Find a star" />
      </div>
    </Card>
  );
}

/** LAB › Hiring & teams. */
export function LabPeople({ s }: { s: GameStateV2 }) {
  return (
    <div className="lh-grid" data-test="lab-hiring">
      <Teams s={s} />
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
  const intent = s.china.meters.theftIntent;
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
      <Tip content={() => <TipCard title="China's intent's part" value={F.pct(partI)}>Rises with China&apos;s theft intent (Relations).</TipCard>}>
        <div className="ls-drv"><span>China&apos;s intent</span><span className="lh-meter w"><i style={{ width: `${(partI / tot) * 100}%`, background: '#d0804a' }} /></span><span className="num dim">{F.pct(partI / tot)}</span></div>
      </Tip>
      <div className="ls-kv">
        <div className="row"><span>Who wants your weights</span><span><b>{s.china.lab.core.name}</b> <span className="dim">· China</span></span></div>
        <div className="row"><Term id="theftIntent">Theft intent</Term><Ref id="theftIntent" to={{ panel: 'relations' }}>Relations</Ref></div>
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
        <Tip content={() => <TipCard title={<Term id="clearances">Security clearances</Term>} value={sec.clearances ? 'required' : 'not required'}>Government clearances for frontier work: fewer spies, but some staff are sidelined while they are vetted.</TipCard>}>
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
