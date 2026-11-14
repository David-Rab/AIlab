// Safety Lab (§6.3, §3.5): agenda portfolio, techniques (strength vs capability, M½, Goodhart mask flag), trait
// graph, investigations, incidents (timers, response menu §3.5.9), U-mode cards, findings log, eval gate.
import { useState } from 'react';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { dateOf, engine, fmtDate, safetyView } from '../../../engine/v2';
import type { GameStateV2, ResponseKind, TraitId } from '../../../engine/v2';
import { ActBtn, Band, Gate, Meter, pct, Row, Section, Seg, Slider, Term, Tip, TipCard, unlocked } from '../ui';
import { selectedVersion } from './Models';
import { TraitGraph } from './TraitGraph';

const LEVELS = ['off', 'seed', 'serious', 'major'] as const;
const RESPONSES: ResponseKind[] = ['patchSignal', 'retrainAgainst', 'targetedTraining', 'restrictContext', 'addControl', 'rollback', 'disclose'];

function Curve({ s0, mHalf, k, M }: { s0: number; mHalf: number; k: number; M: number }) {
  const W = 120;
  const H = 34;
  const xs = Array.from({ length: 30 }, (_, i) => Math.pow(10, (i / 29) * 3));
  const y = (m: number) => s0 / (1 + Math.pow(m / Math.max(1e-6, mHalf), Math.max(0.01, k)));
  const px = (m: number) => (Math.log10(m) / 3) * W;
  const pts = xs.map((m) => `${px(m)},${H - 2 - y(m) * (H - 4)}`).join(' ');
  return (
    <svg width={W} height={H} className="spark">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.4} />
      {mHalf < 1e6 && <line x1={px(Math.min(1000, mHalf))} x2={px(Math.min(1000, mHalf))} y1={0} y2={H} stroke="var(--warn)" strokeDasharray="2 2" />}
      <line x1={px(Math.max(1, Math.min(1000, M)))} x2={px(Math.max(1, Math.min(1000, M)))} y1={0} y2={H} stroke="#fff" opacity={0.6} />
    </svg>
  );
}

export function SafetyLab({ s }: { s: GameStateV2 }) {
  const sv = safetyView(s);
  const v = selectedVersion(s);
  const M = engine.production(s, 'player').M;
  const [invTrait, setInvTrait] = useState<TraitId>('SCHEME');
  const [mon, setMon] = useState(s.player.safety.monitoringShare);
  const [autoShare, setAutoShare] = useState(0.5);
  const u = sv.understanding;
  return (
    <div className="panel-v2 grid2" data-panel="safety">
      <Section title={<Term id="agenda">Agenda portfolio</Term>} right={<span className="num">U {u.U.toFixed(1)} · margin {u.margin >= 0 ? '+' : ''}{u.margin.toFixed(1)}</span>}>
        <Gate s={s} k="agendas">
          <table className="tbl">
            <thead><tr><th>Agenda</th><th>Level</th><th>FTE</th><th>Efficacy band</th><th>Find/yr</th><th>AI</th><th /></tr></thead>
            <tbody>
              {sv.agendas.map((a) => (
                <tr key={a.id} data-agenda={a.id} className={a.status === 'deadEnd' ? 'dim' : ''}>
                  <td><Tip content={() => <TipCard title={`${a.id} ${a.name}`} value={a.status} rows={[{ label: 'Posterior mean', value: a.band.mean.toFixed(2) }, { label: 'Band', value: `${a.band.lo.toFixed(2)}–${a.band.hi.toFixed(2)} (${a.band.label})` }, { label: 'Findings', value: a.findings }, { label: 'Compute share', value: pct(a.computeShare) }, ...(a.refresh ? [{ label: `Refresh ${a.refresh.techniqueId}`, value: pct(a.refresh.progress) }] : [])]} footer={`T1 ${AGENDA_BY_ID[a.id].T1} mo`} />}>{a.name}</Tip></td>
                  <td><Seg value={a.level as (typeof LEVELS)[number]} options={LEVELS.map((l) => ({ v: l, label: { off: '—', seed: 'seed', serious: 'ser', major: 'maj' }[l], tip: l }))} onChange={(l) => (l === 'off' ? store_act('safety.cut', { agenda: a.id }) : store_act('safety.fund', { agenda: a.id, level: l }))} /></td>
                  <td className="num">{Math.round(a.fte)}</td>
                  <td><Band lo={a.band.lo} hi={a.band.hi} mid={a.band.mean} width={80} /></td>
                  <td className="num">{a.findingsPerYear.toFixed(1)}</td>
                  <td className="num">{pct(a.aiLabour)}</td>
                  <td className="btn-cell">
                    <ActBtn id="safety.fund" testId={`safety.fund.${a.id}`} params={{ agenda: a.id, level: 'serious' }} label="Fund" inline={false} />
                    {a.fte > 0 && <ActBtn id="safety.cut" testId={`safety.cut.${a.id}`} params={{ agenda: a.id }} label="Cut" inline={false} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Gate s={s} k="aiLabour">
            <Row label={`Automate share ${pct(autoShare)}`}><Slider value={autoShare} min={0} max={1} step={0.05} onChange={setAutoShare} /><ActBtn id="safety.automate" params={{ share: autoShare }} /></Row>
          </Gate>
        </Gate>
      </Section>

      <Section title={<Term id="evalGate">Eval gate · monitoring</Term>} right={sv.nextDecay ? <span className="small tone-warn">nearest decay: {sv.nextDecay.name} {pct(sv.nextDecay.decay)}</span> : null}>
        <Row label="Gate"><Seg value={sv.evalGate} options={(['none', 'basic', 'full', 'fullPlusExternal'] as const).map((g) => ({ v: g, label: g === 'fullPlusExternal' ? 'full+ext' : g }))} onChange={(g) => store_act('safety.evalGate', { level: g })} /></Row>
        <div className="btn-row"><ActBtn id="safety.evalGate" testId="safety.evalGate.full" params={{ level: 'full' }} label="Gate: full" /></div>
        <Row label={`Runtime monitoring ${pct(mon)}`}><Slider value={mon} min={0} max={0.8} step={0.05} onChange={setMon} /><ActBtn id="safety.monitoring" params={{ share: mon }} label="Set" /></Row>
        <Row label="Publication policy"><span className="small">{s.player.policies.publishSafety}</span></Row>
        <div className="btn-row wrap">
          {(['none', 'selective', 'all'] as const).map((pol) => <ActBtn key={pol} id="safety.publishPolicy" testId={`safety.publishPolicy.${pol}`} params={{ policy: pol }} label={`Publish: ${pol}`} inline={false} />)}
          <ActBtn id="safety.pledge" />
        </div>
        <div className="perTrait">
          {CRITICAL_TRAITS.map((t) => <Row key={t} label={`Detect ${TRAIT_BY_ID[t].name}`}><Meter value={u.perTrait[t] ?? 0} max={1} width={90} color={(u.perTrait[t] ?? 0) >= 0.5 ? 'var(--pos)' : 'var(--neg)'} /><span className="num">{pct(u.perTrait[t] ?? 0)}</span></Row>)}
        </div>
      </Section>

      <Section title={<Term id="technique">Techniques</Term>} right={<span className="dim small">curve: strength vs M (log) · │ now · ┆ M½</span>}>
        <table className="tbl">
          <thead><tr><th>Technique</th><th>Fam</th><th>Role</th><th>Strength</th><th>Curve</th><th>Mask</th><th /></tr></thead>
          <tbody>
            {sv.techniques.filter((t) => t.unlocked).map((t) => {
              const st = s.player.safety.techniques[t.id];
              return (
                <tr key={t.id} data-technique={t.id}>
                  <td className="ellip">{t.name}</td><td>{t.family}</td><td className="small">{t.role}</td>
                  <td className="num">{t.strength.toFixed(2)}</td>
                  <td><Curve s0={st?.s0 ?? t.strength} mHalf={t.mHalf} k={st?.k ?? 1} M={M} /></td>
                  <td>{t.trainedAgainst > 0.05 ? <span className="tone-warn small" title="Trained against: Goodhart masking">mask {pct(t.trainedAgainst)}</span> : <span className="dim">·</span>}</td>
                  <td className="btn-cell">
                    {t.role !== 'fix' && <ActBtn id="safety.technique" testId={`safety.technique.${t.id}`} params={{ id: t.id, active: !t.active }} label={t.active ? 'On' : 'Off'} inline={false} />}
                    <ActBtn id="safety.refresh" testId={`safety.refresh.${t.id}`} params={{ techniqueId: t.id }} label="Re-validate" inline={false} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Incidents" right={<span className="dim small">{sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length} open</span>}>
        {sv.incidents.slice(-8).reverse().map((i) => (
          <div className={`incident sev-${i.severity}`} key={i.id} data-incident={i.id}>
            <div className="inc-head">
              <b>S{i.severity}</b> <span>{i.apparent}</span> <span className="dim small">{i.exposure} · {fmtDate(dateOf(s, i.day))}</span>
              <span className="small">{i.status}</span>
              {i.publicTimerDays !== undefined && i.status === 'open' && <span className="chip-mini tone-neg">public in {i.publicTimerDays}d</span>}
            </div>
            {(i.status === 'open' || i.status === 'investigating') && (
              <div className="btn-row wrap">
                {RESPONSES.map((k) => <ActBtn key={k} id="safety.respond" testId={`safety.respond.${k}`} params={{ kind: k, incidentId: i.id, versionId: i.versionId }} label={k} inline={false} />)}
                <ActBtn id="safety.investigate" testId="safety.investigate.incident" params={{ incidentId: i.id, fte: 15 }} label="Investigate" inline={false} />
              </div>
            )}
          </div>
        ))}
        {!sv.incidents.length && <div className="dim small">No incidents</div>}
      </Section>

      <Section title="Investigations">
        {sv.investigations.slice(-6).map((x) => (
          <Row key={x.id} label={x.target.kind === 'trait' ? `${x.target.trait} on ${x.target.versionId}` : `incident ${x.target.incidentId}`}>
            <Meter value={x.clarity} max={1} width={80} />
            <span className="small">{x.outcome ?? `${Math.round(x.fte)} FTE`}</span>
            {!x.outcome && <ActBtn id="safety.closeCase" params={{ id: x.id }} label="Close" inline={false} />}
          </Row>
        ))}
        <Row label="Trait"><select className="text-input" data-test="inv-trait" value={invTrait} onChange={(e) => setInvTrait(e.target.value as TraitId)}>{TRAIT_IDS.map((t) => <option key={t} value={t}>{TRAIT_BY_ID[t].name}</option>)}</select></Row>
        <div className="btn-row"><ActBtn id="safety.investigate" params={{ versionId: v?.id ?? '', trait: invTrait, fte: 15 }} primary /></div>
      </Section>

      <Section title={<Term id="finding">Findings log</Term>} right={<span className="dim small">{sv.findings.length}</span>}>
        <div className="findings">
          {sv.findings.slice(-12).reverse().map((f) => (
            <div className="finding" key={f.id + f.day} data-finding={f.id}>
              <span className={`ftype ft-${f.type}`}>{f.type}</span>
              <span className={`ellip ${f.retracted ? 'strike' : ''}`}>{f.title}</span>
              <span className="dim small">{AGENDA_BY_ID[f.agenda]?.name ?? f.agenda} · {fmtDate(dateOf(s, f.day))}</span>
              {f.published ? <span className="chip-mini">published</span> : <ActBtn id="safety.publish" testId={`safety.publish.${f.id}`} params={{ findingId: f.id }} label="Publish" inline={false} />}
            </div>
          ))}
          {!sv.findings.length && <div className="dim small">No findings yet</div>}
        </div>
      </Section>

      <Section title={<Term id="umode">Failure-mode cards</Term>}>
        <div className="umodes">
          {sv.uModes.map((x) => <Tip as="div" key={x.id} content={() => <TipCard title={x.name} value={x.id} footer={x.source}>{`Shows as ${x.mapsTo} once known.`}</TipCard>}><div className="umode">{x.id} · {x.name}{x.disclosed ? <span className="chip-mini">public</span> : null}</div></Tip>)}
          {!sv.uModes.length && <div className="dim small">None discovered</div>}
        </div>
      </Section>

      <div className="span2">
        <Section title={`Trait graph · beliefs for ${v?.name ?? '—'}`} right={<span className="small">Mis est {sv.beliefs ? `${sv.beliefs.misEst.toFixed(2)} (${sv.beliefs.misBand[0].toFixed(2)}–${sv.beliefs.misBand[1].toFixed(2)})` : '—'}</span>}>
          {unlocked(s, 'agendas') ? <TraitGraph s={s} versionId={v?.id} /> : <Gate s={s} k="agendas">{null}</Gate>}
        </Section>
      </div>
    </div>
  );
}

import { store } from '../store';
function store_act(id: string, p: Record<string, string | number | boolean>) {
  store.act(id, p);
}
