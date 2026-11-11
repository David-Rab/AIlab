import { Brain, Building2, Flag, Landmark, Play, RotateCcw, Shuffle, Upload, Users } from 'lucide-react';
import { useState } from 'react';
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../data/actors';
import { ALIGN_PRESETS, BASELINES, WORLD_PRESETS } from '../data/world';
import { defaultSetup } from '../engine/init';
import type { Setup } from '../engine/types';
import { Soon } from './components';
import { store, useStore } from './store';
import { Tip, TipCard } from './Tooltip';

const CAMPAIGNS = [
  { id: 'ceo', name: 'Lab CEO', icon: Building2, desc: 'Run OpenBrain. Race, align, survive.', ready: true },
  { id: 'president', name: 'President', icon: Landmark, desc: 'Steer the US through the intelligence explosion.', ready: false },
  { id: 'china', name: 'General Secretary', icon: Flag, desc: 'Lead China\'s AI effort from behind.', ready: false },
  { id: 'ai', name: 'The Model', icon: Brain, desc: 'You are Agent-4. Stay undetected.', ready: false },
  { id: 'safety', name: 'Safety Lead', icon: Users, desc: 'Find the truth before it is too late.', ready: false },
];

export function StartScreen() {
  const st = useStore();
  return (
    <div className="menu">
      <div className="menu-hero">
        <div className="menu-kicker">Based on AI 2027 · ai-2027.com</div>
        <h1 className="menu-title">AI 2027</h1>
        <div className="menu-sub">The intelligence explosion, one day at a time.</div>
      </div>
      <div className="menu-actions">
        {st.hasSave() && (
          <button className="btn btn-primary" onClick={() => st.load()}>
            <RotateCcw size={15} /> Continue
          </button>
        )}
        <button className={`btn ${st.hasSave() ? '' : 'btn-primary'}`} onClick={() => st.go('setup')}>
          <Play size={15} /> New game
        </button>
        <ImportButton />
      </div>
      <div className="menu-campaigns">
        {CAMPAIGNS.map((c) => (
          <div key={c.id} className={`campaign ${c.ready ? '' : 'locked'}`} onClick={() => c.ready && st.go('setup')}>
            <c.icon size={22} />
            <div className="campaign-name">{c.name}</div>
            <div className="campaign-desc">{c.desc}</div>
            {!c.ready && <Soon />}
          </div>
        ))}
      </div>
      <div className="menu-foot dim">
        Fan-made strategy game. Scenario, forecasts and models by the AI Futures Project (Kokotajlo, Alexander, Larsen, Lifland, Dean). Research notes in /research.
      </div>
    </div>
  );
}

function ImportButton() {
  return (
    <label className="btn">
      <Upload size={15} /> Import save
      <input
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          localStorage.setItem('ai27.save.v1', await f.text());
          store.load();
        }}
      />
    </label>
  );
}

type PickerOpt = { id: string; name: string; desc: string; weight?: number; disabled?: boolean };

function Picker({ label, value, options, onChange, realistic }: { label: string; value: string; options: PickerOpt[]; onChange: (id: string) => void; realistic?: boolean }) {
  const total = options.reduce((s, o) => s + (o.weight ?? 0), 0);
  const all: PickerOpt[] = realistic ? [{ id: 'realistic', name: 'Realistic', desc: 'Random, weighted by evidence. Hidden until revealed in play.' }, ...options] : options;
  return (
    <div className="picker">
      <div className="picker-label">{label}</div>
      <div className="picker-opts">
        {all.map((o) => (
          <Tip
            key={o.id}
            content={() => (
              <TipCard title={o.name} value={o.weight ? `${Math.round((o.weight / total) * 100)}%` : undefined}>
                {o.desc}
                {o.weight ? <p className="dim">Realistic draw weight.</p> : null}
              </TipCard>
            )}
          >
            <button className={`chip ${value === o.id ? 'active' : ''}`} disabled={o.disabled} onClick={() => onChange(o.id)}>
              {o.id === 'realistic' && <Shuffle size={12} />} {o.name}
            </button>
          </Tip>
        ))}
      </div>
    </div>
  );
}

export function SetupScreen() {
  const [s, set] = useState<Setup>(defaultSetup());
  const up = (p: Partial<Setup>) => set({ ...s, ...p });
  return (
    <div className="menu setup">
      <h2 className="setup-title">New game · Lab CEO</h2>
      <div className="setup-grid">
        <div className="setup-col">
          <Picker label="Baseline" value={s.baseline} options={BASELINES.map((b) => ({ id: b.id, name: b.name, desc: b.desc }))} onChange={(id) => up({ baseline: id as Setup['baseline'] })} />
          <div className="setup-note dim">Reality-Updated, starting Nov 2026 with history applied: <Soon label="to come" /></div>
          <Picker label="World" value={s.world} options={WORLD_PRESETS.map((w) => ({ id: w.id, name: w.name, desc: w.desc }))} onChange={(id) => up({ world: id as Setup['world'] })} />
          <Picker label="Alignment difficulty" value={s.alignment} options={ALIGN_PRESETS.map((a) => ({ id: a.id, name: a.name, desc: a.desc }))} onChange={(id) => up({ alignment: id as Setup['alignment'] })} />
          <div className="picker">
            <div className="picker-label">Company</div>
            <input className="text-input" value={s.companyName} onChange={(e) => up({ companyName: e.target.value || 'OpenBrain' })} />
            <div className="picker-label" style={{ marginTop: 10 }}>Seed</div>
            <input className="text-input num" value={s.seed} onChange={(e) => up({ seed: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="setup-col">
          <Picker label="US Government" realistic value={s.gov} options={GOV_PRESETS} onChange={(id) => up({ gov: id })} />
          <Picker label="US Public" realistic value={s.public} options={PUBLIC_PRESETS} onChange={(id) => up({ public: id })} />
          <Picker label="China" realistic value={s.china} options={CHINA_PRESETS} onChange={(id) => up({ china: id })} />
          <Picker label="US Rivals" realistic value={s.rivals} options={LAB_ARCHETYPES} onChange={(id) => up({ rivals: id })} />
          <div className="setup-note dim">Allies (EU, UK, Taiwan, Gulf) and interest groups: <Soon label="to come" /></div>
        </div>
      </div>
      <div className="setup-actions">
        <button className="btn btn-ghost" onClick={() => store.go('start')}>Back</button>
        <button className="btn btn-primary" onClick={() => store.start(s)}>
          <Play size={15} /> Start · Jul 2025
        </button>
      </div>
    </div>
  );
}
