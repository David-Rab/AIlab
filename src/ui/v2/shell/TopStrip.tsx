// Top strip (§6.2): speed, date, cash·runway, compute, race bars L vs U, leads, scrutiny, M, menu.
import { useState } from 'react';
import { Cpu, DollarSign, Eye, Menu, Swords, Zap } from 'lucide-react';
import {
  activeRivals, dateOf, engine, fmtDate, idleChips, leadDays, measuredL, ownedOnline, poolsOf, raiseCeiling, rentedOnline, runwayOf, SLOT_KEYS,
  SPLIT_KEYS,
} from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import { store } from '../store';
import { ACT_NAMES, fmtB, fmtMult, fmtNum, pct, Term, Tip, TipCard, Why } from '../ui';
import { SpeedControl } from './SpeedControl';

const STATE_TONE: Record<string, string> = { healthy: 'tone-pos', tight: 'tone-warn', distress: 'tone-neg', insolvent: 'tone-neg' };

export function bestRivalLead(s: GameStateV2) {
  const rs = activeRivals(s).map((r) => ({ r, ...leadDays(s, r.core.id) }));
  rs.sort((a, b) => a.est - b.est);
  return rs[0];
}

export function TopStrip({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const rw = runwayOf(s);
  const L = measuredL(s);
  const u = engine.understanding(s);
  const prod = engine.production(s, 'player');
  const best = bestRivalLead(s);
  const cn = leadDays(s, 'china');
  const pools = poolsOf(s);
  return (
    <div className="topstrip">
      <SpeedControl s={s} />
      <Tip content={() => <TipCard title="Date" value={`day ${s.time.day}`}>Act {s.tutorial.act} · {ACT_NAMES[s.tutorial.act]}</TipCard>}>
        <div className="ts-date num" data-test="date">{fmtDate(dateOf(s))}</div>
      </Tip>
      <span className="act-chip">A{s.tutorial.act}</span>
      <Why
        k="cash" title="Cash · runway" value={fmtB(f.cash)} fmt={(x) => fmtB(x)}
        body={<span><Term id="runway">Runway</Term> <b>{rw.q >= 99 ? '∞' : rw.q.toFixed(1)}q</b> · <span className={STATE_TONE[f.state]}>{f.state}</span></span>}
        rows={[
          { label: 'Liquidity', value: fmtB(rw.liquidity) },
          ...Object.entries(rw.parts).map(([k, v]) => ({ label: `Burn/q · ${k}`, value: fmtB(v), tone: (v > 0 ? 'neg' : 'pos') as 'neg' | 'pos' })),
          { label: 'Net burn / q', value: fmtB(rw.burnQ) },
          { label: `Raise ceiling (${raiseCeiling(s).bound})`, value: fmtB(raiseCeiling(s).max) },
        ]}
      >
        <div className="ts-item" data-test="cash">
          <DollarSign size={13} className="dim" />
          <span className={`num ${STATE_TONE[f.state]}`}>{fmtB(f.cash)}</span>
          <span className="dim num">· {rw.q >= 99 ? '∞' : `${rw.q.toFixed(rw.q < 10 ? 1 : 0)}q`}</span>
        </div>
      </Why>
      <Tip content={() => (
        <TipCard title="Compute online" value={fmtNum(s.player.computeOnline)} rows={[
          { label: 'Owned', value: fmtNum(ownedOnline(s)) }, { label: 'Rented', value: fmtNum(rentedOnline(s)) },
          ...SPLIT_KEYS.map((k) => ({ label: `Pool · ${k}`, value: fmtNum(pools[k]) })),
          { label: 'Idle chips (no power)', value: fmtNum(idleChips(s)), tone: idleChips(s) > 0 ? 'neg' : 'neutral' },
        ]}>[[h100e|H100e]] online across your sites and cloud.</TipCard>
      )}>
        <div className="ts-item" data-test="compute"><Zap size={13} className="dim" /><span className="num">{fmtNum(s.player.computeOnline)}</span></div>
      </Tip>
      <Tip content={() => (
        <TipCard title="Race: capability vs understanding" value={`margin ${u.margin >= 0 ? '+' : ''}${u.margin.toFixed(1)}`} rows={[
          { label: 'L measured (internal agent)', value: L.toFixed(2) },
          { label: 'U (detect critical traits ≥ 50%)', value: u.U.toFixed(2) },
          ...Object.entries(u.perTrait).map(([t, p]) => ({ label: `Detect ${TRAIT_BY_ID[t as keyof typeof TRAIT_BY_ID]?.name ?? t} at L`, value: pct(p ?? 0), tone: ((p ?? 0) >= 0.5 ? 'pos' : 'neg') as 'pos' | 'neg' })),
        ]} footer="U falls as techniques decay with capability, when you train against detectors, or when latent reasoning cuts monitorability.">
          See [[L]] and [[U]].
        </TipCard>
      )}>
        <div className="ts-race" data-test="race">
          <span className="race-lbl">L</span><span className="num race-num">{L.toFixed(1)}</span>
          <div className="race-bars">
            <div className="race-bar"><div className="race-fill L" style={{ width: `${(L / 15) * 100}%` }} /></div>
            <div className="race-bar"><div className="race-fill U" style={{ width: `${(u.U / 15) * 100}%` }} /></div>
          </div>
          <span className="race-lbl">U</span><span className="num race-num">{u.U.toFixed(1)}</span>
          <span className={`num small ${u.margin >= 0 ? 'tone-pos' : u.margin > -1.5 ? 'tone-warn' : 'tone-neg'}`}>{u.margin >= 0 ? '+' : '−'}{Math.abs(u.margin).toFixed(1)}</span>
        </div>
      </Tip>
      <Tip content={() => (
        <TipCard title="Lead (estimates)" rows={[
          ...activeRivals(s).map((r) => { const l = leadDays(s, r.core.id); return { label: r.core.name, value: `${l.est >= 0 ? '+' : ''}${l.est}d ± ${l.sd}`, tone: (l.est >= 0 ? 'pos' : 'neg') as 'pos' | 'neg' }; }),
          { label: 'China', value: `${cn.est >= 0 ? '+' : ''}${cn.est}d ± ${cn.sd}`, tone: cn.est >= 0 ? 'pos' : 'neg' },
        ]}>Your best internal model vs theirs. See [[lead]].</TipCard>
      )}>
        <div className="ts-item" data-test="lead">
          <Swords size={13} className="dim" />
          <span className={`num ${best && best.est < 0 ? 'tone-neg' : ''}`}>{best ? `${best.est >= 0 ? '+' : ''}${best.est}d` : '—'}</span>
          <span className="dim">· CN</span>
          <span className={`num ${cn.est < 0 ? 'tone-neg' : ''}`}>{cn.est >= 0 ? '+' : ''}{cn.est}d</span>
        </div>
      </Tip>
      <Why k="relations.scrutiny" title="Scrutiny" value={s.relations.scrutiny.toFixed(0)} body="See [[scrutiny]].">
        <div className="ts-item" data-test="scrutiny"><Eye size={13} className="dim" /><span className="num">{s.relations.scrutiny.toFixed(0)}</span></div>
      </Why>
      <Tip content={() => (
        <TipCard title="R&D multiplier M" value={fmtMult(prod.M)} rows={[
          { label: 'Base', value: fmtMult(prod.parts.base) }, { label: 'Agents', value: fmtMult(prod.parts.agents) },
          { label: 'Taste', value: fmtMult(prod.parts.taste) }, { label: 'Other', value: fmtMult(prod.parts.other) },
          { label: 'Progress rate', value: `${prod.rate.toFixed(2)} y/y` }, { label: 'Binding', value: prod.label },
        ]}>See [[rdmult]].</TipCard>
      )}>
        <div className="ts-item" data-test="M"><Cpu size={13} className="dim" /><span className="num">M {fmtMult(prod.M)}</span></div>
      </Tip>
      <div className="ts-spacer" />
      <GameMenu />
    </div>
  );
}

function GameMenu() {
  const [open, setOpen] = useState(false);
  const st = store;
  const close = () => setOpen(false);
  return (
    <div className="ff-wrap">
      <button className="btn btn-sm btn-icon" data-test="menu" onClick={() => setOpen((o) => !o)}><Menu size={14} /></button>
      {open && (
        <div className="ff-menu right" data-test="menu-list">
          {SLOT_KEYS.map((k, i) => (
            <div className="ff-item ff-date" key={k}>
              <span className="small">Slot {i + 1} <span className="dim">{st.saveInfo(k) ?? 'empty'}</span></span>
              <button className="btn btn-sm" data-save={i + 1} onClick={() => { st.save(k); close(); }}>Save</button>
              <button className="btn btn-sm" data-load={i + 1} disabled={!st.hasSave(k)} onClick={() => { st.load(k); close(); }}>Load</button>
            </div>
          ))}
          <button className="ff-item" data-test="export" onClick={() => { st.download(`ai27-v2-day${st.state?.time.day ?? 0}.json`, st.exportJson()); close(); }}>Export save</button>
          <label className="ff-item">Import save
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) st.importJson(await f.text()); close(); }} />
          </label>
          <div className="ff-sep" />
          <div className="ff-item small dim">Auto-pause (speeds 1–4)</div>
          {([['pauseOnDecision', 'Decision'], ['pauseOnMilestone', 'Milestone'], ['pauseOnIncident', 'Incident / alert ≥ 3']] as const).map(([k, l]) => (
            <label className="ff-item" key={k}>
              <input type="checkbox" data-pref={k} checked={st.prefs[k]} onChange={(e) => st.setPrefs({ [k]: e.target.checked })} /> {l}
            </label>
          ))}
          <div className="ff-sep" />
          <button className="ff-item" data-test="quit" onClick={() => { st.save(); st.go('start'); close(); }}>Save & quit</button>
        </div>
      )}
    </div>
  );
}
