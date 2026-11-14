// End screen (§5.4). The ONLY UI allowed to read hidden truth (lint-hidden exempts end/): ending card, five axis
// bars, hidden reveal (world, latents, agenda efficacy vs posterior, traits truth vs belief, U-modes, labs' Mis vs
// Index), causal replay, the AI 2027 comparison (the only place canon appears), export run summary.
import { MILESTONES } from '../../../data/world';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { AI2027_COMPUTE_TABLE } from '../../../data/v2/calibration';
import { TRAIT_ORDER } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { agendaRows, dateOf, decimalYear, eventDef, fmtDate, MILESTONE_NAMES, safetyTruth, selectHidden, topDecisions } from '../../../engine/v2';
import type { GameStateV2, SafetyLatents } from '../../../engine/v2';
import { store } from '../store';
import { Band, fmtB, fmtNum, Section, Soon } from '../ui';

const LATENT_WORDS: Record<keyof SafetyLatents, [string, string, string]> = {
  legibility: ['Interpretability', 'was hard', 'was tractable'],
  cotLoadBearing: ['Chain-of-thought', 'was not load-bearing', 'carried the real reasoning'],
  verificationAdvantage: ['Verification', 'was no easier than generation', 'was much easier than generation'],
  benignGeneralization: ['Training', 'generalized badly', 'generalized benignly'],
  formalizability: ['Formal methods', 'did not apply', 'applied widely'],
  schemingDefault: ['Scheming', 'was rare by default', 'was the default'],
};
const SCORE_KEYS = ['survival', 'freedom', 'prosperity', 'company', 'geopolitics'] as const;

function Scatter({ pts }: { pts: { x: number; y: number; label: string }[] }) {
  const W = 220;
  return (
    <svg width={W} height={W} className="scatter">
      <line x1={0} y1={W} x2={W} y2={0} stroke="var(--line-2)" strokeDasharray="3 3" />
      {pts.map((p, i) => <circle key={i} cx={p.x * W} cy={W - p.y * W} r={3} fill={Math.abs(p.x - p.y) > 0.2 ? 'var(--neg)' : 'var(--accent)'}><title>{`${p.label}: true ${p.x.toFixed(2)} · belief ${p.y.toFixed(2)}`}</title></circle>)}
      <text x={W - 4} y={W - 4} textAnchor="end" className="map-sub">true →</text>
      <text x={4} y={12} className="map-sub">belief ↑</text>
    </svg>
  );
}

export function EndScreen({ s }: { s: GameStateV2 }) {
  const e = s.ending!;
  const h = selectHidden(s);
  const truth = safetyTruth(s);
  const rows = agendaRows(s);
  const replay = topDecisions(s, 5);
  const pts = s.player.models.versions.flatMap((v) => TRAIT_ORDER.filter((t) => v.beliefs[t]).map((t) => ({ x: v.traitsTrue[t], y: v.beliefs[t].est, label: `${v.name} ${t}` })));
  const present = [...new Set(s.player.models.bases.flatMap((b) => b.uModes))];
  const labs = [...s.rivals.map((r) => ({ id: r.core.id, name: r.core.name })), { id: 'china', name: s.china.lab.core.name }];
  const yr = (d: number) => decimalYear(s, d);
  const summary = () => JSON.stringify({
    setup: s.setup, ending: e, day: s.time.day, world: { preset: s.setup.world, label: h.timeline.label, latents: h.latents, difficulty: h.difficultyMult },
    milestones: Object.fromEntries(Object.entries(s.player.milestoneDays).map(([i, d]) => [MILESTONE_NAMES[Number(i)], fmtDate(dateOf(s, d!))])),
    decisions: replay.map((r) => ({ day: r.decision.day, what: r.decision.eventId ?? r.decision.actionId, choice: r.decision.choice, caused: r.caused })),
    final: { cash: s.player.finance.cash, valuation: s.player.finance.valuation, compute: s.player.computeOnline, approval: s.pub.approval },
  }, null, 2);
  const committee = s.decisions.find((d) => d.eventId === 'E20');
  return (
    <div className="menu end-v2" data-test="endscreen">
      <div className="menu-kicker">{fmtDate(dateOf(s))} · day {e.day} · {e.power !== 'none' ? `power: ${e.power}` : ''}</div>
      <h1 className="ending-title" data-test="ending-title">{e.title}</h1>
      <div className="ending-text">{e.text}</div>
      <div className="ending-scores">
        {SCORE_KEYS.map((k) => (
          <div className="score" key={k}>
            <span className="score-label">{k}</span>
            <span className="score-val num">{Math.round(e.scores[k])}</span>
            <div className="meter"><div className="meter-fill" style={{ width: `${e.scores[k]}%`, background: 'var(--accent)' }} /></div>
          </div>
        ))}
      </div>
      <div className="end-grid">
        <Section title="This world">
          <div className="small">Timeline preset <b>{s.setup.world}</b> ({h.timeline.label}) · alignment difficulty ×{h.difficultyMult.toFixed(2)} · econ {h.econ}</div>
          <div className="small dim">Doom threshold {h.doomThreshold.toFixed(2)} · AI speedup at SC {h.timeline.G.join('/')} · compute elasticity {h.timeline.computeElasticity.toFixed(2)}</div>
          <ul className="latents">
            {(Object.keys(LATENT_WORDS) as (keyof SafetyLatents)[]).map((k) => {
              const [what, lo, hi] = LATENT_WORDS[k];
              const z = h.latents[k];
              return <li key={k}><b>{what}</b> {z < -0.5 ? lo : z > 0.5 ? hi : `was middling (${lo.replace('was ', '')} ↔ ${hi.replace('was ', '')})`} <span className="dim num">λ {z.toFixed(2)}</span></li>;
            })}
          </ul>
        </Section>
        <Section title="Agendas: true efficacy vs your posterior">
          {truth.efficacy.map((a) => {
            const r = rows.find((x) => x.id === a.id);
            return (
              <div className="end-ag" key={a.id}>
                <span className="small ellip">{AGENDA_BY_ID[a.id].name}</span>
                <Band lo={r?.band.lo ?? 0} hi={r?.band.hi ?? 1} mid={a.e} width={120} />
                <span className="num small">{a.e.toFixed(2)}</span>
              </div>
            );
          })}
          <div className="dim small">Band = your final posterior; tick = truth.</div>
        </Section>
        <Section title="Traits: truth vs belief">
          <Scatter pts={pts} />
          <div className="small">Failure modes present: {present.map((u) => <span key={u} className={s.player.safety.discoveredUModes.includes(u) ? 'tone-pos' : 'tone-neg'}>{UMODE_BY_ID[u]?.name ?? u}{s.player.safety.discoveredUModes.includes(u) ? ' (found)' : ' (missed)'}; </span>)}{!present.length && 'none'}</div>
          {truth.falseFindings.length > 0 && <div className="small tone-warn">False-validated findings: {truth.falseFindings.join(', ')}</div>}
        </Section>
        <Section title="Labs: true misalignment vs Index">
          <table className="tbl">
            <thead><tr><th>Lab</th><th>True Mis</th><th>Index</th><th>Your band</th></tr></thead>
            <tbody>
              <tr><td>{s.player.name}</td><td className="num">{(truth.misByLab.player ?? 0).toFixed(2)}</td><td>{s.researchBodies.index.grades.player?.letter ?? '—'}</td><td className="dim">—</td></tr>
              {labs.map((l) => {
                const r = l.id === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === l.id);
                return <tr key={l.id}><td>{l.name}</td><td className="num">{(truth.misByLab[l.id] ?? 0).toFixed(2)}</td><td>{s.researchBodies.index.grades[l.id]?.letter ?? '—'}</td><td className="num dim">{r ? `${r.intel.misalignBand[0]}–${r.intel.misalignBand[1]}` : '—'}</td></tr>;
              })}
            </tbody>
          </table>
        </Section>
        <Section title="Causal replay: five decisions that mattered">
          {replay.map((r, i) => (
            <div className="replay" key={i}>
              <span className="num dim">{fmtDate(dateOf(s, r.decision.day))}</span>
              <b>{r.decision.eventId ? eventDef(r.decision.eventId)?.title ?? r.decision.eventId : r.decision.actionId}</b>
              <span className="small">“{r.decision.choice.slice(0, 40)}”</span>
              <span className="small dim">{r.caused}</span>
            </div>
          ))}
          {!replay.length && <div className="dim small">No decisions recorded</div>}
        </Section>
        <Section title="Compared with AI 2027">
          <table className="tbl">
            <thead><tr><th>Milestone</th><th>You</th><th>AI 2027</th></tr></thead>
            <tbody>
              {MILESTONES.map((m) => {
                const d = s.player.milestoneDays[m.idx as 0];
                return <tr key={m.idx}><td>{m.name}</td><td className="num">{d !== undefined ? fmtDate(dateOf(s, d)) : '—'}</td><td className="num dim">{m.canon}</td></tr>;
              })}
            </tbody>
          </table>
          <table className="tbl">
            <thead><tr><th>Year</th><th>Your compute</th><th>AI 2027 leading lab</th></tr></thead>
            <tbody>
              {AI2027_COMPUTE_TABLE.map((r) => {
                const i = s.series.day.findIndex((d) => yr(d) >= r.year);
                return <tr key={r.year}><td className="num">{r.year.toFixed(2)}</td><td className="num">{i >= 0 ? fmtNum(s.series.compute[i]) : '—'}</td><td className="num dim">{fmtNum(r.h100e)}</td></tr>;
              })}
            </tbody>
          </table>
          <div className="small">Final revenue run-rate {fmtB(s.player.finance.revenueRun)}/yr.</div>
          <div className="small">In AI 2027 the oversight committee voted 6–4 to keep using the misaligned model. {committee ? `Your run: on ${fmtDate(dateOf(s, committee.day))} you chose “${committee.choice}” on the committee proposal.` : 'Your run never reached that vote.'}</div>
        </Section>
      </div>
      <div className="menu-actions">
        <button className="btn" data-test="export-summary" onClick={() => store.download(`ai27-run-${s.setup.seed}.json`, summary())}>Export run summary</button>
        <button className="btn btn-primary" data-test="end-new" onClick={() => store.go('setup')}>New game</button>
        <button className="btn" onClick={() => store.go('start')}>Menu</button>
        {e.id === 'acquired' && <span className="campaign locked">Continue as a division <Soon label="to come" /></span>}
      </div>
    </div>
  );
}
