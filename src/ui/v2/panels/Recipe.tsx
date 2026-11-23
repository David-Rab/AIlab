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
import { fmtEff } from './ResearchProjects';

type Key = StackView['key'];
const STACK_ICON: Record<Key, (typeof ICON)['colPretraining']> = { pre: ICON.colPretraining, rlMid: ICON.colPosttraining, rlCeil: ICON.colPosttraining, train: ICON.colSystems, serve: ICON.colSystems };
const TRAINS_IN: Partial<Record<Key, string>> = { pre: 'a new base run', rlMid: 'a post-training run', rlCeil: 'a post-training run' };
const ADD_KIND: Record<Key, string> = { pre: 'pretraining', rlMid: 'post-training', rlCeil: 'post-training', train: 'systems', serve: 'systems' };
const oom = (x: number) => `${fmtEff(x)} OOM`;
/** Two significant figures (bands in the adopted list). */
const sig = (x: number, signed = true) => `${signed && x > 0 ? '+' : x < 0 ? '−' : ''}${Number(Math.abs(x).toPrecision(2))}`;
const batch = (a: AdoptedView) => (a.b && a.b > 1 ? ` (${a.b} ideas)` : '');
const short = (s: GameStateV2, day: number) => fmtDate(dateOf(s, day)).replace(/,? \d{4}$/, '');

/** RF-R5: where an adopted idea has been measured: the first evaluated model trained with it (its measured gain is on
 *  that model's card, Models), or not yet. An idea has no measured number of its own. */
function SeenIn({ a }: { a: AdoptedView }) {
  return (
    <Tip content={() => <TipCard title={<Term id="realisedEffect">Measured in</Term>} value={a.seenIn ?? 'not yet'}>
      {a.seenIn ? `${a.seenIn} is the first evaluated model trained with it. Its measured gain over the model before it is on its card under Models; that gain includes everything else that differs between the two models.` : `Trained in once ${a.embodiedBy} after it was adopted has been evaluated. Until then you have only the believed band.`}
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
    <Card className="rc-card" home={`stack.${g.key}`} title={<span className="row-i"><Ic size={15} /><Term id="recipeStack">{g.name}</Term></span>}
      sub={<Tip content={() => <TipCard title="Ideas adopted" value={String(g.n)}>Every idea counts once: a line's batch counts each idea in it; an idea that also moves another stack counts in its main stack only.</TipCard>}><span>{g.n} ideas adopted</span></Tip>}>
      <div className="rc-hero">
        <Tip content={() => <TipCard title={<Term id="stackEfficiency">Stack efficiency</Term>} value={`${oom(g.now)} ± ${fmtEff(g.adoptedSd, 'oom', false)}`}>{`Believed, over the start recipe: start and public knowledge + the sum of your adopted results' estimates (each at your latest base when it came in), ± their combined band. In OOM ${g.unit}: not comparable with the other stacks.`}</TipCard>}>
          <b className="num" data-test={`stack-now.${g.key}`}>{fmtEff(g.now)}</b>
        </Tip>
        <span className="dim"><Term id="oom">OOM</Term> {g.unit}</span>
      </div>
      <Tip content={() => <TipCard title="Make-up" rows={[{ label: 'Start and public knowledge', value: oom(g.base) }, { label: 'Adopted (believed)', value: `${oom(g.adopted)} ± ${fmtEff(g.adoptedSd, 'oom', false)}` }]} />}>
        <span className="rc-bar">{g.base > 0 && <i className="base" style={{ width: w(g.base) }} />}<i className="ad" style={{ width: w(g.adopted) }} /></span>
      </Tip>
      {g.gap !== undefined && (
        <div className="rp-kv"><span><Term id="trainedIn">Not trained in</Term></span>
          <Tip content={() => <TipCard title={<Term id="trainedIn">Not trained in</Term>} value={oom(g.gap ?? 0)} rows={[{ label: 'In your internal model', value: oom(g.inModel ?? 0) }]}>{`Recipe your internal model lacks: ${TRAINS_IN[g.key] ?? 'a new run'} trains it in.`}</TipCard>}>
            <span className={`num ${(g.gap ?? 0) > 0.1 ? 'tone-warn' : ''}`} data-test={`stack-gap.${g.key}`}>{oom(g.gap ?? 0)}</span>
          </Tip>
          <Ref id="blueprint" to={{ panel: 'blueprint' }}>Train</Ref>
        </div>
      )}
      <div className="rp-k" style={{ marginTop: 8 }}><Term id="beliefBand">Adopted · believed</Term> <span className="dim">(<Term id="oom">OOM</Term>)</span></div>
      {g.ideas.length === 0 && <div className="small dim">Nothing adopted yet. Add a {ADD_KIND[g.key]} project on Projects.</div>}
      <div className="rc-ideas">
        {g.ideas.slice(0, 8).map((a, i) => (
          <div key={`${a.id}-${a.day}-${i}`} className="rc-idea" data-idea={a.id}>
            <span className="ellip">{a.name}{batch(a)}</span>
            <span className="dim small">{short(s, a.day)}</span>
            <Tip content={() => <TipCard title={<Term id="beliefBand">Believed</Term>} value={`${fmtEff(a.est)} ± ${fmtEff(a.estSd, 'oom', false)} OOM`}>The result's estimate band at your latest base when it came in.</TipCard>}><span className="num small">{sig(a.est)} ±{sig(a.estSd, false)}</span></Tip>
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
    <Card className="rc-card" home="stack.other" title={<span className="row-i"><ICON.data size={15} /><Term id="otherEffects">Domain & data effects</Term></span>}
      sub={<span>{xs.length} adopted</span>}>
      {xs.length === 0 && <div className="small dim">Nothing adopted yet.</div>}
      <div className="rc-ideas">
        {xs.slice(0, 8).map((a, i) => (
          <div key={`${a.id}-${a.day}-${i}`} data-idea={a.id}>
            <div className="rc-idea"><span className="ellip">{a.name}</span><span className="dim small">{short(s, a.day)}</span><span /><span /></div>
            {a.rows.map((r) => (
              <div key={r.label} className="rc-idea small" data-effect={r.label}>
                <span className="ellip dim">{r.label} ({r.unit.startsWith('OOM') ? <><Term id="oom">OOM</Term>{r.unit.slice(3)}</> : r.unit})</span>
                <span />
                <Tip content={() => <TipCard title={<Term id="beliefBand">Believed</Term>} value={`${sig(r.est)} ± ${sig(r.estSd, false)} ${r.unit}`}>The result's estimate band when it came in.</TipCard>}><span className="num small">{sig(r.est)} ±{sig(r.estSd, false)}</span></Tip>
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
        <Tip content={() => <TipCard title={<Term id="softwareRate">Software progress</Term>} rows={[{ label: <Term id="effCompute">Effective compute</Term>, value: `${F.num(r.oomPerYear, 2)} OOM a year` }, { label: 'Ideas adopted into the stacks', value: `${F.count(r.ideasPerYear)} a year` }, { label: <Term id="publicKnowledge">Public knowledge</Term>, value: `+${F.num(r.publicPerYear, 2)} OOM a year` }]}>What your own research (adopted ideas and tuning) added to the recipe stacks at your latest base: effective compute averaged over about two weeks, ideas adopted over the last 14 weeks. A new, bigger base and public knowledge do not count.</TipCard>}>
          <span className="row-i"><ICON.revenue size={14} /><Term id="softwareRate">Software progress</Term> <b className="num">{F.num(r.oomPerYear, 2)} <Term id="oom">OOM</Term>/yr</b> <span className="dim">· {F.count(r.ideasPerYear)} ideas/yr</span>{r.publicPerYear >= 0.005 && <span className="dim">· +{F.num(r.publicPerYear, 2)} OOM/yr <Term id="publicKnowledge">public</Term></span>}</span>
        </Tip>
        <span className="sp" />
      </div>
      <div className="rc-grid">{gs.map((g) => <StackCard key={g.key} s={s} g={g} />)}<OtherCard s={s} xs={other} /></div>
    </div>
  );
}
