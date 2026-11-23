// Relations (§6.3, §3.9): counterparty web (trust, access rung, favors, dependence), blocs, obligations, research
// bodies, Index grades, China ladder and de-escalation, government ladders; the action catalog with previews.
// Jank RL1 (hierarchy cleanup, not a redesign): L1 = the four meters in the header and who matters now (lowest trust
// first); government and China rows in plain words; tables trimmed to their top rows with "show all"; columns that are
// zero for everyone are hidden; the action catalogue sits behind a group picker; security actions live on
// Lab › Security (RL2, one home); Retire (ends the game) stands apart behind a confirm.
import { useState } from 'react';
import { BLOC_BY_ID } from '../../../data/v2/blocs';
import { RELATION_ACTION_META } from '../../../data/v2/actions';
import { actionView, activeRivals, dateOf, fmtDate, keptShare } from '../../../engine/v2';
import type { CounterpartyId, GameStateV2 } from '../../../engine/v2';
import { ActBtn, Bipolar, Gate, Meter, pct, Row, Section, Seg, Term, Tip, TipCard, Why, type Params } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
export function trustColor(t: number) {
  return t >= 65 ? 'var(--good)' : t >= 45 ? 'var(--accent)' : t >= 25 ? 'var(--watch)' : 'var(--bad)';
}

const CP_LABEL: Record<string, string> = { exec: 'Executive', congress: 'Congress', states: 'States', evalGov: 'Gov evaluators', evalIndep: 'Indep. evaluators', academia: 'Academia', china: 'China' };
const GROUPS: Record<string, string> = { A: 'Testing & transparency', B: 'Government', C: 'Rivals', D: 'Research', E: 'China & allies', F: 'Public' };
const ACT_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const CN_RUNG = ['Coexist', 'Retaliate', 'Acquire', 'Centralize', 'Cyber op', 'Taiwan pressure', 'War footing'];
const SEC_RUNG = ['None', 'Briefings', 'Priority', 'Clearances', 'Oversight', 'Consolidation'];
const CHN_RUNG = ['None', 'Controls', 'Tightened', 'Embargo', 'Containment'];
const STATUTE_NAME: Record<string, string> = { sb53: 'California SB 53', raise: 'New York RAISE Act', euCode: 'EU code of practice', federalLicensing: 'Federal licensing', preemption: 'Federal preemption' };
const TREATY_WORD: Record<string, string> = { none: 'no treaty', talks: 'treaty talks', restraint: 'restraint treaty', verified: 'verified treaty' };
/** Variants for actions with parameters. */
const VARIANTS: Record<string, { label: string; p: Params }[]> = {
  B2: [{ label: 'with limits', p: { terms: 'limits' } }, { label: 'unrestricted', p: { terms: 'unrestricted' } }],
  B4: [{ label: 'deregulate', p: { direction: 'deregulate' } }, { label: 'regulate', p: { direction: 'regulate' } }],
  B6: [{ label: 'gov', p: { target: 'gov' } }, { label: 'critics', p: { target: 'critics' } }],
  E3: [{ label: 'tighten', p: { direction: 'tighten' } }, { label: 'loosen', p: { direction: 'loosen' } }],
};

function Arrows({ id, p, s }: { id: string; p: Params; s: GameStateV2 }) {
  const v = actionView(s, id, p);
  const sum = (c: string) => [...v.gains.filter((x) => x.currency === c), ...v.costs.filter((x) => x.currency === c).map((x) => ({ ...x, amount: -Math.abs(x.amount) }))].reduce((a, x) => a + x.amount, 0);
  const t = sum('trust');
  const c = sum('credibility');
  if (!t && !c) return null;
  const arrow = (x: number) => (x > 0 ? <span className="tone-pos">▲</span> : <span className="tone-neg">▼</span>);
  return (
    <Tip content={() => <TipCard title="Effect on trust and credibility">Trust of the counterparty it targets, and your credibility. Hover the button for the amounts.</TipCard>}>
      <span className="arrows small dim">{t ? <>trust {arrow(t)}</> : null}{t && c ? ' · ' : ''}{c ? <>credibility {arrow(c)}</> : null}</span>
    </Tip>
  );
}

export function Relations({ s }: { s: GameStateV2 }) {
  const stocks = s.relations.stocks;
  const cps = (Object.keys(stocks) as CounterpartyId[]).filter((k) => !k.startsWith('bloc:') && unlocked2(s, k));
  const rb = s.researchBodies;
  const g = s.gov;
  const [allCp, setAllCp] = useState(false);
  const [allBloc, setAllBloc] = useState(false);
  const [grp, setGrp] = useState<string>('A');
  const [retire, setRetire] = useState(false);
  const cpName = (k: string) => CP_LABEL[k] ?? s.rivals.find((r) => `rival:${r.core.id}` === k)?.core.name ?? k.replace('rival:', '');
  // Who matters now: the relationships most at risk (lowest trust) first.
  const ranked = [...cps].sort((a, b) => stocks[a].trust - stocks[b].trust);
  const shownCp = allCp ? ranked : ranked.slice(0, 4);
  const favorsOn = cps.some((k) => stocks[k].favors.some((d) => d > s.time.day));
  const depOn = cps.some((k) => stocks[k].depOnYou >= 0.5 || stocks[k].yourDep >= 0.5);
  const blocs = Object.entries(s.pub.blocs).sort((a, b) => b[1].clout - a[1].clout);
  const statutes = Object.entries(g.statutes).filter(([, x]) => x).map(([k]) => STATUTE_NAME[k] ?? k);
  const blocName = (id: string) => BLOC_BY_ID[id as keyof typeof BLOC_BY_ID]?.name ?? id;
  return (
    <div className="panel-v2 grid2" data-panel="relations">
      <div className="span2"><PanelHead icon={ICON.relations} title="Relations" sub="government, public, rivals, China and evaluators" right={
        <span className="rel-stats">
          <Why k="relations.credibility" title="Credibility" body="See [[credibility]]."><span className="rel-stat" data-home="credibility"><ICON.credibility size={14} /><Term id="credibility">Credibility</Term> <b className="num">{s.relations.credibility.toFixed(0)}</b></span></Why>
          <Why k="relations.scrutiny" title="Scrutiny" body="See [[scrutiny]]." invert><span className="rel-stat" data-home="scrutiny"><ICON.scrutiny size={14} /><Term id="scrutiny">Scrutiny</Term> <b className="num">{s.relations.scrutiny.toFixed(0)}</b></span></Why>
          <Why k="pub.approval" title="Net approval" body="See [[approval]]."><span className="rel-stat" data-home="approval"><ICON.approval size={14} /><Term id="approval">Approval</Term> <b className="num">{s.pub.approval > 0 ? '+' : ''}{s.pub.approval.toFixed(0)}</b></span></Why>
          <Why k="pub.concern" title="Concern" body="See [[concern]]." invert><span className="rel-stat" data-home="concern"><Term id="concern">Concern</Term> <b className="num">{s.pub.concern.toFixed(0)}</b></span></Why>
        </span>} /></div>

      <Section title={<span><Term id="counterparty">Who matters now</Term> <span className="dim small">lowest trust first</span></span>}
        right={cps.length > 4 ? <button className="btn btn-sm btn-ghost" data-test="rel-all-cp" onClick={() => setAllCp(!allCp)}>{allCp ? 'Top 4' : `Show all ${cps.length}`}</button> : undefined}>
        <table className="tbl">
          <thead><tr><th>Who</th><th><Term id="trust">Trust</Term></th><th><Term id="access">Access</Term></th>{favorsOn && <th><Term id="favors">Favors</Term></th>}{depOn && <th><Term id="dependence">Dependence</Term> on you / yours</th>}</tr></thead>
          <tbody>
            {shownCp.map((k) => {
              const st = stocks[k];
              return (
                <tr key={k} data-cp={k}>
                  <td>{cpName(k)}</td>
                  <td><Why k={`trust:${k}`} title={`Trust · ${cpName(k)}`} value={st.trust.toFixed(0)}><Meter value={st.trust} width={70} color={trustColor(st.trust)} /> <span className="num">{st.trust.toFixed(0)}</span></Why></td>
                  <td><Tip content={() => <TipCard title={<Term id="access">Access</Term>} value={`rung ${st.access} of 4`}>How far in you are with {cpName(k)}: each rung opens deals and briefings.</TipCard>}><span className="rungs">{[1, 2, 3, 4].map((r) => <i key={r} className={st.access >= r ? 'on' : ''} />)}</span></Tip></td>
                  {favorsOn && <td><Tip content={() => <TipCard title={<Term id="favors">Favors</Term>}>Favors you can call in with {cpName(k)}.</TipCard>}><span className="num">{st.favors.filter((d) => d > s.time.day).length}</span></Tip></td>}
                  {depOn && <td><Tip content={() => <TipCard title={<Term id="dependence">Dependence</Term>} rows={[{ label: `${cpName(k)} on you`, value: st.depOnYou.toFixed(0) }, { label: `You on ${cpName(k)}`, value: st.yourDep.toFixed(0) }]} />}><span className="num">{st.depOnYou.toFixed(0)} / {st.yourDep.toFixed(0)}</span></Tip></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Government · China">
        <Row label="Administration"><span className="small">{F.words(g.preset).replace(/^./, (c) => c.toUpperCase())}</span></Row>
        <Row label="AI priority"><Tip content={() => <TipCard title="AI priority" value={`${g.aiPriority.toFixed(0)} of 100`}>How much the administration puts AI first: funding, speed, procurement.</TipCard>}><span className="row-i"><Meter value={g.aiPriority} width={90} color="var(--gov)" /><span className="num">{g.aiPriority.toFixed(0)}</span></span></Tip></Row>
        <Row label="Regulation"><Tip content={() => <TipCard title="Regulation stance" value={g.regStance.toFixed(0)}>From −100 (deregulate) to +100 (regulate hard).</TipCard>}><span className="row-i"><Bipolar value={g.regStance} /><span className="small dim">{g.regStance <= -20 ? 'deregulating' : g.regStance >= 20 ? 'regulating' : 'neutral'}</span></span></Tip></Row>
        <Row label={<Term id="securityDemand">Security demand</Term>}><Why k="gov.securityDemand" title="Security demand"><Meter value={g.securityDemand} width={90} color="var(--gov)" /><span className="num">{g.securityDemand.toFixed(0)}</span></Why></Row>
        <Row label={<Term id="nationalization">Nationalization</Term>}><Why k="gov.nationalization" title="Nationalization pressure"><Meter value={g.nationalization} width={90} color="var(--neg)" /><span className="num">{g.nationalization.toFixed(0)}</span></Why></Row>
        <Gate s={s} k="govLadder">
          <Row label={<Term id="ladderSec">Security ladder</Term>}><Ladder n={5} at={g.rungSec} /><span className="small">{SEC_RUNG[g.rungSec]}</span></Row>
          <Row label="China controls"><Ladder n={4} at={g.rungChn} /><span className="small">{CHN_RUNG[g.rungChn]}</span></Row>
        </Gate>
        <Gate s={s} k="statutes">
          <Row label={<Term id="statute">Laws in force</Term>}><span className="small">{statutes.join(' · ') || 'none'}</span></Row>
        </Gate>
        <Gate s={s} k="oversight">
          <Row label={<span><Term id="oversight">Oversight</Term> · <Term id="treaty">treaty</Term></span>}><span className="small">{g.oversight ? 'committee formed' : 'no committee'} · {TREATY_WORD[g.treaty] ?? g.treaty}</span></Row>
        </Gate>
        <Gate s={s} k="chinaLadder">
          <Row label={<Term id="ladderChn">China's escalation</Term>}><Ladder n={6} at={s.china.rung} danger /><span className="small">{CN_RUNG[s.china.rung]}</span></Row>
          <Row label={<Term id="deesc">De-escalation</Term>}><Ladder n={5} at={s.china.deesc} /><span className="small">{s.china.deesc} of 5 steps</span></Row>
          <Row label={<Term id="theftIntent">Theft intent</Term>}><Why k="china.theftIntent" title="China theft intent"><Meter value={s.china.meters.theftIntent} width={90} color="var(--neg)" /><span className="num">{s.china.meters.theftIntent.toFixed(0)}</span></Why></Row>
          <Row label={<Term id="taiwanTension">Taiwan tension</Term>}><Tip content={() => <TipCard title={<Term id="taiwanTension">Taiwan tension</Term>} value={`${s.china.meters.taiwanTension.toFixed(0)} of 100`}>Raises the odds of a quarantine that cuts chip supply.</TipCard>}><span className="row-i"><Meter value={s.china.meters.taiwanTension} width={90} color="var(--warn)" /><span className="num">{s.china.meters.taiwanTension.toFixed(0)}</span></span></Tip></Row>
          <Row label={<Term id="hawkDove">Hawk–dove</Term>}><Bipolar value={s.china.meters.hawkDove} /></Row>
        </Gate>
      </Section>

      <Section title={<Term id="commitment">Obligations</Term>} right={<Tip content={() => <TipCard title="Kept" value={pct(keptShare(s))}>Share of your public commitments kept so far.</TipCard>}><span className="small dim">kept {pct(keptShare(s))}</span></Tip>}>
        <Gate s={s} k="commitments">
          {s.commitments.map((c) => (
            <Tip as="div" key={c.id} content={() => <TipCard title={c.title} value={c.status} rows={[{ label: 'Condition', value: F.words(c.condition.predicate) }, { label: 'Audience', value: c.audience.join(', ') }, { label: 'Signed', value: fmtDate(dateOf(s, c.signedDay)) }, { label: 'Breaking it costs', value: `trust −${c.breakCost.trust} · credibility −${c.breakCost.credibility}` }]} />}>
              <div className={`obl-row ${c.status === 'broken' ? 'tone-neg' : ''}`}><span className="ellip">{c.title}</span><span className="small">{c.status}</span><span className="num small dim">trust −{c.breakCost.trust} · cred −{c.breakCost.credibility}</span></div>
            </Tip>
          ))}
          {!s.commitments.length && <div className="dim small">No commitments yet</div>}
        </Gate>
      </Section>

      <Section title={<Term id="researchBodies">Evaluators and research</Term>}>
        <Gate s={s} k="researchBodies">
          {([['evalGov', 'Gov evaluators', rb.evalGov], ['evalIndep', 'Indep. evaluators', rb.evalIndep]] as const).map(([id, label, b]) => (
            <Row key={id} label={<Term id={id}>{label}</Term>}>
              <Tip content={() => <TipCard title={<Term id={id}>{label}</Term>} rows={[{ label: 'Tests per quarter', value: String(b.capacityPerQ) }, { label: 'Waiting', value: String(b.queue.length) }, { label: 'Pressure to publish', value: `${b.publishPressure.toFixed(0)} of 100` }]}>Outside testers of frontier models; a long queue delays your external evals.</TipCard>}>
                <span className="small">{b.capacityPerQ} tests a quarter · {b.queue.length} waiting</span>
              </Tip>
            </Row>
          ))}
          <Row label={<Term id="academia">Academia</Term>}>
            <Tip content={() => <TipCard title={<Term id="academia">Academia</Term>} rows={[{ label: 'Papers in the pipeline', value: rb.academia.pipeline.toFixed(0) }, { label: 'Publication lag', value: `${rb.academia.publishLagDays} d` }]}>Outside research that reaches every lab's recipe (as public ideas) after a lag.</TipCard>}>
              <span className="small">{rb.academia.pipeline.toFixed(0)} papers in the pipeline · {rb.academia.publishLagDays} d to publish</span>
            </Tip>
          </Row>
        </Gate>
        <Gate s={s} k="index">
          <Row label={<Term id="index">Index</Term>}><span className="small">{rb.index.lastEdition !== undefined ? `edition of ${fmtDate(dateOf(s, rb.index.lastEdition))}` : 'no edition yet'}</span></Row>
          <div className="grades">
            {Object.entries(rb.index.grades).map(([lab, gr]) => (
              <Tip key={lab} content={() => <TipCard title={lab} value={gr.letter} rows={Object.entries(gr.domains).map(([k, v]) => ({ label: F.words(k), value: v.toFixed(1) }))} />}>
                <span className="grade"><b>{gr.letter}</b> {lab === 'player' ? s.player.name : lab === 'china' ? s.china.lab.core.name : s.rivals.find((r) => r.core.id === lab)?.core.name ?? lab}</span>
              </Tip>
            ))}
          </div>
        </Gate>
      </Section>

      <Section title={<Term id="bloc">Blocs</Term>} right={blocs.length > 5 ? <button className="btn btn-sm btn-ghost" data-test="rel-all-bloc" onClick={() => setAllBloc(!allBloc)}>{allBloc ? 'Top 5' : `Show all ${blocs.length}`}</button> : undefined}>
        <table className="tbl">
          <thead><tr><th>Bloc <span className="dim small">by clout</span></th><th><Term id="clout">Clout</Term></th><th><Term id="mobilization">Mobilized</Term></th><th>Approval of you</th></tr></thead>
          <tbody>
            {(allBloc ? blocs : blocs.slice(0, 5)).map(([id, b]) => (
              <tr key={id}>
                <td><Tip content={() => <TipCard title={blocName(id)} rows={[{ label: <Term id="clout">Clout</Term>, value: b.clout.toFixed(0) }, { label: <Term id="mobilization">Mobilized</Term>, value: b.mobilization.toFixed(0) }, { label: 'Approval of you', value: b.approval.toFixed(0) }]} />}><span>{blocName(id)}</span></Tip></td>
                <td><Meter value={b.clout} width={50} /></td><td><Meter value={b.mobilization} width={50} color="var(--warn)" /></td><td><Bipolar value={b.approval} width={60} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="span2"><Section title="Actions" right={<span className="row-i small"><span className="dim">security:</span><Ref id="wsl" to={{ panel: 'lab', tab: 'security' }}>Lab › Security</Ref><span className="dim">data deals:</span><Ref id="dataPortfolio" to={{ panel: 'models', tab: 'data' }}>Models › Data</Ref></span>}>
        <div className="rel-groups" data-test="rel-groups"><Seg value={grp} options={ACT_GROUPS.map((x) => ({ v: x, label: GROUPS[x] }))} onChange={setGrp} /></div>
        <div className="catalog">
          <div className="cat-group">
            {RELATION_ACTION_META.filter((a) => a.group === grp).map((a) => (
              (VARIANTS[a.id] ?? [{ label: '', p: {} }]).map((vv, i) => (
                <div className="cat-card" key={`${a.id}-${i}`}>
                  <ActBtn id={a.id} testId={i ? `${a.id}.${i}` : a.id} params={a.id === 'C4' ? { lab: activeRivals(s)[0]?.core.id ?? '' } : vv.p} label={`${a.title}${vv.label ? ` · ${vv.label}` : ''}`} />
                  <Arrows id={a.id} p={vv.p} s={s} />
                </div>
              ))
            ))}
          </div>
        </div>
        <div className="rel-exit" data-test="rel-exit">
          <span className="dim small">Leave the race</span>
          {!retire
            ? <button className="btn btn-sm btn-ghost" data-test="retire-open" onClick={() => setRetire(true)}>Retire…</button>
            : <span className="row-i"><span className="small tone-warn">Retiring ends the game.</span><ActBtn id="RETIRE" label="Retire now" /><button className="btn btn-sm" data-test="retire-cancel" onClick={() => setRetire(false)}>Cancel</button></span>}
        </div>
      </Section></div>
    </div>
  );
}

function Ladder({ n, at, danger }: { n: number; at: number; danger?: boolean }) {
  return <span className="ladder">{Array.from({ length: n }, (_, i) => <span key={i} className={`rung ${at > i ? 'on' : ''} ${danger && at > i ? 'danger' : ''}`}><span /></span>)}</span>;
}
/** Act 1 shows only government and public counterparties (§1.5). */
function unlocked2(s: GameStateV2, k: string) {
  if (k === 'exec' || k === 'congress' || k === 'states') return true;
  if (k === 'china') return s.tutorial.act >= 3 || !s.setup.tutorial;
  return s.tutorial.act >= 2 || !s.setup.tutorial;
}
