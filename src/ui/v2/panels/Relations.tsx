// Relations (§6.3): the public meters, government and China ladders, obligations, and the action catalogue. The
// counterparty stocks, blocs, research bodies and Safety Index went with W1c; W8 builds the one "Powers" home.
// The action catalogue sits behind a group picker; security actions live on Lab › Security (RL2, one home); Retire
// (ends the game) stands apart behind a confirm.
import { useState } from 'react';
import { RELATION_ACTION_META } from '../../../data/v2/actions';
import { activeRivals, dateOf, fmtDate, keptShare } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { ActBtn, Bipolar, Gate, Meter, pct, Row, Section, Seg, Term, Tip, TipCard, Why } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
const GROUPS: Record<string, string> = { A: 'Testing & transparency', B: 'Government', C: 'Rivals', F: 'Public' };
const ACT_GROUPS = ['A', 'B', 'C', 'F'] as const;
const CN_RUNG = ['Coexist', 'Retaliate', 'Acquire', 'Centralize', 'Cyber op', 'Taiwan pressure', 'War footing'];
const SEC_RUNG = ['None', 'Briefings', 'Priority', 'Clearances', 'Oversight', 'Consolidation'];
const CHN_RUNG = ['None', 'Controls', 'Tightened', 'Embargo', 'Containment'];
const STATUTE_NAME: Record<string, string> = { sb53: 'California SB 53', raise: 'New York RAISE Act', euCode: 'EU code of practice', federalLicensing: 'Federal licensing', preemption: 'Federal preemption' };
const TREATY_WORD: Record<string, string> = { none: 'no treaty', talks: 'treaty talks', restraint: 'restraint treaty', verified: 'verified treaty' };
export function Relations({ s }: { s: GameStateV2 }) {
  const g = s.gov;
  const [grp, setGrp] = useState<string>('A');
  const [retire, setRetire] = useState(false);
  const statutes = Object.entries(g.statutes).filter(([, x]) => x).map(([k]) => STATUTE_NAME[k] ?? k);
  return (
    <div className="panel-v2 grid2" data-panel="relations">
      <div className="span2"><PanelHead icon={ICON.relations} title="Relations" sub="government, public and China" right={
        <span className="rel-stats">
          <Why k="pub.approval" title="Net approval" body="See [[approval]]."><span className="rel-stat" data-home="approval"><ICON.approval size={14} /><Term id="approval">Approval</Term> <b className="num">{s.pub.approval > 0 ? '+' : ''}{s.pub.approval.toFixed(0)}</b></span></Why>
          <Why k="pub.concern" title="Concern" body="See [[concern]]." invert><span className="rel-stat" data-home="concern"><Term id="concern">Concern</Term> <b className="num">{s.pub.concern.toFixed(0)}</b></span></Why>
        </span>} /></div>

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
            <Tip as="div" key={c.id} content={() => <TipCard title={c.title} value={c.status} rows={[{ label: 'Condition', value: F.words(c.condition.predicate) }, { label: 'Signed', value: fmtDate(dateOf(s, c.signedDay)) }]} />}>
              <div className={`obl-row ${c.status === 'broken' ? 'tone-neg' : ''}`}><span className="ellip">{c.title}</span><span className="small">{c.status}</span></div>
            </Tip>
          ))}
          {!s.commitments.length && <div className="dim small">No commitments yet</div>}
        </Gate>
      </Section>

      <div className="span2"><Section title="Actions" right={<span className="row-i small"><span className="dim">security:</span><Ref id="wsl" to={{ panel: 'lab', tab: 'security' }}>Lab › Security</Ref><span className="dim">data deals:</span><Ref id="dataPortfolio" to={{ panel: 'blueprint', tab: 'data' }}>Training › Data</Ref></span>}>
        <div className="rel-groups" data-test="rel-groups"><Seg value={grp} options={ACT_GROUPS.map((x) => ({ v: x, label: GROUPS[x] }))} onChange={setGrp} /></div>
        <div className="catalog">
          <div className="cat-group">
            {RELATION_ACTION_META.filter((a) => a.group === grp).map((a) => (
              <div className="cat-card" key={a.id}>
                <ActBtn id={a.id} testId={a.id} params={a.id === 'C4' ? { lab: activeRivals(s)[0]?.core.id ?? '' } : {}} label={a.title} />
              </div>
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
