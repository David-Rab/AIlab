// Research › Recipe (model v3 V2b; mockups-v3/v3-v2b-recipe): one card per recipe stack group (pretraining, RL, serving &
// systems). Home of stack efficiency, headroom, the recipe not trained into the internal model, the adopted ideas
// (believed band → realised value once a model trained with it is evaluated) and the software rate.
import { dateOf, fmtDate, softwareRate, stackViews } from '../../../engine/v2';
import type { GameStateV2, StackGroupView } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import { ICON } from '../icons';
import * as F from '../fmt';
import { fmtEff } from './ResearchProjects';

const GROUP_ICON = { pre: ICON.colPretraining, rl: ICON.colPosttraining, sys: ICON.colSystems } as const;
const GROUP_TRAIN: Record<StackGroupView['id'], string> = { pre: 'a new base run', rl: 'a post-training run', sys: 'new runs and serving' };
const oom = (x: number) => `${fmtEff(x)} OOM`;
/** Two significant figures (bands in the adopted list). */
const sig = (x: number, signed = true) => `${signed && x > 0 ? '+' : x < 0 ? '−' : ''}${Number(Math.abs(x).toPrecision(2))}`;

function StackCard({ s, g }: { s: GameStateV2; g: StackGroupView }) {
  const Ic = GROUP_ICON[g.id];
  const adopted = g.parts.reduce((a, p) => a + p.adopted, 0);
  const base = g.parts.reduce((a, p) => a + p.base, 0);
  const span = Math.max(1e-9, Math.abs(base) + adopted);
  const w = (x: number) => `${Math.max(0, (x / span) * 100)}%`;
  return (
    <Card className="rc-card" home={`stack.${g.id}`} title={<span className="row-i"><Ic size={15} /><Term id="recipeStack">{g.name}</Term></span>}
      sub={<Tip content={() => <TipCard title="Ideas adopted" value={String(g.n)} rows={g.parts.map((p) => ({ label: p.label, value: String(p.n) }))} />}><span>{g.n} ideas adopted</span></Tip>}>
      <div className="rc-hero">
        <Tip content={() => <TipCard title={<Term id="stackEfficiency">Stack efficiency</Term>} value={oom(g.now)} rows={g.parts.map((p) => ({ label: p.label, value: oom(p.now) }))}>Over the start recipe, at your latest base's FLOP. Start and public knowledge + adopted − headroom.</TipCard>}>
          <b className="num" data-test={`stack-now.${g.id}`}>{fmtEff(g.now)}</b>
        </Tip>
        <span className="dim">OOM over the start recipe</span>
      </div>
      <Tip content={() => <TipCard title="Make-up" rows={[{ label: 'Start and public knowledge', value: oom(base) }, { label: 'Adopted (delivered)', value: oom(adopted - g.headroom) }, { label: <Term id="headroom">Headroom (still to tune)</Term>, value: oom(g.headroom) }]} />}>
        <span className="rc-bar">{base > 0 && <i className="base" style={{ width: w(base) }} />}<i className="ad" style={{ width: w(adopted - g.headroom) }} /><i className="hr" style={{ width: w(g.headroom) }} /></span>
      </Tip>
      {g.gap !== undefined && (
        <div className="rp-kv"><span><Term id="trainedIn">Not trained in</Term></span>
          <Tip content={() => <TipCard title={<Term id="trainedIn">Not trained in</Term>} value={oom(g.gap ?? 0)} rows={g.parts.filter((p) => p.inModel !== undefined).map((p) => ({ label: `${p.label}: in your model`, value: oom(p.inModel ?? 0) }))}>{`Recipe your internal model lacks: ${GROUP_TRAIN[g.id]} trains it in.`}</TipCard>}>
            <span className={`num ${(g.gap ?? 0) > 0.1 ? 'tone-warn' : ''}`} data-test={`stack-gap.${g.id}`}>{oom(g.gap)}</span>
          </Tip>
          <Ref id="blueprint" to={{ panel: 'blueprint' }}>Train</Ref>
        </div>
      )}
      <div className="rp-kv"><span><Term id="headroom">Headroom</Term></span>
        <Tip content={() => <TipCard title={<Term id="headroom">Headroom</Term>} value={oom(g.headroom)}>Closed by research engineers on routine tuning (Company › Work).</TipCard>}><span className="num">{oom(g.headroom)}</span></Tip>
        <Ref id="routineTuning" to={{ panel: 'company', tab: 'work' }}>Tuning</Ref>
      </div>
      <div className="rp-k" style={{ marginTop: 8 }}><Term id="realisedEffect">Adopted · believed → realised</Term></div>
      {g.ideas.length === 0 && <div className="small dim">Nothing adopted yet. Add a {g.id === 'sys' ? 'systems' : g.id === 'rl' ? 'post-training' : 'pretraining'} project on Projects.</div>}
      <div className="rc-ideas">
        {g.ideas.slice(0, 8).map((a, i) => (
          <div key={`${a.id}-${a.day}-${i}`} className="rc-idea" data-idea={a.id}>
            <span className="ellip">{a.name}</span>
            <span className="dim small">{fmtDate(dateOf(s, a.day)).replace(/,? \d{4}$/, '')}</span>
            <Tip content={() => <TipCard title={<Term id="beliefBand">Believed</Term>} value={`${fmtEff(a.est)} ± ${fmtEff(a.estSd, 'oom', false)} OOM`}>The result's estimate band at your latest base when it came in.</TipCard>}><span className="num small">{sig(a.est)} ±{sig(a.estSd, false)}</span></Tip>
            <Tip content={() => <TipCard title={<Term id="realisedEffect">Realised</Term>} value={a.realised !== undefined ? oom(a.realised) : 'after the next model'}>{a.realised !== undefined ? 'Measured on a model trained after it was adopted.' : 'Shown once a model trained after its adoption has been evaluated.'}</TipCard>}>
              <span className={`num small ${a.realised === undefined ? 'dim' : a.realised >= a.est - a.estSd ? 'tone-pos' : 'tone-warn'}`}>{a.realised !== undefined ? `→ ${sig(a.realised)}` : '→ next model'}</span>
            </Tip>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Recipe({ s }: { s: GameStateV2 }) {
  const gs = stackViews(s);
  const r = softwareRate(s);
  return (
    <div className="rc-wrap">
      <div className="rc-head" data-home="softwareRate">
        <Tip content={() => <TipCard title={<Term id="softwareRate">Software progress</Term>} rows={[{ label: 'Effective compute', value: `${F.num(r.oomPerYear, 2)} OOM a year` }, { label: 'Ideas adopted', value: `${F.count(r.ideasPerYear)} a year` }]}>Growth of the recipe stacks over the last two weeks, at your latest base.</TipCard>}>
          <span className="row-i"><ICON.revenue size={14} /><Term id="softwareRate">Software progress</Term> <b className="num">{F.num(r.oomPerYear, 2)} OOM/yr</b> <span className="dim">· {F.count(r.ideasPerYear)} ideas/yr</span></span>
        </Tip>
        <span className="sp" />
      </div>
      <div className="rc-grid">{gs.map((g) => <StackCard key={g.id} s={s} g={g} />)}</div>
    </div>
  );
}
