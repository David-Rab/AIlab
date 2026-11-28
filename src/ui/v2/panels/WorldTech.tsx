// World › Tech & control (W8b-3, design/world/ui/mockups/world-tech.png): the control index (who holds each domain), robots
// built (with the economic-zones law chip, link to Powers), all 29 world technologies as compact tiles grouped in use ·
// ramping · locked, and the moonshot control.
import { useState } from 'react';
import { WORLD_TECHS } from '../../../data/v2/techs';
import type { WorldTechDef } from '../../../data/v2/techs';
import {
  CONTROL_DOMAINS, dateOf, fmtDate, internalVersion, LEVERAGE_THRESHOLDS, lawStatus, leverageAll, measuredDomains, techBlockerAtLevels, techGateLevels,
} from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { ActBtn, fmtNum, Gate, Limit, pct, Slider, Term, Tip, TipCard } from '../ui';
import { Ref } from '../kit';
import { labColor } from '../theme';
import { POWERS } from './worldLinks';
import './world.css';

const DOMAIN_NAME: Record<string, string> = { ECON: 'Economy', GOV: 'Government', MIL: 'Military', INFRA: 'Infrastructure' };
type Group = 'done' | 'ramp' | 'locked';

function ControlIndex({ s, names }: { s: GameStateV2; names: (id: string) => string }) {
  const lev = leverageAll(s);
  return (
    <section className="section wt-control" data-test="wt-control">
      <div className="section-head">
        <span className="section-title"><Term id="leverage">Control index</Term></span>
        <Tip content={() => <TipCard title={<Term id="leverage">Your control</Term>} value={pct(lev.player ?? 0, 1)} rows={Object.keys(lev).map((k) => ({ label: names(k), value: pct(lev[k], 1) }))} />}><span className="small">{s.player.name} {pct(lev.player ?? 0, 1)}</span></Tip>
      </div>
      <Gate s={s} k="world">
        {CONTROL_DOMAINS.map((d) => {
          const c = s.world.control[d];
          const ent = Object.entries(c.shares).filter(([, x]) => x > 0.001).sort((a, b) => b[1] - a[1]);
          return (
            <Tip as="div" key={d} content={() => <TipCard title={`${DOMAIN_NAME[d]} · AI share ${pct(c.P)}`} rows={[...ent.map(([k, x]) => ({ label: names(k), value: pct(x, 1) })), { label: <Term id="tiers">Tiers tool / advisor / on-loop / out-of-loop</Term>, value: c.tiers.map((t) => pct(t)).join(' / ') }, { label: 'Acceptance', value: pct(c.accept) }, { label: 'Tier cap', value: c.tierCap }]} />}>
              <div className="ctrl-row wt-crow" data-test={`wt-ctrl.${d}`}>
                <span className="small ctrl-lbl">{DOMAIN_NAME[d]}</span>
                <div className="ctrl-bar">
                  <div className="ctrl-fill" style={{ width: `${c.P * 100}%` }}>
                    {ent.map(([k, x]) => <div key={k} className={`ctrl-seg tier-${c.tierCap}`} style={{ width: `${x * 100}%`, background: labColor(k) }} />)}
                  </div>
                  {Object.values(LEVERAGE_THRESHOLDS).map((t) => <div key={t} className="ctrl-thr" style={{ left: `${t * 100}%` }} />)}
                </div>
                <span className="num small">{pct(c.P)}</span>
              </div>
            </Tip>
          );
        })}
        <div className="wt-ticks small dim">
          Ticks: {Object.entries(LEVERAGE_THRESHOLDS).map(([n, t], i) => <span key={n}>{i > 0 && ' · '}<Tip content={() => <TipCard title={n} value={pct(t)}>An actor holding this share of a domain is {n} there.</TipCard>}><span className="wt-tick">{n}</span></Tip></span>)}
        </div>
        <div className="legend small">{Object.keys(lev).map((k) => <Tip key={k} content={() => <TipCard title={names(k)} value={pct(lev[k], 1)}>Share of the control index across all domains.</TipCard>}><span><i style={{ background: labColor(k) }} />{names(k)} {pct(lev[k], 1)}</span></Tip>)}</div>
      </Gate>
    </section>
  );
}

function Robots({ s }: { s: GameStateV2 }) {
  const rate = s.world.robots.prodPerYear / 12;
  const sez = lawStatus(s).find((l) => l.id === 'sez');
  const h = s.series.robots;
  return (
    <section className="section wt-robots" data-test="wt-robots">
      <div className="section-head"><span className="section-title"><Term id="robots">Robots</Term></span></div>
      <Tip as="div" content={() => <TipCard title={<Term id="robots">Robots built</Term>} value={`${fmtNum(rate)} a month`}>Robots built worldwide.</TipCard>}>
        <div className="wt-rbig"><span className="num wk-big-n">{fmtNum(rate)}</span> <span className="dim">/ month</span>
          {h && h.length >= 2 && <RobotSpark data={h} />}
        </div>
      </Tip>
      {sez && (
        <Tip content={() => <TipCard title={<Term id="lawSez">{sez.name}</Term>} value={sez.inForce ? `in force since ${fmtDate(dateOf(s, sez.since!))}` : 'not in force'} rows={[{ label: 'Turns on', value: sez.on.replace(/^On when /, '') }, { label: 'Turns off', value: sez.off.replace(/^Off when /, '') }]} footer="Its home is Powers.">Zones where robot factories can be built without the usual permits.</TipCard>}>
          <span><Ref id="lawSez" to={POWERS}><i className={`wk-dot ${sez.inForce ? 'on' : ''}`} />Economic zones · {sez.inForce ? 'in force' : 'not in force'}</Ref></span>
        </Tip>
      )}
    </section>
  );
}

function RobotSpark({ data }: { data: number[] }) {
  const W = 160; const H = 40;
  const lo = Math.min(...data); const hi = Math.max(...data);
  const line = data.map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`).join(' ');
  return (
    <svg className="wt-rspark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill="#3bb3a0" opacity={0.16} />
      <polyline points={line} fill="none" stroke="#3bb3a0" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function techState(s: GameStateV2, t: WorldTechDef, levels: ReturnType<typeof measuredDomains>) {
  const st = s.world.techs[t.id];
  const disc = st.discoveredDay !== undefined;
  const block = disc ? undefined : techBlockerAtLevels(s, t, levels);
  const group: Group = disc && st.ramp >= 0.99 ? 'done' : block ? 'locked' : 'ramp';
  const needs = block ? (block.startsWith('needs') ? block : `needs ${block}`) : '';
  return { st, disc, block, group, needs };
}

function TechTile({ s, t, levels, selected, onPick }: { s: GameStateV2; t: WorldTechDef; levels: ReturnType<typeof measuredDomains>; selected: boolean; onPick: () => void }) {
  const { st, disc, block, group, needs } = techState(s, t, levels);
  const value = disc ? st.ramp : st.prog;
  const status = group === 'done' ? `in use since ${fmtDate(dateOf(s, st.discoveredDay!))}` : group === 'locked' ? `locked · ${needs}` : disc ? `ramping · ${pct(st.ramp)}` : `ramping · ${pct(st.prog)}`;
  return (
    <Tip as="div" content={() => <TipCard title={`${t.id} ${t.name}`} value={disc ? `found ${fmtDate(dateOf(s, st.discoveredDay!))}` : pct(st.prog)} rows={[
      { label: 'Gates', value: techGateLevels(s, t) || '—' },
      { label: 'Prereqs', value: t.prereqs.join(', ') || '—' }, { label: 'Blocker', value: block ?? 'none', tone: block ? 'neg' : 'pos' },
      { label: 'Ramp', value: pct(st.ramp) }, ...(t.risk ? [{ label: 'Risk', value: t.risk, tone: 'neg' as const }] : []),
      ...(st.playerProject ? [{ label: 'Your moonshot', value: pct(st.playerProject.computeShare) }] : []),
    ]} footer="Click to aim your moonshot at it." />}>
      <div className={`wtech wt-tile ${group} ${selected ? 'sel' : ''}`} data-tech={t.id} data-group={group} onClick={onPick}>
        <div className="wt-name ellip">{t.name}{st.playerProject && <span className="chip-mini">moonshot</span>}</div>
        <div className="wt-status ellip">{status}</div>
        <span className="wt-bar"><i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></span>
      </div>
    </Tip>
  );
}

export function WorldTech({ s, names }: { s: GameStateV2; names: (id: string) => string }) {
  const [tech, setTech] = useState('');
  const [share, setShare] = useState(0.03);
  const v = internalVersion(s);
  // RD-P04b: the tech gates read domain G (OOM); your measured levels convert through the one λ in the engine.
  const levels = v ? measuredDomains(v) : {};
  const groups: Record<Group, WorldTechDef[]> = { done: [], ramp: [], locked: [] };
  for (const t of WORLD_TECHS) if (s.world.techs[t.id]) groups[techState(s, t, levels).group].push(t);
  const label: Record<Group, string> = { done: 'in use', ramp: 'ramping', locked: 'locked' };
  return (
    <div className="wt" data-test="world-tech">
      <div className="wt-top"><ControlIndex s={s} names={names} /><Robots s={s} /></div>
      <section className="section wt-techs">
        <div className="section-head">
          <span className="section-title"><Term id="wtech">World technologies</Term></span>
          <span className="dim small">{(['done', 'ramp', 'locked'] as Group[]).map((g, i) => <span key={g}>{i > 0 && ' · '}{label[g]} {groups[g].length}</span>)}</span>
        </div>
        <div className="techtree wt-grid">
          {(['done', 'ramp', 'locked'] as Group[]).flatMap((g) => groups[g].map((t) => <TechTile key={t.id} s={s} t={t} levels={levels} selected={tech === t.id} onPick={() => setTech(t.id)} />))}
        </div>
        <div className="wt-moon">
          <Tip content={() => <TipCard title={<Term id="moonshot">Moonshot</Term>} value={pct(share)}>Of your compute, taken from serving.</TipCard>}><span><Term id="moonshot">Moonshot</Term> <b>{tech ? WORLD_TECHS.find((t) => t.id === tech)?.name : 'auto'}</b> · <span className="num">{pct(share)}</span> of compute <Limit id="moonshot.serving" tone={share >= 0.3 ? 'warn' : 'quiet'}>from serving · max 30%</Limit></span></Tip>
          <span className="sp" />
          <Slider value={share} min={0} max={0.3} step={0.01} onChange={setShare} width={160} />
          <ActBtn id="wfx.moonshot" params={{ ...(tech ? { tech } : {}), share }} reason />
        </div>
      </section>
    </div>
  );
}
