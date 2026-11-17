// World (§6.3, §3.11): sector heatmap (A vs F, binding) for US/CN/ROW; jobs; control index (stacked by lineage, tier
// hatching, leverage thresholds); tech tree; macro strip. Actions: sector product, transition fund, moonshot.
import { useState } from 'react';
import { REGIONS, SECTORS } from '../../../data/v2/sectors';
import { WORLD_TECHS } from '../../../data/v2/techs';
import {
  automationShare, CONTROL_DOMAINS, dateOf, dowYtd, firmAdoption, fmtDate, internalVersion, LEVERAGE_THRESHOLDS, leverageAll, measuredDomains,
  remoteWorkAutomation, techBlocker, unemploymentChange12m, youthExposedEmployment,
} from '../../../engine/v2';
import type { DomainId, GameStateV2 } from '../../../engine/v2';
import { ActBtn, Limit, fmtB, fmtNum, Gate, Meter, pct, Row, Section, Slider, Spark, Term, Tip, TipCard, Why } from '../ui';
import { PanelHead } from '../kit';
import { ICON } from '../icons';
import { seq } from '../theme';

const LAB_COLOR = (id: string) => (id === 'player' ? '#3a8ae0' : id.startsWith('player') ? '#2f6fb8' : id === 'china' ? '#c43c8c' : ['#d4732a', '#b5622a', '#e08a4c', '#a8581e'][id.charCodeAt(id.length - 1) % 4]);

export function World({ s }: { s: GameStateV2 }) {
  const [fund, setFund] = useState(s.player.policies.transitionFund + 5);
  const [tech, setTech] = useState('');
  const [share, setShare] = useState(0.03);
  const v = internalVersion(s);
  const levels = (v ? measuredDomains(v) : {}) as Record<DomainId, number>;
  const lev = leverageAll(s);
  const us = s.world.macro.US;
  const names = (id: string) => (id === 'player' ? s.player.name : id === 'china' ? 'China' : id === 'player:open' ? 'Your open weights' : s.rivals.find((r) => r.core.id === id)?.core.name ?? id);
  return (
    <div className="panel-v2" data-panel="world">
      <PanelHead icon={ICON.world} title="World" sub="automation spread, jobs, who controls what" />
      <div className="macro-strip" data-test="macro">
        <Tip content={() => <TipCard title="US GDP growth" value={pct(us.g, 1)} />}><span><Term id="gdpG">GDP growth</Term> <b className="num">{pct(us.g, 1)}</b></span></Tip>
        <Tip content={() => <TipCard title={<Term id="dow">Dow</Term>} value={fmtNum(s.world.dow)} rows={[{ label: 'Year to date', value: pct(dowYtd(s), 1) }]} />}><span><Term id="dow">Dow</Term> <b className="num">{fmtNum(s.world.dow)}</b> <span className={dowYtd(s) >= 0 ? 'tone-pos' : 'tone-neg'}>{pct(dowYtd(s), 1)} ytd</span></span></Tip>
        <Tip content={() => <TipCard title={<Term id="gini">Gini</Term>} value={us.gini.toFixed(2)}>US income inequality, 0 (equal) to 1.</TipCard>}><span><Term id="gini">Gini</Term> <b className="num">{us.gini.toFixed(2)}</b></span></Tip>
        <Tip content={() => <TipCard title={<Term id="aiOwnerShare">AI-owner share</Term>} value={pct(s.world.aiOwnerShare, 1)}>Share of income going to owners of AI and compute.</TipCard>}><span><Term id="aiOwnerShare">AI-owner share</Term> <b className="num">{pct(s.world.aiOwnerShare, 1)}</b></span></Tip>
        <Tip content={() => <TipCard title={<Term id="robots">Robots</Term>} value={`${fmtNum(s.world.robots.prodPerYear / 12)} a month`}>Robots built worldwide.</TipCard>}><span><Term id="robots">Robots</Term>/mo <b className="num">{fmtNum(s.world.robots.prodPerYear / 12)}</b></span></Tip>
        <Tip content={() => <TipCard title={<Term id="laborShare">Labour share</Term>} value={pct(us.laborShare)}>Share of US income paid as wages.</TipCard>}><span><Term id="laborShare">Labour share</Term> <b className="num">{pct(us.laborShare)}</b></span></Tip>
      </div>
      <div className="grid2">
        <Section title={<Term id="sector">Automation spread</Term>} right={<span className="dim small">cell = <Term id="sectorA">automated share A</Term> · hover for <Term id="friction">friction</Term> and <Term id="binding">binding</Term></span>}>
          <table className="tbl heat">
            <thead><tr><th>Sector</th>{REGIONS.map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              {SECTORS.map((sec) => (
                <tr key={sec.id}>
                  <td>{sec.name}</td>
                  {REGIONS.map((r) => {
                    const st = s.world.sectors[r][sec.id];
                    return (
                      <td key={r} style={{ background: seq(Math.sqrt(st.A / 0.6)) }}>
                        <Tip content={() => <TipCard title={`${sec.name} · ${r}`} rows={[{ label: 'Automated A', value: pct(st.A, 1) }, { label: 'Target A*', value: pct(st.Astar, 1) }, { label: 'Feasibility F (share AI can do)', value: pct(st.F) }, { label: 'Employment vs start', value: pct(st.E / Math.max(1, st.E0)) }, { label: 'Binding', value: st.binding }, { label: 'Your share (US)', value: pct(s.world.shares[sec.id]?.player ?? 0) }]} />}>
                          <span className="num small heat-v">{pct(st.A)}</span>
                        </Tip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <div>
          <Section title="Jobs">
            {REGIONS.map((r) => <Row key={r} label={`Unemployment ${r}`}><Meter value={s.world.unemployment[r]} max={25} width={90} color="var(--neg)" /><Why k={`world.unemployment.${r}`} title={`Unemployment ${r}`} fmt={(x) => `${x.toFixed(2)} pp`} invert><span className="num" data-home={`unemp.${r}`}>{s.world.unemployment[r].toFixed(1)}%</span></Why></Row>)}
            <Row label="US 12-month change"><Tip content={() => <TipCard title="US unemployment, 12-month change" value={`${unemploymentChange12m(s) >= 0 ? '+' : ''}${unemploymentChange12m(s).toFixed(2)} pp`}>Percentage points versus a year ago.</TipCard>}><span className="num">{unemploymentChange12m(s) >= 0 ? '+' : ''}{unemploymentChange12m(s).toFixed(2)} pp</span></Tip><Spark data={s.world.fx.uHist} w={60} h={16} color="var(--neg)" /></Row>
            <Row label={<Term id="youthUnemp">Youth unemployment · exposed jobs</Term>}><Tip content={() => <TipCard title={<Term id="youthUnemp">Youth unemployment</Term>} rows={[{ label: 'Youth unemployment', value: `${s.world.youthUnemployment.toFixed(1)}%` }, { label: 'Exposed jobs (vs start)', value: pct(youthExposedEmployment(s)) }]} />}><span className="num">{s.world.youthUnemployment.toFixed(1)}% · {pct(youthExposedEmployment(s))}</span></Tip></Row>
            <Row label={<Term id="displaced">Displaced (US)</Term>}><Tip content={() => <TipCard title={<Term id="displaced">Displaced workers (US)</Term>} value={fmtNum(s.world.displacedPool.US)}>People whose jobs AI took who have not found new work.</TipCard>}><span className="num">{fmtNum(s.world.displacedPool.US)}</span></Tip></Row>
            <Row label={<span><Term id="remoteWork">Remote work automated</Term> · <Term id="firmAdoption">firm adoption</Term></span>}><Tip content={() => <TipCard title="Automation" rows={[{ label: 'Remote work automated', value: pct(remoteWorkAutomation(s)) }, { label: 'Firms using AI agents', value: pct(firmAdoption(s)) }]} />}><span className="num">{pct(remoteWorkAutomation(s))} · {pct(firmAdoption(s))}</span></Tip></Row>
            <Row label="Automation share US"><Tip content={() => <TipCard title="Automation share US" value={pct(automationShare(s, 'US'), 1)}>Share of US work done by AI.</TipCard>}><span className="num">{pct(automationShare(s, 'US'), 1)}</span></Tip></Row>
            <Row label={<Tip content={() => <TipCard title={<Term id="transitionFund">Transition fund</Term>} value={`${fmtB(fund)}/yr`}>Drag, then Set: paid every year from your cash.</TipCard>}><span><Term id="transitionFund">Transition fund</Term> {fmtB(fund)}/yr</span></Tip>}><Slider value={fund} min={0} max={100} step={1} onChange={setFund} /><ActBtn id="wfx.transitionFund" params={{ amount: fund }} label="Set" /></Row>
          </Section>
          <Section title={<Term id="leverage">Control index</Term>} right={<Tip content={() => <TipCard title={<Term id="leverage">Your control</Term>} value={pct(lev.player ?? 0, 1)} rows={Object.keys(lev).map((k) => ({ label: names(k), value: pct(lev[k], 1) }))} />}><span className="small">you {pct(lev.player ?? 0, 1)}</span></Tip>}>
            <Gate s={s} k="world">
              {CONTROL_DOMAINS.map((d) => {
                const c = s.world.control[d];
                const ent = Object.entries(c.shares).filter(([, x]) => x > 0.001).sort((a, b) => b[1] - a[1]);
                return (
                  <Tip as="div" key={d} content={() => <TipCard title={`${d} · P ${pct(c.P)}`} rows={[...ent.map(([k, x]) => ({ label: names(k), value: pct(x, 1) })), { label: <Term id="tiers">Tiers tool / advisor / on-loop / out-of-loop</Term>, value: c.tiers.map((t) => pct(t)).join(' / ') }, { label: 'Acceptance', value: pct(c.accept) }, { label: 'Tier cap', value: c.tierCap }]} />}>
                    <div className="ctrl-row">
                      <span className="small ctrl-lbl">{d}</span>
                      <div className="ctrl-bar">
                        <div className="ctrl-fill" style={{ width: `${c.P * 100}%` }}>
                          {ent.map(([k, x]) => <div key={k} className={`ctrl-seg tier-${c.tierCap}`} style={{ width: `${x * 100}%`, background: LAB_COLOR(k) }} />)}
                        </div>
                        {Object.entries(LEVERAGE_THRESHOLDS).map(([n, t]) => <div key={n} className="ctrl-thr" style={{ left: `${t * 100}%` }} title={n}><span className="ctrl-thr-l">{n}</span></div>)}
                      </div>
                      <span className="num small">{pct(c.P)}</span>
                    </div>
                  </Tip>
                );
              })}
              <div className="legend small">{Object.keys(lev).map((k) => <Tip key={k} content={() => <TipCard title={names(k)} value={pct(lev[k], 1)}>Share of the control index across all domains.</TipCard>}><span><i style={{ background: LAB_COLOR(k) }} />{names(k)} {pct(lev[k], 1)}</span></Tip>)}</div>
            </Gate>
          </Section>
        </div>
      </div>
      <Section title={<Term id="wtech">World technologies</Term>} right={<span className="dim small">discovered · ramping · locked</span>}>
        <div className="techtree">
          {WORLD_TECHS.map((t) => {
            const st = s.world.techs[t.id];
            if (!st) return null;
            const disc = st.discoveredDay !== undefined;
            const block = disc ? undefined : techBlocker(s, t, levels);
            const cls = disc ? (st.ramp >= 0.99 ? 'done' : 'ramp') : block ? 'locked' : 'avail';
            return (
              <Tip as="div" key={t.id} content={() => <TipCard title={`${t.id} ${t.name}`} value={disc ? `found ${fmtDate(dateOf(s, st.discoveredDay!))}` : pct(st.prog)} rows={[
                { label: 'Gates', value: Object.entries(t.gates).map(([d, x]) => `${d} ${x}`).join(', ') || '—' },
                { label: 'Prereqs', value: t.prereqs.join(', ') || '—' }, { label: 'Blocker', value: block ?? 'none', tone: block ? 'neg' : 'pos' },
                { label: 'Ramp', value: pct(st.ramp) }, ...(t.risk ? [{ label: 'Risk', value: t.risk, tone: 'neg' as const }] : []),
                ...(st.playerProject ? [{ label: 'Your moonshot', value: pct(st.playerProject.computeShare) }] : []),
              ]} />}>
                <div className={`wtech ${cls}`} data-tech={t.id} onClick={() => setTech(t.id)}>
                  <span className="small ellip">{t.name}</span>
                  {disc ? <Meter value={st.ramp} max={1} width={40} color="var(--pos)" /> : <Meter value={st.prog} max={1} width={40} />}
                  {st.playerProject && <span className="chip-mini">moonshot</span>}
                </div>
              </Tip>
            );
          })}
        </div>
        <Row label={<span><Term id="moonshot">Moonshot</Term> {tech || 'auto'} · <Tip content={() => <TipCard title={<Term id="moonshot">Moonshot share</Term>} value={pct(share)}>Of your compute, taken from serving.</TipCard>}><span>{pct(share)}</span></Tip> of compute <Limit id="moonshot.serving" tone={share >= 0.3 ? 'warn' : 'quiet'}>from serving · max 30%</Limit></span>}><Slider value={share} min={0} max={0.3} step={0.01} onChange={setShare} /><ActBtn id="wfx.moonshot" params={{ ...(tech ? { tech } : {}), share }} reason /></Row>
      </Section>
    </div>
  );
}
