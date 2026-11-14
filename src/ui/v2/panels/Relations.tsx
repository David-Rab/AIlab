// Relations (§6.3, §3.9): counterparty web (trust, access rung, favors, dependence), blocs, obligations, research
// bodies, Index grades, China ladder and de-escalation, government ladders; the action catalog with previews.
import { BLOC_BY_ID } from '../../../data/v2/blocs';
import { RELATION_ACTION_META } from '../../../data/v2/actions';
import { actionView, activeRivals, dateOf, fmtDate, keptShare, liveCommitments } from '../../../engine/v2';
import type { CounterpartyId, GameStateV2 } from '../../../engine/v2';
import { ActBtn, Bipolar, Gate, Meter, pct, Row, Section, Term, Tip, TipCard, Why, type Params } from '../ui';
import { trustColor } from '../shell/RightRail';

const CP_LABEL: Record<string, string> = { exec: 'Executive', congress: 'Congress', states: 'States', evalGov: 'Gov evaluators', evalIndep: 'Indep. evaluators', academia: 'Academia', china: 'China' };
const GROUPS: Record<string, string> = { A: 'Testing & transparency', B: 'Government', C: 'Rivals', D: 'Research & data', E: 'China & allies', F: 'Public', S: 'Security', X: 'Exit' };
const CN_RUNG = ['Coexist', 'Retaliate', 'Acquire', 'Centralize', 'Cyber op', 'Taiwan pressure', 'War footing'];
const SEC_RUNG = ['None', 'Briefings', 'Priority', 'Clearances', 'Oversight', 'Consolidation'];
const CHN_RUNG = ['None', 'Controls', 'Tightened', 'Embargo', 'Containment'];
/** Variants for actions with parameters. */
const VARIANTS: Record<string, { label: string; p: Params }[]> = {
  A3: [{ label: 'framework', p: {} }, { label: '+ pause pledge', p: { strong: true } }],
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
  const arrow = (x: number) => (x > 0 ? <span className="tone-pos">▲</span> : x < 0 ? <span className="tone-neg">▼</span> : <span className="dim">·</span>);
  return <span className="arrows small" title="trust · credibility">{arrow(t)}T {arrow(c)}C</span>;
}

export function Relations({ s }: { s: GameStateV2 }) {
  const stocks = s.relations.stocks;
  const cps = (Object.keys(stocks) as CounterpartyId[]).filter((k) => !k.startsWith('bloc:'));
  const rb = s.researchBodies;
  return (
    <div className="panel-v2 grid2" data-panel="relations">
      <Section title="Counterparties" right={<span className="num small"><Why k="relations.credibility" title="Credibility" body="See [[credibility]]."><span>cred {s.relations.credibility.toFixed(0)}</span></Why> · <Why k="relations.scrutiny" title="Scrutiny"><span>scrutiny {s.relations.scrutiny.toFixed(0)}</span></Why></span>}>
        <table className="tbl">
          <thead><tr><th>Who</th><th><Term id="trust">Trust</Term></th><th><Term id="access">Access</Term></th><th><Term id="favors">Favors</Term></th><th>Dep on you / yours</th></tr></thead>
          <tbody>
            {cps.map((k) => {
              const st = stocks[k];
              if (!unlocked2(s, k)) return null;
              return (
                <tr key={k}>
                  <td>{CP_LABEL[k] ?? s.rivals.find((r) => `rival:${r.core.id}` === k)?.core.name ?? k.replace('rival:', '')}</td>
                  <td><Why k={`trust:${k}`} title={`Trust · ${CP_LABEL[k] ?? k}`} value={st.trust.toFixed(0)}><Meter value={st.trust} width={70} color={trustColor(st.trust)} /> <span className="num">{st.trust.toFixed(0)}</span></Why></td>
                  <td><span className="rungs">{[1, 2, 3, 4].map((r) => <i key={r} className={st.access >= r ? 'on' : ''} />)}</span></td>
                  <td className="num">{st.favors.filter((d) => d > s.time.day).length}</td>
                  <td className="num">{st.depOnYou.toFixed(0)} / {st.yourDep.toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Government · China">
        <Row label="Gov preset · priority"><span className="small">{s.gov.preset} · AI priority {s.gov.aiPriority.toFixed(0)} · reg {s.gov.regStance.toFixed(0)}</span></Row>
        <Row label="Security demand"><Why k="gov.securityDemand" title="Security demand"><Meter value={s.gov.securityDemand} width={90} color="var(--gov)" /><span className="num">{s.gov.securityDemand.toFixed(0)}</span></Why></Row>
        <Row label="Nationalization"><Why k="gov.nationalization" title="Nationalization pressure"><Meter value={s.gov.nationalization} width={90} color="var(--neg)" /><span className="num">{s.gov.nationalization.toFixed(0)}</span></Why></Row>
        <Gate s={s} k="govLadder">
          <Row label={<Term id="ladderSec">G-SEC</Term>}><Ladder n={5} at={s.gov.rungSec} /><span className="small">{SEC_RUNG[s.gov.rungSec]}</span></Row>
          <Row label="G-CHN"><Ladder n={4} at={s.gov.rungChn} /><span className="small">{CHN_RUNG[s.gov.rungChn]}</span></Row>
        </Gate>
        <Gate s={s} k="statutes">
          <Row label="Statutes"><span className="small">{Object.entries(s.gov.statutes).filter(([, x]) => x).map(([k]) => k).join(', ') || 'none'}</span></Row>
        </Gate>
        <Gate s={s} k="oversight">
          <Row label="Oversight · treaty"><span className="small">{s.gov.oversight ? 'committee formed' : 'no committee'} · {s.gov.treaty}</span></Row>
        </Gate>
        <Gate s={s} k="chinaLadder">
          <Row label={<Term id="ladderChn">China rung</Term>}><Ladder n={6} at={s.china.rung} danger /><span className="small">{CN_RUNG[s.china.rung]}</span></Row>
          <Row label="De-escalation"><Ladder n={5} at={s.china.deesc} /><span className="small">D{s.china.deesc}</span></Row>
          <Row label="Theft intent · Taiwan"><Why k="china.theftIntent" title="China theft intent"><span className="num">{s.china.meters.theftIntent.toFixed(0)}</span></Why><span className="num"> · {s.china.meters.taiwanTension.toFixed(0)}</span></Row>
          <Row label="Hawk–dove"><Bipolar value={s.china.meters.hawkDove} /></Row>
        </Gate>
      </Section>

      <Section title={<Term id="commitment">Obligations</Term>} right={<span className="small dim">kept {pct(keptShare(s))}</span>}>
        <Gate s={s} k="commitments">
          {s.commitments.map((c) => (
            <Tip as="div" key={c.id} content={() => <TipCard title={c.title} value={c.status} rows={[{ label: 'Condition', value: `${c.condition.predicate} ${JSON.stringify(c.condition.params)}` }, { label: 'Audience', value: c.audience.join(', ') }, { label: 'Signed', value: fmtDate(dateOf(s, c.signedDay)) }]} />}>
              <div className={`obl-row ${c.status === 'broken' ? 'tone-neg' : ''}`}><span className="ellip">{c.title}</span><span className="small">{c.status}</span><span className="num small dim">−{c.breakCost.trust}T −{c.breakCost.credibility}C</span></div>
            </Tip>
          ))}
          {!s.commitments.length && <div className="dim small">No commitments ({liveCommitments(s).length} live)</div>}
        </Gate>
      </Section>

      <Section title="Research bodies · Index">
        <Gate s={s} k="researchBodies">
          <Row label="Gov evaluators"><span className="small">slots {rb.evalGov.capacityPerQ}/q · queue {rb.evalGov.queue.length} · publish {rb.evalGov.publishPressure.toFixed(0)}</span></Row>
          <Row label="Indep. evaluators"><span className="small">slots {rb.evalIndep.capacityPerQ}/q · queue {rb.evalIndep.queue.length} · publish {rb.evalIndep.publishPressure.toFixed(0)}</span></Row>
          <Row label="Academia"><span className="small">pipeline {rb.academia.pipeline.toFixed(0)} · lag {rb.academia.publishLagDays} d</span></Row>
        </Gate>
        <Gate s={s} k="index">
          <Row label={<Term id="index">Index</Term>}><span className="small">{rb.index.lastEdition !== undefined ? fmtDate(dateOf(s, rb.index.lastEdition)) : 'no edition yet'}</span></Row>
          <div className="grades">
            {Object.entries(rb.index.grades).map(([lab, g]) => (
              <Tip key={lab} content={() => <TipCard title={lab} value={g.letter} rows={Object.entries(g.domains).map(([k, v]) => ({ label: k, value: v.toFixed(1) }))} />}>
                <span className="grade"><b>{g.letter}</b> {lab === 'player' ? s.player.name : lab === 'china' ? s.china.lab.core.name : s.rivals.find((r) => r.core.id === lab)?.core.name ?? lab}</span>
              </Tip>
            ))}
          </div>
        </Gate>
      </Section>

      <Section title="Blocs">
        <table className="tbl">
          <thead><tr><th>Bloc</th><th>Clout</th><th>Mobilized</th><th>Approval of you</th></tr></thead>
          <tbody>
            {Object.entries(s.pub.blocs).sort((a, b) => b[1].clout - a[1].clout).map(([id, b]) => (
              <tr key={id}><td>{BLOC_BY_ID[id as keyof typeof BLOC_BY_ID]?.name ?? id}</td><td><Meter value={b.clout} width={50} /></td><td><Meter value={b.mobilization} width={50} color="var(--warn)" /></td><td><Bipolar value={b.approval} width={60} /></td></tr>
            ))}
          </tbody>
        </table>
        <Row label="Public approval · concern"><Why k="pub.approval" title="Net approval" body="See [[approval]]."><span className="num">{s.pub.approval.toFixed(0)}</span></Why><Why k="pub.concern" title="Concern"><span className="num"> · {s.pub.concern.toFixed(0)}</span></Why></Row>
      </Section>

      <div className="span2"><Section title="Action catalog">
        <div className="catalog">
          {Object.keys(GROUPS).map((g) => (
            <div key={g} className="cat-group">
              <div className="branch-label">{GROUPS[g]}</div>
              {RELATION_ACTION_META.filter((a) => a.group === g).map((a) => (
                (VARIANTS[a.id] ?? [{ label: '', p: {} }]).map((vv, i) => (
                  <div className="cat-card" key={`${a.id}-${i}`}>
                    <ActBtn id={a.id} testId={i ? `${a.id}.${i}` : a.id} params={a.id === 'C4' ? { lab: activeRivals(s)[0]?.core.id ?? '' } : vv.p} label={`${a.title}${vv.label ? ` · ${vv.label}` : ''}`} />
                    <Arrows id={a.id} p={vv.p} s={s} />
                  </div>
                ))
              ))}
            </div>
          ))}
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
