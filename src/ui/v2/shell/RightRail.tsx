// Right rail (§6.2, §6.4, §6.5 level 1): bottleneck bar + next-model gate, obligations, relations mini-web, rival cards.
import { activeRivals, engine, leadDays, liveCommitments, nextModelGate } from '../../../engine/v2';
import type { CounterpartyId, GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { Band, fmtMult, fmtNum, pct, Stack, Tip, TipCard, unlocked } from '../ui';

const PART_COLOR = { base: '#5aa9ff', agents: '#a58cff', taste: '#4cc38a', other: '#66768a' };

export function BottleneckBar({ s }: { s: GameStateV2 }) {
  const p = engine.production(s, 'player');
  const lnM = Math.log(Math.max(1.0001, p.M));
  const parts = (Object.keys(PART_COLOR) as (keyof typeof PART_COLOR)[]).map((k) => ({ k, v: Math.abs(Math.log(Math.max(1e-6, p.parts[k]))) / Math.max(1e-6, lnM), color: PART_COLOR[k] }));
  const chips = ([['exp', 'exp'], ['humans', 'staff'], ['agents', 'agents']] as const)
    .map(([k, label]) => ({ label, gain: Math.pow(1.1, p.elast[k]) - 1, perD: p.perDollar[k] }))
    .sort((a, b) => b.perD - a.perD);
  const g = nextModelGate(s);
  return (
    <div className="rail-block" data-test="bottleneck">
      <Tip as="div" content={() => (
        <TipCard title="Production" value={p.label} rows={[
          { label: 'AI labour: copies × speed', value: `${fmtNum(p.labor.copies)} × ${p.labor.speed.toFixed(1)}` },
          { label: 'AI FTE · human FTE', value: `${fmtNum(p.labor.aiFTE)} · ${fmtNum(p.labor.wH)}` },
          { label: 'AI taste (SD above median)', value: p.sdAI.toFixed(2) },
          { label: 'Ratios h / k / c / d vs reference', value: `${p.ratios.h.toFixed(2)} / ${p.ratios.k.toFixed(2)} / ${p.ratios.c.toFixed(2)} / ${p.ratios.d.toFixed(2)}` },
          { label: 'What-if 2× staff', value: fmtMult(p.whatIf.humans2) }, { label: 'What-if 2× agents', value: fmtMult(p.whatIf.agents2) },
          { label: 'What-if 2× experiments', value: fmtMult(p.whatIf.exp2) }, { label: 'What-if ½ experiments', value: fmtMult(p.whatIf.exp05) },
          { label: 'Ceilings M (humans / agents / exp)', value: `${fmtMult(p.ceilings.humans)} / ${fmtMult(p.ceilings.agents)} / ${fmtMult(p.ceilings.exp)}` },
        ]}>Shares of ln M by factor. See [[bottleneck]].</TipCard>
      )}>
        <div className="rail-head"><span>Bottleneck</span><span className="rail-tag">{p.label}</span></div>
        <Stack parts={parts.map((x) => ({ v: x.v, color: x.color, label: x.k }))} h={10} />
        <div className="bn-legend">{parts.map((x) => <span key={x.k}><i style={{ background: x.color }} />{x.k}</span>)}</div>
      </Tip>
      <div className="bn-chips">
        {chips.map((c, i) => (
          <span key={c.label} className={`bn-chip ${i === 0 ? 'best' : ''}`} title="per-$ order, best first">+10% {c.label} → <b className="num">+{(c.gain * 100).toFixed(1)}%</b></span>
        ))}
      </div>
      <Tip as="div" content={() => (
        <TipCard title="Next model" value={g.binding} rows={[
          { label: 'Training days (frontier base)', value: `${Math.round(g.trainingDays)} d`, tone: g.trainingDays > 120 ? 'neg' : 'neutral' },
          { label: 'Data stock / need', value: g.dataRatio.toFixed(2), tone: g.dataRatio < 1 ? 'neg' : 'neutral' },
          { label: 'Free MW on live sites', value: `${Math.round(g.mwFree)} MW` },
          { label: 'Env budget / cash', value: pct(g.cashShare), tone: g.cashShare > 0.5 ? 'neg' : 'neutral' },
        ]}>What gates your next frontier base run.</TipCard>
      )}>
        <div className="rail-sub">Next model: <b className="tone-warn">{g.binding}</b></div>
        <div className="nm-bars">
          <MiniBar label="train" v={Math.min(1, 90 / Math.max(1, g.trainingDays))} />
          <MiniBar label="data" v={Math.min(1, g.dataRatio)} />
          <MiniBar label="power" v={g.mwFree > 0 ? 1 : 0.2} />
          <MiniBar label="cash" v={Math.max(0, 1 - g.cashShare)} />
        </div>
      </Tip>
    </div>
  );
}
function MiniBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="nm-bar"><span className="dim">{label}</span><div className="nm-track"><div style={{ width: `${v * 100}%`, background: v < 0.5 ? 'var(--neg)' : v < 0.8 ? 'var(--warn)' : 'var(--pos)' }} /></div></div>
  );
}

export function Obligations({ s }: { s: GameStateV2 }) {
  const cs = liveCommitments(s);
  return (
    <div className="rail-block" data-test="obligations">
      <div className="rail-head"><span>Obligations ({cs.length})</span><button className="mini" onClick={() => store.setPanel('relations')}>›</button></div>
      {cs.length === 0 && <div className="small dim">None signed</div>}
      {cs.slice(0, 5).map((c) => (
        <Tip as="div" key={c.id} content={() => (
          <TipCard title={c.title} value={c.kind} rows={[
            { label: 'Condition', value: c.condition.predicate }, { label: 'Break cost', value: `−${c.breakCost.trust} trust · −${c.breakCost.credibility} cred`, tone: 'neg' },
            { label: 'Audience', value: c.audience.join(', ') }, { label: 'Amendments', value: c.amendments },
          ]}>See [[commitment]].</TipCard>
        )}>
          <div className="obl-row"><span className="ellip">{c.title}</span><span className="dim small num">−{c.breakCost.credibility}</span></div>
        </Tip>
      ))}
    </div>
  );
}

const WEB: { id: CounterpartyId; label: string }[] = [
  { id: 'exec', label: 'Exec' }, { id: 'congress', label: 'Congress' }, { id: 'states', label: 'States' }, { id: 'evalGov', label: 'CAISI' },
  { id: 'evalIndep', label: 'Evals' }, { id: 'academia', label: 'Academia' }, { id: 'china', label: 'China' },
];
export function trustColor(t: number) {
  return t >= 65 ? 'var(--pos)' : t >= 45 ? 'var(--accent)' : t >= 25 ? 'var(--warn)' : 'var(--neg)';
}
export function MiniWeb({ s }: { s: GameStateV2 }) {
  const W = 250;
  const H = 120;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <div className="rail-block" data-test="miniweb">
      <div className="rail-head"><span>Relations</span><button className="mini" onClick={() => store.setPanel('relations')}>›</button></div>
      <svg width={W} height={H}>
        {WEB.map((n, i) => {
          const a = (Math.PI * 2 * i) / WEB.length - Math.PI / 2;
          const x = cx + Math.cos(a) * 100;
          const y = cy + Math.sin(a) * 46;
          const st = s.relations.stocks[n.id];
          const t = st?.trust ?? 0;
          return (
            <g key={n.id}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={trustColor(t)} strokeWidth={1 + (st?.access ?? 0)} opacity={0.7} />
              <circle cx={x} cy={y} r={4} fill={trustColor(t)} />
              <text x={x} y={y - 7} className="web-lbl" textAnchor="middle">{n.label} {Math.round(t)}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={7} fill="var(--accent)" />
      </svg>
    </div>
  );
}

export function RivalCards({ s }: { s: GameStateV2 }) {
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  const intel = unlocked(s, 'rivalIntel');
  return (
    <div className="rail-block" data-test="rivals">
      <div className="rail-head"><span>Rivals</span></div>
      {labs.map((r) => {
        const l = leadDays(s, r.core.id);
        const grade = s.researchBodies.index.grades[r.core.id]?.letter;
        return (
          <Tip as="div" key={r.core.id} content={() => (
            <TipCard title={r.core.name} value={grade ? `Index ${grade}` : undefined} rows={[
              { label: 'Lead (you vs them)', value: `${l.est >= 0 ? '+' : ''}${l.est}d ± ${l.sd}`, tone: l.est >= 0 ? 'pos' : 'neg' },
              { label: 'Misalignment band', value: `${r.intel.misalignBand[0].toFixed(2)}–${r.intel.misalignBand[1].toFixed(2)}` },
              { label: 'Framework', value: `${r.visible.clauseType} v${r.visible.frameworkVersion}` },
              { label: 'Testers', value: r.visible.testers.join(', ') || 'none' },
              { label: 'Known incidents', value: r.intel.knownIncidents.length },
              { label: 'Public model', value: r.publicModel?.name ?? '—' },
            ]}>Estimates from releases, evaluators and intel. See [[lead]].</TipCard>
          )}>
            <div className="rival-card">
              <div className="rival-top"><span className="rival-name">{r.core.name}</span><span className={`num ${l.est >= 0 ? 'tone-pos' : 'tone-neg'}`}>{l.est >= 0 ? '+' : ''}{l.est}d</span></div>
              {intel ? (
                <div className="rival-sub">
                  <Band lo={r.intel.misalignBand[0]} hi={r.intel.misalignBand[1]} color="var(--rival)" width={80} />
                  <span className="dim small">±{l.sd}d</span>
                  {grade && <span className="chip-mini">{grade}</span>}
                </div>
              ) : <div className="rival-sub dim small">intel in Act 2</div>}
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

export function RightRail({ s }: { s: GameStateV2 }) {
  return (
    <aside className="rail">
      <BottleneckBar s={s} />
      <Obligations s={s} />
      <MiniWeb s={s} />
      <RivalCards s={s} />
    </aside>
  );
}
