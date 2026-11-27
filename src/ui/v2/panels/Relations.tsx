// Relations (§6.3): obligations and the action catalogue. The counterparty stocks, blocs, research bodies and Safety
// Index went with W1c; the public meters and the government and China ladders with W1d; W8 builds the one "Powers" home.
// The action catalogue sits behind a group picker; security actions live on Lab › Security (RL2, one home); Retire
// (ends the game) stands apart behind a confirm.
import { useState } from 'react';
import { RELATION_ACTION_META } from '../../../data/v2/actions';
import { activeRivals, blockingCommitments, chinagovView, dateOf, fmtDate, keptShare, usgovView } from '../../../engine/v2';
import { lawName } from '../../../data/v2/laws';
import type { GameStateV2 } from '../../../engine/v2';
import { ActBtn, Gate, pct, Section, Seg, Term, Tip, TipCard } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
const GROUPS: Record<string, string> = { A: 'Testing & transparency', C: 'Rivals', F: 'Public' };
const ACT_GROUPS = ['A', 'C', 'F'] as const;
/** Glossary term of each law id. */
const LAW_TERM: Record<string, string> = { licensing: 'lawLicensing', relief: 'lawRelief', ubi: 'lawUbi', hitl: 'lawHitl', sez: 'lawSez', fdaFastTrack: 'lawFda', sb243: 'lawSb243' };
const CONSOLIDATED: Record<string, string> = { none: 'none', dpa: 'the frontier labs are pooled under the DPA', nationalized: 'your lab was taken over' };

/** The China government: its tension, the talks and the treaty (with your AI R&D compute cap under a verified one). */
function China({ s }: { s: GameStateV2 }) {
  const g = chinagovView(s);
  return (
    <Section title="China">
      <div className="obl-row"><span><Term id="chinaTension">Tension</Term></span><span className="small">{g.tensionName}{g.centralised && g.tension !== 2 ? <> · <Term id="nationalCollective">national collective</Term></> : null}</span></div>
      <div className="obl-row"><span><Term id="chinaTalks">Talks</Term></span><span className="small">{g.rejected && g.talks === 0 ? 'the treaty was rejected' : g.talksName}</span></div>
      {g.cap !== undefined && <div className="obl-row"><span><Term id="treaty">AI R&amp;D compute cap</Term></span><span className="small num">{F.h100e(g.cap)}</span></div>}
    </Section>
  );
}

/** The US government: its security stage, trust in you, the laws it passed, oversight and consolidation, and briefing. */
function UsGov({ s }: { s: GameStateV2 }) {
  const g = usgovView(s);
  return (
    <Section title="US government" right={<Tip content={() => <TipCard title={<Term id="govTrust">Government trust</Term>} value={F.idx(g.trust)}>How much Washington trusts your lab, 0–100.</TipCard>}><span className="small"><Term id="govTrust">Trust</Term> <b className="num">{F.idx(g.trust)}</b></span></Tip>}>
      <div className="obl-row"><span><Term id="securityStage">Security stage</Term></span><span className="small">{g.stage} · {g.stageName}</span></div>
      {g.stage > 0 && !g.applies && <div className="dim small">Its requirements do not apply to you: your lab is not prominent enough.</div>}
      <div className="obl-row"><span><Term id="oversight">Oversight committee</Term></span><span className="small">{g.oversight ? 'accepted' : 'none'}</span></div>
      <div className="obl-row"><span><Term id="consolidation">Consolidation</Term></span><span className="small">{g.dpaAccepted ? 'the American labs pool their compute into yours' : CONSOLIDATED[g.consolidated]}</span></div>
      <div className="obl-row"><span className="dim">Laws in force</span><span className="small">{g.laws.length ? g.laws.map((id, i) => <span key={id}>{i ? ', ' : ''}{LAW_TERM[id] ? <Term id={LAW_TERM[id]}>{lawName(id)}</Term> : lawName(id)}</span>) : 'none'}</span></div>
      <div className="cat-card"><ActBtn id="B7" testId="B7" label="Brief officials" /></div>
    </Section>
  );
}
export function Relations({ s }: { s: GameStateV2 }) {
  const [grp, setGrp] = useState<string>('A');
  const [retire, setRetire] = useState(false);
  return (
    <div className="panel-v2 grid2" data-panel="relations">
      <div className="span2"><PanelHead icon={ICON.relations} title="Relations" sub="obligations and actions" right={<span className="row-i small">
        <Tip content={() => <TipCard title={<Term id="concern">Concern</Term>} value={F.idx(s.public.concern)}>Share of the public more concerned than excited about AI, 0–100 (Pew’s question).</TipCard>}><span><Term id="concern">Concern</Term> <b className="num">{F.idx(s.public.concern)}</b></span></Tip>
        <Tip content={() => <TipCard title={<Term id="approval">Approval</Term>} value={F.idx(s.public.approval)}>What the public thinks of your lab, −100 to 100. Moves with your incidents, disclosures and pledges, more when you are prominent.</TipCard>}><span><Term id="approval">Approval</Term> <b className="num">{F.idx(s.public.approval)}</b></span></Tip>
      </span>} /></div>

      <Section title={<Term id="commitment">Obligations</Term>} right={<Tip content={() => <TipCard title="Kept" value={pct(keptShare(s))}>Share of your public commitments kept so far.</TipCard>}><span className="small dim">kept {pct(keptShare(s))}</span></Tip>}>
        <Gate s={s} k="commitments">
          {s.commitments.map((c) => {
            const binds = blockingCommitments(s).some((b) => b.id === c.id);
            return (
              <div key={c.id}>
                <Tip as="div" content={() => <TipCard title={c.title} value={binds ? 'binding now' : c.status} rows={[{ label: 'Condition', value: F.words(c.condition.predicate) }, { label: 'Signed', value: fmtDate(dateOf(s, c.signedDay)) }]}>{binds ? 'Its condition holds now. What it forbids is refused at launch; honour, amend or break it here.' : undefined}</TipCard>}>
                  <div className={`obl-row ${c.status === 'broken' ? 'tone-neg' : ''}`}><span className="ellip">{c.title}</span><span className={`small ${binds ? 'tone-warn' : ''}`}>{binds ? 'binding now' : c.status}</span></div>
                </Tip>
                {binds && <div className="row-i small" data-test={`binds-${c.id}`}>
                  <ActBtn id="CMT_HONOUR" params={{ cid: c.id }} /><ActBtn id="CMT_AMEND" params={{ cid: c.id }} /><ActBtn id="CMT_BREAK" params={{ cid: c.id }} />
                </div>}
              </div>
            );
          })}
          {!s.commitments.length && <div className="dim small">No commitments yet</div>}
        </Gate>
      </Section>

      <UsGov s={s} />
      <China s={s} />

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

