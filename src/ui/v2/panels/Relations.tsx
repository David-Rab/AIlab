// Relations (§6.3): obligations and the action catalogue. The counterparty stocks, blocs, research bodies and Safety
// Index went with W1c; the public meters and the government and China ladders with W1d; W8 builds the one "Powers" home.
// The action catalogue sits behind a group picker; security actions live on Lab › Security (RL2, one home); Retire
// (ends the game) stands apart behind a confirm.
import { useState } from 'react';
import { RELATION_ACTION_META } from '../../../data/v2/actions';
import { activeRivals, dateOf, fmtDate, keptShare } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { ActBtn, Gate, pct, Section, Seg, Term, Tip, TipCard } from '../ui';
import { PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
const GROUPS: Record<string, string> = { A: 'Testing & transparency', B: 'Government', C: 'Rivals', F: 'Public' };
const ACT_GROUPS = ['A', 'B', 'C', 'F'] as const;
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

