// Start and setup screens (§6.9, §6.10). "AI 2027 scenario" is the only pre-game use of the name.
import { useRef } from 'react';
import { AUTOSAVE_KEY, SLOT_KEYS, V1_SAVE_KEY } from '../../../engine/v2';
import type { SetupV2 } from '../../../engine/v2';
import { REALISTIC_CAST } from '../../../data/v2/npcLabs';
import { START_BY_ID, START_ORDER, parentBudgetYear, type Difficulty, type StartDef } from '../../../data/v2/starts';
import { TEAM_SIZE } from '../../../data/v2/teams';
import type { StartType } from '../../../engine/v2';

/** AUDIT §2.4: the company may not take a rival's name (two "Meridian" nodes, rows and end lines): the cast's names. */
const CAST_NAMES = REALISTIC_CAST.map((e) => e.name);
const LEADER_NAME = REALISTIC_CAST.find((e) => e.kind === 'leader')!.name;
export function nameClash(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return 'Name your company';
  const hit = CAST_NAMES.find((x) => x.toLowerCase() === n);
  return hit ? `${hit} is a rival lab: pick another name` : undefined;
}
import { useV2 } from '../store';
import { Soon, Tip, TipCard } from '../ui';
import { RivalsSection } from './Rivals';

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

const DIFF_TONE: Record<Difficulty, string> = { Easy: 'good', Medium: 'warn', Hard: 'bad', Impossible: 'bad' };
const BOARD_LABEL: Record<string, string> = { founder: 'Founder-controlled', parent: 'Parent company', legacyNonprofit: 'Capped-profit nonprofit' };
const kH = (h: number) => (h >= 1e6 ? `${(h / 1e6).toFixed(1)}M` : `${Math.round(h / 1e3)}K`);
const staffOfStart = (d: StartDef) => d.teams.eng * TEAM_SIZE.eng + (d.teams['re.cap'] + d.teams['re.saf']) * TEAM_SIZE.re + (d.teams['sci.cap'] + d.teams['sci.saf']) * TEAM_SIZE.sci;

/** Start type picker (R9): name, difficulty label, one line of character; the start values in the tooltip. */
function StartPicker() {
  const st = useV2();
  const cur = st.draftSetup.start ?? 'leader';
  const pick = (id: StartType) => {
    const d = START_BY_ID[id];
    // The board is the start's own unless you lead (then Governance picks it).
    st.draftSetup = { ...st.draftSetup, start: id, ...(id === 'leader' ? {} : { governance: d.board }) };
    st.notify();
  };
  return (
    <div data-picker="start">
      <div className="picker-label">Start as</div>
      <div className="start-opts">
        {START_ORDER.map((id) => {
          const d = START_BY_ID[id];
          const money = d.board === 'parent' ? `$${d.cash}B + $${parentBudgetYear(0)}B/yr from the parent` : id === 'leader' ? '$40B (cash + committed round)' : `$${d.cash}B`;
          return (
            <Tip key={id} content={() => (
              <TipCard title={`${d.name} · ${d.difficulty}`}>
                {`${d.character} Like ${d.analogues}. Cash ${money}; staff ${staffOfStart(d).toLocaleString('en-US')}; compute ${kH(d.owned)} owned / ${kH(d.rented)} rented H100e; model ${d.lagMonths ? `${d.lagMonths} months behind the leader${d.imported ? ' (an imported open-weight model)' : ''}` : 'at the frontier'}; board ${BOARD_LABEL[d.board] ?? d.board}.${d.leaderLab ? ` The frontier leader (${LEADER_NAME}) races you.` : ''} Scoring is the same for every start.`}
              </TipCard>
            )}>
              <button className={`start-opt ${cur === id ? 'active' : ''}`} data-opt={id} onClick={() => pick(id)}>
                <span className="start-opt-head"><b>{d.name}</b><span className={`tag2 ${DIFF_TONE[d.difficulty]}`} data-difficulty={d.difficulty}>{d.difficulty}</span></span>
                <span className="start-opt-desc">{d.character}</span>
              </button>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}


export function SetupScreen() {
  const st = useV2();
  const d = st.draftSetup;
  const set = (p: Partial<SetupV2>) => {
    st.draftSetup = { ...st.draftSetup, ...p };
    st.notify();
  };
  return (
    <div className="menu" data-test="setup">
      <h2 className="setup-title">New game · AI lab CEO</h2>
      <StartPicker />
      <div className="setup-grid">
        <div className="setup-col">
          <Picker label="Timeline" k="world" opts={[
            { v: 'tl-fast', label: 'Fast', desc: 'AI progress on the forecast’s fast track: superhuman AI coders around 2028.' },
            { v: 'tl-central', label: 'Central', desc: 'The forecast’s middle path: superhuman AI coders around 2030.' },
            { v: 'tl-slow', label: 'Slow', desc: 'The forecast’s slow track: superhuman AI coders around 2035.' },
          ]} />
          <Picker label="Alignment difficulty" k="alignment" opts={[{ v: 'sampled', label: 'Unknown' }, { v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }]} />
          {(d.start ?? 'leader') === 'leader' ? (
            <Picker label="Governance" k="governance" opts={[
              { v: 'legacyNonprofit', label: 'Legacy nonprofit', desc: 'Mission board; recapitalisation needed to raise at scale.' },
              { v: 'nonprofitPBC', label: 'Nonprofit + PBC' }, { v: 'pbcTrust', label: 'PBC + trust' }, { v: 'founder', label: 'Founder control' },
            ]} />
          ) : (
            <div data-test="start-board"><div className="picker-label">Governance</div><div className="small dim">{BOARD_LABEL[START_BY_ID[d.start].board]} (set by the start)</div></div>
          )}
        </div>
        <div className="setup-col">
          <RivalsSection />
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
