// Start and setup screens (§6.9, §6.10). "AI 2027 scenario" is the only pre-game use of the name.
import { useRef } from 'react';
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../../../data/actors';
import { AUTOSAVE_KEY, SLOT_KEYS, V1_SAVE_KEY } from '../../../engine/v2';
import type { SetupV2 } from '../../../engine/v2';
import { CHINA_LAB_NAME, RIVAL_NAMES_V2 } from '../../../data/v2/names';

/** AUDIT §2.4: the company may not take a rival's name (two "Meridian" nodes, rows and end lines). */
export function nameClash(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return 'Name your company';
  const hit = [...RIVAL_NAMES_V2, CHINA_LAB_NAME].find((x) => x.toLowerCase() === n);
  return hit ? `${hit} is a rival lab: pick another name` : undefined;
}
import { useV2 } from '../store';
import { Soon, Tip, TipCard } from '../ui';

const CAMPAIGNS = [
  { id: 'ceo', name: 'Frontier lab CEO', desc: 'Run a frontier lab from July 2025 to superintelligence.', active: true },
  { id: 'gov', name: 'Government', desc: 'Steer the US response.', active: false },
  { id: 'china', name: 'China', desc: 'Lead the national AI effort.', active: false },
  { id: 'ai', name: 'Play as the AI', desc: 'You are the model.', active: false },
];

export function StartScreen() {
  const st = useV2();
  const file = useRef<HTMLInputElement>(null);
  let v1 = false;
  try {
    v1 = !!localStorage.getItem(V1_SAVE_KEY);
  } catch {
    /* ignore */
  }
  return (
    <div className="menu" data-test="start">
      <div>
        <div className="menu-kicker">AI27 · v2</div>
        <h1 className="menu-title">AI27</h1>
        <div className="menu-sub">Run a frontier AI lab. Race capability against understanding.</div>
      </div>
      <div className="menu-campaigns">
        {CAMPAIGNS.map((c) => (
          <div key={c.id} className={`campaign ${c.active ? '' : 'locked'}`} data-campaign={c.id} onClick={() => c.active && st.go('setup')}>
            <div className="campaign-name">{c.name}</div>
            <div className="campaign-desc">{c.desc}</div>
            {!c.active && <Soon label="to come" />}
          </div>
        ))}
      </div>
      <div className="menu-actions">
        <button className="btn btn-primary" data-test="new-game" onClick={() => st.go('setup')}>New game</button>
        <button className="btn" data-test="continue" disabled={!st.hasSave(AUTOSAVE_KEY)} onClick={() => st.load(AUTOSAVE_KEY)}>Continue {st.saveInfo(AUTOSAVE_KEY) ? <span className="dim small">{st.saveInfo(AUTOSAVE_KEY)}</span> : null}</button>
        {SLOT_KEYS.map((k, i) => <button key={k} className="btn" disabled={!st.hasSave(k)} onClick={() => st.load(k)}>Slot {i + 1}</button>)}
        <button className="btn" onClick={() => file.current?.click()}>Import</button>
        <input ref={file} type="file" accept=".json,application/json" style={{ display: 'none' }} data-test="import" onChange={async (e) => { const f = e.target.files?.[0]; if (f) st.importJson(await f.text()); }} />
      </div>
      {v1 && <div className="small tone-warn">v1 save found: v2 cannot load it. Start a new game.</div>}
      <div className="menu-foot dim">
        To come: <Soon label="multiplayer" /> <Soon label="scenario editor" /> <Soon label="allies detail (EU/UK/Gulf)" /> <Soon label="start in Nov 2026" />
      </div>
    </div>
  );
}

type Opt<T> = { v: T; label: string; desc?: string };
function Picker<K extends keyof SetupV2>({ label, k, opts }: { label: string; k: K; opts: Opt<SetupV2[K]>[] }) {
  const st = useV2();
  const cur = st.draftSetup[k];
  return (
    <div data-picker={k}>
      <div className="picker-label">{label}</div>
      <div className="picker-opts">
        {opts.map((o) => {
          const chip = (
            <button className={`chip ${cur === o.v ? 'active' : ''}`} data-opt={String(o.v)} onClick={() => { st.draftSetup = { ...st.draftSetup, [k]: o.v }; st.notify(); }}>
              {o.label}
            </button>
          );
          return o.desc ? <Tip key={String(o.v)} content={() => <TipCard title={o.label}>{o.desc!}</TipCard>}>{chip}</Tip> : <span key={String(o.v)}>{chip}</span>;
        })}
      </div>
    </div>
  );
}

const presetOpts = (xs: { id: string; name: string; desc: string }[]): Opt<string>[] => [{ v: 'realistic', label: 'Realistic', desc: 'Drawn from research-weighted odds.' }, ...xs.map((x) => ({ v: x.id, label: x.name, desc: x.desc.replace(/[^.]*AI 2027[^.]*\.\s*/g, '').trim() }))]; // canon names only in the World picker (§6.9)

export function SetupScreen() {
  const st = useV2();
  const d = st.draftSetup;
  const set = (p: Partial<SetupV2>) => {
    st.draftSetup = { ...st.draftSetup, ...p };
    st.notify();
  };
  return (
    <div className="menu" data-test="setup">
      <h2 className="setup-title">New game · Frontier lab CEO</h2>
      <div className="setup-grid">
        <div className="setup-col">
          <Picker label="Baseline" k="baseline" opts={[{ v: 'classic', label: 'Classic', desc: 'Start state of the April 2025 scenario world.' }, { v: 'reality', label: 'Reality', desc: 'Start state from 2025–26 reporting.' }]} />
          <Picker label="World" k="world" opts={[
            { v: 'ai2027', label: 'AI 2027 scenario', desc: 'Fast timelines calibrated to the published scenario.' },
            { v: 'authors2026', label: "Authors' 2026", desc: 'The authors’ later, slower model.' },
            { v: 'fast', label: 'Fast', desc: 'Short timelines, fast takeoff.' },
            { v: 'slow', label: 'Skeptic', desc: 'Slow progress and little AI speed-up.' },
            { v: 'sampled', label: 'Unknown', desc: 'Parameters drawn at random; revealed at the end.' },
          ]} />
          <Picker label="Alignment difficulty" k="alignment" opts={[{ v: 'sampled', label: 'Unknown' }, { v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }]} />
          <Picker label="Economy" k="econ" opts={[{ v: 'sampled', label: 'Unknown' }, { v: 'normal', label: 'Normal', desc: 'Standard diffusion frictions.' }, { v: 'ai2027', label: 'Fast diffusion', desc: 'Rapid adoption and displacement.' }, { v: 'gate', label: 'Gated', desc: 'Strong frictions: law, trust, integration.' }]} />
          <Picker label="Governance" k="governance" opts={[
            { v: 'legacyNonprofit', label: 'Legacy nonprofit', desc: 'Mission board; recapitalisation needed to raise at scale.' },
            { v: 'nonprofitPBC', label: 'Nonprofit + PBC' }, { v: 'pbcTrust', label: 'PBC + trust' }, { v: 'founder', label: 'Founder control' },
          ]} />
          <Picker label="Storyteller" k="storyteller" opts={[{ v: 'rising', label: 'Rising', desc: 'Tension builds with each act.' }, { v: 'measured', label: 'Measured' }, { v: 'chaotic', label: 'Chaotic' }]} />
        </div>
        <div className="setup-col">
          <Picker label="Government" k="gov" opts={presetOpts(GOV_PRESETS)} />
          <Picker label="Public" k="public" opts={presetOpts(PUBLIC_PRESETS)} />
          <Picker label="China" k="china" opts={presetOpts(CHINA_PRESETS)} />
          <Picker label="Rivals" k="rivals" opts={presetOpts(LAB_ARCHETYPES)} />
          <Picker label="Rival labs" k="rivalCount" opts={[{ v: 3, label: '3' }, { v: 4, label: '4' }]} />
          <Picker label="Tutorial (panels unlock by act)" k="tutorial" opts={[{ v: true, label: 'On' }, { v: false, label: 'Off: everything unlocked' }]} />
          <div>
            <div className="picker-label">Company · seed</div>
            <div className="picker-opts">
              <input className={`text-input ${nameClash(d.companyName) ? 'bad-input' : ''}`} data-test="company" value={d.companyName} onChange={(e) => set({ companyName: e.target.value })} />
              {nameClash(d.companyName) && <span className="small tone-neg" data-test="name-clash">{nameClash(d.companyName)}</span>}
              <input className="text-input" data-test="seed" style={{ width: 130 }} value={d.seed} onChange={(e) => set({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
              <button className="btn btn-sm" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>Random</button>
            </div>
          </div>
          <div className="small">Start: Jul 2025 <Soon label="Nov 2026 start: to come" /></div>
        </div>
      </div>
      <div className="setup-actions">
        <button className="btn" onClick={() => st.go('start')}>Back</button>
        <button className="btn btn-primary" data-test="start-game" disabled={!!nameClash(d.companyName)} title={nameClash(d.companyName)} onClick={() => st.start(st.draftSetup)}>Start</button>
      </div>
    </div>
  );
}
