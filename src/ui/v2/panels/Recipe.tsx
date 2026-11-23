// Research › Recipe (model v3 V2b; mockups-v3/v3-v2b-recipe; RD-B17): one card per recipe stack, each in its own unit
// (OOM of its own quantity: stacks are never summed), and a card for the domain and data effects in theirs. Home of stack
// efficiency (RF-R5: believed, the sum of the adopted results' estimates ± their band), the recipe not trained into the
// internal model, the adopted ideas (believed band, and the first evaluated model trained with each: its measured gain is
// on that model's card) and the software rate.
import { dateOf, fmtDate, otherEffectViews, softwareRate, stackViews } from '../../../engine/v2';
import type { AdoptedView, GameStateV2, OtherEffectView, StackView } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import { ICON } from '../icons';
import * as F from '../fmt';
import { effRange, fmtEff } from './ResearchProjects';

type Key = StackView['key'];
const STACK_ICON: Record<Key, (typeof ICON)['colPretraining']> = { pre: ICON.colPretraining, rlMid: ICON.colPosttraining, rlCeil: ICON.colPosttraining, train: ICON.colSystems, serve: ICON.colSystems };
const TRAINS_IN: Partial<Record<Key, string>> = { pre: 'a new base run', rlMid: 'a post-training run', rlCeil: 'a post-training run' };
const ADD_KIND: Record<Key, string> = { pre: 'pretraining', rlMid: 'post-training', rlCeil: 'post-training', train: 'systems', serve: 'systems' };
/** DQ-1 area names and their own quantity (VOCAB: know-how shown as ×, never OOM). */
const AREA_NAME: Record<Key, string> = { pre: 'Pretraining recipe', rlMid: 'Post-training method', rlCeil: 'Post-training ceiling', train: 'Training efficiency', serve: 'Serving efficiency' };
const AREA_UNIT: Record<Key, string> = { pre: 'effective compute', rlMid: 'post-training compute', rlCeil: 'of the ceiling', train: 'useful training per chip-day', serve: 'work served per chip' };
/** An engine OOM total as a player multiple: ×2.2. */
const mult = (x: number) => `×${F.short(Math.pow(10, x))}`;
/** Two significant figures (domain-effect rows in their own unit). */
const sig = (x: number, signed = true) => `${signed && x > 0 ? '+' : x < 0 ? '−' : ''}${Number(Math.abs(x).toPrecision(2))}`;
const batch = (a: AdoptedView) => (a.b && a.b > 1 ? ` (${a.b} ideas)` : '');
const short = (s: GameStateV2, day: number) => fmtDate(dateOf(s, day)).replace(/,? \d{4}$/, '');

/** RF-R5: where an adopted idea has been measured: the first evaluated model trained with it (its measured gain is on
 *  that model's card, Models), or not yet. An idea has no measured number of its own. */
function SeenIn({ a }: { a: AdoptedView }) {
  return (
    <Tip content={() => <TipCard title={<Term id="realisedEffect">Measured effect</Term>} value={a.seenIn ?? 'not yet'}>
      {a.seenIn ? `${a.seenIn} is the first evaluated model built with it. Its measured gain over the model before it is on its card under Models; that gain includes everything else that differs between the two models.` : `Measured once ${a.embodiedBy} after it was built in has been evaluated. Until then you have only the believed range.`}
    </TipCard>}>
      <span className={`num small ${a.seenIn ? '' : 'dim'}`}>{a.seenIn ? `in ${a.seenIn}` : 'not in a model yet'}</span>
    </Tip>
  );
}

function StackCard({ s, g }: { s: GameStateV2; g: StackView }) {
  const Ic = STACK_ICON[g.key];
  const span = Math.max(1e-9, Math.abs(g.base) + g.adopted);
  const w = (x: number) => `${Math.max(0, (x / span) * 100)}%`;
  return (
    <Card className="rc-card" home={`stack.${g.key}`} title={<span className="row-i"><Ic size={15} /><Term id="recipeStack">{AREA_NAME[g.key] ?? g.name}</Term></span>}
      sub={<Tip content={() => <TipCard title="Ideas built in" value={String(g.n)}>Every idea counts once: a programme's batch counts each idea in it; an idea that also moves another area counts in its main area only.</TipCard>}><span>{g.n} ideas built in</span></Tip>}>
      <div className="rc-hero">
        <Tip content={() => <TipCard title={<Term id="stackEfficiency">Yours</Term>} value={`${mult(g.now)} (${mult(g.now - g.adoptedSd)} to ${mult(g.now + g.adoptedSd)})`}>{`Believed, against July 2025: public know-how and your built-in results together, with their likely range. In ${AREA_UNIT[g.key]}: not comparable with the other areas.`}</TipCard>}>
          <b className="num" data-test={`stack-now.${g.key}`}>{mult(g.now)}</b>
        </Tip>
        <span className="dim">{AREA_UNIT[g.key]} vs Jul 2025</span>
      </div>
      <Tip content={() => <TipCard title="Make-up" rows={[{ label: <Term id="publicKnowledge">Public know-how</Term>, value: mult(g.base) }, { label: 'Yours (believed)', value: `${mult(g.adopted)} (${mult(g.adopted - g.adoptedSd)} to ${mult(g.adopted + g.adoptedSd)})` }]} />}>
        <span className="rc-bar">{g.base > 0 && <i className="base" style={{ width: w(g.base) }} />}<i className="ad" style={{ width: w(g.adopted) }} /></span>
      </Tip>
      {g.gap !== undefined && (
        <div className="rp-kv"><span><Term id="trainedIn">Waiting</Term></span>
          <Tip content={() => <TipCard title={<Term id="trainedIn">Waiting</Term>} value={mult(g.gap ?? 0)} rows={[{ label: 'In your newest model', value: mult(g.inModel ?? 0) }]}>{`Know-how your newest model doesn't have yet: ${TRAINS_IN[g.key] ?? 'a new run'} builds it in.`}</TipCard>}>
            <span className={`num ${(g.gap ?? 0) > 0.1 ? 'tone-warn' : ''}`} data-test={`stack-gap.${g.key}`}>{mult(g.gap ?? 0)} waiting</span>
          </Tip>
          <Ref id="blueprint" to={{ panel: 'blueprint' }}>Next run</Ref>
        </div>
      )}
      <div className="rp-k" style={{ marginTop: 8 }}><Term id="beliefBand">Yours · believed</Term> <span className="dim">({AREA_UNIT[g.key]})</span></div>
      {g.ideas.length === 0 && <div className="small dim">Nothing built in yet. Add a {ADD_KIND[g.key]} project on Portfolio.</div>}
      <div className="rc-ideas">
        {g.ideas.slice(0, 8).map((a, i) => (
          <div key={`${a.id}-${a.day}-${i}`} className="rc-idea" data-idea={a.id}>
            <span className="ellip">{a.name}{batch(a)}</span>
            <span className="dim small">{short(s, a.day)}</span>
            <Tip content={() => <TipCard title={<Term id="beliefBand">Believed</Term>} value={effRange(a.est, a.estSd)}>The result's expected effect and likely range when it came in.</TipCard>}><span className="num small">{fmtEff(a.est)}</span></Tip>
            <SeenIn a={a} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Domain and data effects (RD-B17): not stacks, so each row in its own unit. */
function OtherCard({ s, xs }: { s: GameStateV2; xs: OtherEffectView[] }) {
  return (
    <Card className="rc-card" home="stack.other" title={<span className="row-i"><ICON.data size={15} /><Term id="otherEffects">Domain effects</Term></span>}
      sub={<span>{xs.length} built in</span>}>
      {xs.length === 0 && <div className="small dim">Nothing built in yet.</div>}
      <div className="rc-ideas">
        {xs.slice(0, 8).map((a, i) => (
          <div key={`${a.id}-${a.day}-${i}`} data-idea={a.id}>
            <div className="rc-idea"><span className="ellip">{a.name}</span><span className="dim small">{short(s, a.day)}</span><span /><span /></div>
            {a.rows.map((r) => (
              <div key={r.label} className="rc-idea small" data-effect={r.label}>
                <span className="ellip dim">{r.label}{r.unit.startsWith('OOM') ? '' : ` (${r.unit})`}</span>
                <span />
                <Tip content={() => <TipCard title={<Term id="beliefBand">Believed</Term>} value={r.unit.startsWith('OOM') ? `${effRange(r.est, r.estSd)}${r.unit.slice(3)}` : `${sig(r.est)} (${sig(r.est - r.estSd)} to ${sig(r.est + r.estSd)}) ${r.unit}`}>The result's expected effect and likely range when it came in.</TipCard>}><span className="num small">{r.unit.startsWith('OOM') ? fmtEff(r.est) : sig(r.est)}</span></Tip>
                <SeenIn a={a} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Recipe({ s }: { s: GameStateV2 }) {
  const gs = stackViews(s);
  const other = otherEffectViews(s);
  const r = softwareRate(s);
  return (
    <div className="rc-wrap">
      <div className="rc-head" data-home="softwareRate">
        <Tip content={() => <TipCard title={<Term id="softwareRate">Know-how growth</Term>} rows={[{ label: <Term id="effCompute">Effective compute</Term>, value: `${mult(r.oomPerYear)} a year` }, { label: 'Ideas built in', value: `${F.count(r.ideasPerYear)} a year` }, { label: <Term id="publicKnowledge">Public know-how</Term>, value: `${mult(r.publicPerYear)} a year` }]}>What your own research (built-in ideas and tuning) added to your know-how: effective compute averaged over about two weeks, ideas built in over the last 14 weeks. A new, bigger base model and public know-how do not count.</TipCard>}>
          <span className="row-i"><ICON.revenue size={14} /><Term id="softwareRate">Know-how growth</Term> <b className="num">{mult(r.oomPerYear)}/yr</b> <span className="dim">· {F.count(r.ideasPerYear)} ideas/yr</span>{r.publicPerYear >= 0.005 && <span className="dim">· {mult(r.publicPerYear)}/yr <Term id="publicKnowledge">public</Term></span>}</span>
        </Tip>
        <span className="sp" />
      </div>
      <div className="rc-grid">{gs.map((g) => <StackCard key={g.key} s={s} g={g} />)}<OtherCard s={s} xs={other} /></div>
    </div>
  );
}
