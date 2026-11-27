// Setup: the Rivals section (design/npc/NPC-LABS.md §10). Realistic (default): the July 2025 cast, one line each.
// Create rivals (advanced): how many US labs (0-6), per lab a kind, a start lag and, optionally, its seven values.
import { useState, type ReactNode } from 'react';
import { CHINA_PRESETS } from '../../../data/actors';
import { KINDS, REALISTIC_CAST, type FocusChannel, type NpcKindId, type OpennessRule, type Personality } from '../../../data/v2/npcLabs';
import type { NpcSetupLab, SetupV2 } from '../../../engine/v2';
import { useV2 } from '../store';
import { Term, Tip, TipCard } from '../ui';

/** The kinds a US lab can be, in picker order, with their player-facing names, glossary terms and one-line summaries. */
const US_KINDS: { id: NpcKindId; label: string; term: string; line: string }[] = [
  { id: 'leader', label: 'Frontier leader', term: 'npcKindLeader', line: 'Best model and most customers.' },
  { id: 'safety', label: 'Safety-first', term: 'npcKindSafety', line: 'Careful, publishes safety work, sells to businesses.' },
  { id: 'bigtech', label: 'Big-tech division', term: 'npcKindBigtech', line: 'Parent-funded, most compute, broad products.' },
  { id: 'openweights', label: 'Open-weights', term: 'npcKindOpenweights', line: 'Publishes every model for download.' },
  { id: 'racer', label: 'Founder racer', term: 'npcKindRacer', line: 'Buys compute fast, spends little on safety.' },
  { id: 'upstart', label: 'Boutique upstart', term: 'npcKindUpstart', line: 'Tiny and well funded, no product yet.' },
];
const MAX_LABS = 6;

const entryOf = (kind: NpcKindId) => REALISTIC_CAST.find((e) => e.kind === kind)!;
/** A kind's typical start lag in months behind the frontier (the Realistic cast's). */
const typicalLag = (kind: NpcKindId) => entryOf(kind).start.publicLagMonths ?? entryOf(kind).start.publicLagBandMonths ?? 0;
const kindDef = (id: string) => US_KINDS.find((k) => k.id === id);
const fmtLag = (m: number) => (m === 0 ? 'at the frontier' : `${Math.round(m * 10) / 10} mo behind`);
const dominant = (f: Personality['focus']): FocusChannel => Object.entries(f.channels).sort((a, b) => b[1] - a[1])[0][0] as FocusChannel;
const FOCUS_LABEL: Record<FocusChannel, string> = { consumer: 'Consumers', api: 'Developers', enterprise: 'Businesses' };
const OPEN_LABEL: Record<'closed' | 'open' | 'partial', string> = { closed: 'Closed', open: 'Open', partial: 'Older models' };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Realistic: the cast, one line each. */
function CastList({ leaderGone }: { leaderGone: boolean }) {
  const rows = REALISTIC_CAST.filter((e) => !(e.kind === 'leader' && leaderGone));
  return (
    <div className="cast-list" data-test="cast-list">
      {rows.map((e) => {
        const k = kindDef(e.kind);
        const lag = e.start.publicLagMonths ?? e.start.publicLagBandMonths ?? 0;
        return (
          <div className="cast-row" key={e.id} data-cast={e.id}>
            <b className="cast-name">{e.name}</b>
            <span className="cast-kind">{k ? <Term id={k.term}>{k.label}</Term> : 'State lab'}</span>
            <Tip content={() => <TipCard title={<Term id="npcStartLag">Months behind</Term>}>{e.start.publicLagMonths === null ? 'No public model yet; its level is a guess.' : `Its best public model matches the leading lab's from ${fmtLag(lag).replace(' behind', '')} earlier.`}</TipCard>}>
              <span className="cast-lag mono">{e.start.publicLagMonths === null ? `~${lag} mo, no model` : fmtLag(lag)}</span>
            </Tip>
            <span className="cast-line dim small">{k ? k.line : "China's national effort; models open while tensions are low."}</span>
          </div>
        );
      })}
    </div>
  );
}

function Num({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string }) {
  return <input className="text-input num-input" type="number" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(clamp(v, min, max)); }} />;
}
function Chips<T extends string>({ cur, opts, onPick }: { cur: T; opts: { v: T; label: string }[]; onPick: (v: T) => void }) {
  return <span className="picker-opts">{opts.map((o) => <button key={o.v} className={`chip chip-sm ${cur === o.v ? 'active' : ''}`} data-opt={o.v} onClick={() => onPick(o.v)}>{o.label}</button>)}</span>;
}

/** The seven values of one lab, the kind's as defaults. */
function PersonalityEditor({ lab, set }: { lab: NpcSetupLab; set: (p: Partial<Personality> | undefined) => void }) {
  const cur: Personality = { ...KINDS[lab.kind], ...lab.personality };
  const patch = (p: Partial<Personality>) => set({ ...lab.personality, ...p });
  const row = (term: string, label: string, body: ReactNode) => <div className="pers-row"><span className="pers-label"><Term id={term}>{label}</Term></span>{body}</div>;
  const open = cur.openness.mode === 'chinaRung' ? 'open' : cur.openness.mode;
  return (
    <div className="pers" data-test="personality">
      {row('npcFunding', 'Funding', <Chips cur={cur.funding} opts={[{ v: 'parent', label: 'Parent' }, { v: 'private', label: 'Private' }]} onPick={(v) => patch({ funding: v })} />)}
      {row('npcReleaseLag', 'Release lag', <span><Num label="Release lag in days" value={cur.releaseLagDays} min={0} max={180} onChange={(v) => patch({ releaseLagDays: v })} /> <span className="dim small">days</span></span>)}
      {row('npcOpenness', 'Openness', <Chips cur={open} opts={(['closed', 'open', 'partial'] as const).map((v) => ({ v, label: OPEN_LABEL[v] }))} onPick={(v) => patch({ openness: { mode: v } as OpennessRule })} />)}
      {row('npcFocus', 'Market focus', <Chips cur={dominant(cur.focus)} opts={(['consumer', 'api', 'enterprise'] as const).map((v) => ({ v, label: FOCUS_LABEL[v] }))}
        onPick={(v) => patch({ focus: { ...cur.focus, channels: { consumer: v === 'consumer' ? 0.6 : 0.2, api: v === 'api' ? 0.6 : 0.2, enterprise: v === 'enterprise' ? 0.6 : 0.2 } } })} />)}
      {row('npcSafetyEmphasis', 'Safety emphasis', <span><Num label="Safety emphasis percent" value={Math.round(cur.safetyEmphasis * 100)} min={0} max={100} onChange={(v) => patch({ safetyEmphasis: v / 100 })} /> <span className="dim small">%</span></span>)}
      {row('npcRaceResponse', 'Race response', <span><Num label="Race response percent" value={Math.round(cur.raceResponse * 100)} min={0} max={100} onChange={(v) => patch({ raceResponse: v / 100 })} /> <span className="dim small">%</span></span>)}
      {lab.personality && <button className="btn btn-sm" onClick={() => set(undefined)}>Reset to the kind's values</button>}
    </div>
  );
}

function LabRow({ i, lab, leaderGone, update, remove }: { i: number; lab: NpcSetupLab; leaderGone: boolean; update: (l: NpcSetupLab) => void; remove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lab-row" data-lab={i}>
      <div className="lab-row-head">
        <span className="dim small lab-n">{i + 1}</span>
        <span className="picker-opts" data-picker={`lab-kind-${i}`}>
          {US_KINDS.filter((k) => !(k.id === 'leader' && leaderGone)).map((k) => (
            <Tip key={k.id} content={() => <TipCard title={<Term id={k.term}>{k.label}</Term>}>{k.line}</TipCard>}>
              <button className={`chip chip-sm ${lab.kind === k.id ? 'active' : ''}`} data-opt={k.id} onClick={() => update({ kind: k.id, lagMonths: typicalLag(k.id) })}>{k.label}</button>
            </Tip>
          ))}
        </span>
        <span className="lab-lag"><Term id="npcStartLag">Months behind</Term> <Num label={`Lab ${i + 1} months behind`} value={lab.lagMonths} min={0} max={36} step={0.5} onChange={(v) => update({ ...lab, lagMonths: v })} /></span>
        <button className={`btn btn-sm ${open ? 'active' : ''}`} data-test={`adjust-${i}`} onClick={() => setOpen(!open)}>{lab.personality ? 'Personality: adjusted' : 'Adjust personality'}</button>
        <button className="btn btn-sm" aria-label={`Remove lab ${i + 1}`} onClick={remove}>Remove</button>
      </div>
      {open && <PersonalityEditor lab={lab} set={(p) => update({ kind: lab.kind, lagMonths: lab.lagMonths, ...(p ? { personality: p } : {}) })} />}
    </div>
  );
}

/** The Rivals section: Realistic or Create rivals, and China's preset. */
export function RivalsSection() {
  const st = useV2();
  const d = st.draftSetup;
  const custom = d.cast !== 'realistic';
  const leaderGone = (d.start ?? 'leader') === 'leader';
  const set = (p: Partial<SetupV2>) => { st.draftSetup = { ...st.draftSetup, ...p }; st.notify(); };
  const labs: NpcSetupLab[] = d.cast === 'realistic' ? [] : d.cast;
  const seed = (): NpcSetupLab[] => REALISTIC_CAST.filter((e) => e.kind !== 'china' && !(e.kind === 'leader' && leaderGone)).map((e) => ({ kind: e.kind, lagMonths: typicalLag(e.kind) }));
  const setCount = (n: number) => {
    const next = labs.slice(0, n);
    const used = new Set(next.map((l) => l.kind));
    while (next.length < n) {
      const kind = US_KINDS.find((k) => !used.has(k.id) && !(k.id === 'leader' && leaderGone))?.id ?? 'safety';
      used.add(kind);
      next.push({ kind, lagMonths: typicalLag(kind) });
    }
    set({ cast: next });
  };
  return (
    <div data-picker="cast" data-test="rivals">
      <div className="picker-label"><Term id="npcRivalsMode">Rival labs</Term></div>
      <div className="picker-opts">
        <button className={`chip ${!custom ? 'active' : ''}`} data-opt="realistic" onClick={() => set({ cast: 'realistic' })}>Realistic</button>
        <button className={`chip ${custom ? 'active' : ''}`} data-opt="custom" data-test="create-rivals" onClick={() => !custom && set({ cast: seed() })}>Create rivals</button>
      </div>
      {!custom && <CastList leaderGone={leaderGone} />}
      {custom && (
        <div className="rivals-custom" data-test="rivals-custom">
          <div className="lab-count"><span className="dim small">US labs</span>
            <span className="picker-opts" data-picker="lab-count">{Array.from({ length: MAX_LABS + 1 }, (_, n) => <button key={n} className={`chip chip-sm ${labs.length === n ? 'active' : ''}`} data-opt={n} onClick={() => setCount(n)}>{n}</button>)}</span>
          </div>
          {labs.map((l, i) => <LabRow key={i} i={i} lab={l} leaderGone={leaderGone} update={(nl) => set({ cast: labs.map((x, j) => (j === i ? nl : x)) })} remove={() => set({ cast: labs.filter((_, j) => j !== i) })} />)}
          {labs.length === 0 && <div className="dim small">No US rivals: only China's lab races you.</div>}
        </div>
      )}
      <div className="china-pick" data-picker="china">
        <div className="picker-label">China</div>
        <div className="picker-opts">
          {[{ id: 'realistic', name: 'Realistic', desc: 'Drawn from research-weighted odds.' }, ...CHINA_PRESETS.map((x) => ({ id: x.id, name: x.name, desc: x.desc.replace(/[^.]*AI 2027[^.]*\.\s*/g, '').trim() }))].map((o) => (
            <Tip key={o.id} content={() => <TipCard title={o.name}>{o.desc}</TipCard>}>
              <button className={`chip ${d.china === o.id ? 'active' : ''}`} data-opt={o.id} onClick={() => set({ china: o.id })}>{o.name}</button>
            </Tip>
          ))}
        </div>
      </div>
    </div>
  );
}
