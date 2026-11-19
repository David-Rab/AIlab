// Codex (§6.7): generated from the data files — glossary, agendas, findings, traits and edges, benchmarks, tech tree,
// sectors, techs, actions and events. Each entry shows its research citation and "[D] design value" flags.
import { useState } from 'react';
import { AGENDAS } from '../../../data/v2/agendas';
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { EDGES } from '../../../data/v2/edges';
import { FINDINGS } from '../../../data/v2/findings';
import { GLOSSARY_V2 } from '../../../data/v2/glossary';
import { PARADIGMS } from '../../../data/v2/paradigms';
import { TREE, TREE_BY_ID } from '../../../data/v2/tree';
import { COLUMN_LABEL } from '../../../data/v2/teams';
import { SECTORS } from '../../../data/v2/sectors';
import { WORLD_TECHS } from '../../../data/v2/techs';
import { TRAITS_V2 } from '../../../data/v2/traits';
import { UMODE_BY_ID } from '../../../data/v2/umodes';
import { LIMITS } from '../../../data/v2/limits';
import { ACTION_DEFS, EVENT_DEFS } from '../../../engine/v2';
import { CoreLoop } from './CoreLoop';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { playerSource, Rich } from '../ui';

const PARADIGM_ODDS: Record<string, number> = Object.fromEntries(PARADIGMS.map((p) => [p.id, p.prior]));

export interface CodexEntry { id: string; cat: string; title: string; body: string; src?: string; design?: boolean; rows?: [string, string][]; diagram?: 'loop' }

const VERBS = [['hire', 'Hire'], ['research', 'Research'], ['train', 'Design & train'], ['launch', 'Launch / update'], ['policy', 'Set a policy'], ['deal', 'Make a deal'], ['respond', 'Respond']] as const;
const STRUCTURE_LOOP = 'Your company runs one loop. (1) Teams do three kinds of work: [[roleEng|engineers]] build, [[roleRE|research engineers]] do routine research, [[roleSci|scientists]] open new ideas. (2) Research makes [[knowHow|know-how]] and unlocks ideas on the [[techTree|tree]]. (3) Knowledge lets you design better models, which engineers and compute [[baseRun|train]]. (4) Assurance checks them: [[U|understanding]] is how well you can still see inside. (5) Models power [[product|products]], which (6) win customers from rivals. Customers pay; cash buys people and [[computeOnline|compute]]. The takeoff loop: your best model, used inside the company, takes over the teams’ work, first engineering, then routine research, then frontier research. The same model may be misaligned.';
const STRUCTURE_OUTSIDE = 'Only your company is modelled from the inside. Rival labs, China, government, the public and the economy are simulated from the outside, the way AI 2027 models them. Rivals advance as a continuous frontier: none of your run, data, eval, board or commitment gates apply to them, and a rival leader bound by its commitments slows itself. Their internals (models, alignment, plans) are hidden; you see estimates from releases, evaluators and intel. In every start but the frontier leader’s, a simulated AI 2027 leader lab runs on the reference path.';
const D = (src?: string) => !!src && /\[D\]|design value/i.test(src);

export function codexEntries(s: GameStateV2): CodexEntry[] {
  const out: CodexEntry[] = [];
  // Structure first (STRUCTURE §2, §4.8, R2): how the game is put together.
  out.push({ id: 's:loop', cat: 'Structure', title: 'The core loop', diagram: 'loop', src: 'design/STRUCTURE.md §2', body: STRUCTURE_LOOP });
  out.push({ id: 's:outside', cat: 'Structure', title: 'Simulated from the outside', src: 'design/STRUCTURE.md §4.8; design/LIMITS.md', body: STRUCTURE_OUTSIDE });
  const verbRows = VERBS.map(([v, label]) => [label, ACTION_DEFS.filter((a) => a.verb === v).map((a) => a.title).join(' · ')] as [string, string]);
  out.push({ id: 's:verbs', cat: 'Structure', title: 'One verb set', src: 'design/STRUCTURE.md R2', body: 'Every action in the game is one of seven verbs, and every action and engine system belongs to one system of the loop. Hover an action button for its live cost, gain and exposure.', rows: verbRows });
  for (const l of LIMITS) out.push({ id: `lim:${l.id}`, cat: 'Limits', title: l.title, body: l.rule, src: l.source, design: D(l.source), rows: [['Shown on', l.home.panel === 'codex' ? 'this codex (an internal rule)' : `${l.home.panel}${l.home.tab ? ' › ' + l.home.tab : ''}`], ['Enforced in', l.engine]] });
  for (const [id, g] of Object.entries(GLOSSARY_V2)) out.push({ id: `g:${id}`, cat: 'Glossary', title: g.title, body: g.body, src: g.src, design: D(g.src) });
  for (const a of AGENDAS) out.push({ id: `ag:${a.id}`, cat: 'Agendas', title: `${a.id} ${a.name}`, body: `Tool family ${a.family}; covers ${a.coverage.join(', ') || '—'}. First result ≈ ${a.T1} months at serious staffing (science teams worth 4 team-capacity). Whether it works in this world is hidden: watch the line's health.`, src: 'research/14 §1.2', design: true, rows: [['Compute share', `${(a.computeRange[0] * 100).toFixed(1)}–${(a.computeRange[1] * 100).toFixed(1)}%`], ['Goodhart G', a.G.toFixed(2)], ['M½', a.mHalf >= 1e8 ? '∞' : String(a.mHalf)]] });
  for (const f of FINDINGS) out.push({ id: `f:${f.id}`, cat: 'Findings', title: `${f.id} ${f.title}`, body: `Type ${f.type} · agenda ${f.agenda}.`, src: f.source, design: D(f.source) });
  for (const t of TRAITS_V2) out.push({ id: `t:${t.id}`, cat: 'Traits', title: `${t.id} ${t.name}`, body: t.desc, src: `research/04 ${t.r04}`, rows: [['Layer', t.layer], ['Protective', t.protective ? 'yes' : 'no'], ['Scales with difficulty', t.difficulty ? 'yes' : 'no']] });
  for (const e of EDGES) out.push({ id: `e:${e.id}`, cat: 'Trait edges', title: `${e.id} ${e.from.join(' + ')} → ${e.to}`, body: `Prior mean weight ${e.wBar}, evidence grade ${e.grade}.${e.moderator ? ` Moderator: ${e.moderator}.` : ''}`, src: e.cite, design: e.grade === 'C' || e.grade === 'D' });
  for (const b of BENCHMARKS) out.push({ id: `b:${b.id}`, cat: 'Benchmarks', title: b.name, body: `Modelled on ${b.family}. Domain ${Array.isArray(b.domain) ? b.domain.join(' + ') : b.domain}.${b.dangerous ? ' Dangerous-capability benchmark: sandbagging shifts it.' : ''}${b.flag ? ` Sets the ${b.flag} flag above 60.` : ''}`, src: 'research/12 §0.5', rows: b.special ? [] : [['Floor–ceiling', `${b.floor}–${b.ceil}`], ['Midpoint L', b.mL.toFixed(1)]] });
  for (const n of TREE) out.push({ id: `n:${n.id}`, cat: 'Tech tree', title: n.name, body: [n.cap, n.saf && `Safety: ${n.saf}`, n.cost && `Cost: ${n.cost}`, n.payoff].filter(Boolean).join('. ') + '.', src: n.paradigm ? 'research/12 §0.7' : 'design/TECH-TREE.md', design: true, rows: [['Column', COLUMN_LABEL[n.column]], ['Layer', n.layer], ['Needs', n.needs.map((r) => TREE_BY_ID[r]?.name ?? r).join(', ') || 'nothing'], ['Effort', n.star ? 'known at start' : n.effort ?? '—'], ...(n.paradigm && PARADIGM_ODDS[n.id] !== undefined && !n.star ? [['Odds', `${Math.round(PARADIGM_ODDS[n.id] * 100)}%`] as [string, string]] : n.odds ? [['Odds', `${Math.round(n.odds * 100)}%`] as [string, string]] : [])] });
  for (const x of SECTORS) out.push({ id: `s:${x.id}`, cat: 'Sectors', title: x.name, body: `${x.empPct}% of US employment, relative wage ${x.wage}. Task mix: ${Object.entries(x.tasks).map(([d, w]) => `${d} ${Math.round((w ?? 0) * 100)}%`).join(', ')}.`, src: 'research/16 §1A', rows: [['Start A', `${Math.round(x.A0 * 100)}%`], ['Friction R0', String(x.R0)], ['Remote-workable', x.remote ? 'yes' : 'no']] });
  for (const t of WORLD_TECHS) out.push({ id: `w:${t.id}`, cat: 'Technologies', title: `${t.id} ${t.name}`, body: `${t.headline}. Gates: ${Object.entries(t.gates).map(([d, l]) => `${d} ${l}`).join(', ') || 'none'}. Prereqs: ${t.prereqs.join(', ') || 'none'}.${t.risk ? ` Risk: ${t.risk}.` : ''}`, src: `research/16 ${t.r16}` });
  for (const a of ACTION_DEFS) out.push({ id: `a:${a.id}`, cat: 'Actions', title: a.title, body: `Sphere ${a.sphere}. Hover the action button in its panel for the live cost, gain and exposure preview.${a.vote ? ' A major decision when large: the board votes, seat by seat, before you commit.' : ''}`, src: a.owner });
  for (const e of EVENT_DEFS) {
    out.push({ id: `ev:${e.id}`, cat: 'Events', title: `${e.id} ${e.title}`, body: `${e.crisis ? 'Crisis decision. ' : ''}Choices: ${e.choices.map((c) => c.label).join(' · ')}. Deadline ${e.deadlineDays} d; default “${e.choices[e.defaultChoice]?.label}”.`, src: e.owner });
  }
  for (const u of s.player.safety.discoveredUModes) {
    const d = UMODE_BY_ID[u];
    out.push({ id: `u:${u}`, cat: 'Failure modes', title: `${u} ${d.name}`, body: `Discovered. Incidents now show as ${d.mapsTo}.`, src: d.source });
  }
  return out;
}

export function Codex({ s }: { s: GameStateV2 }) {
  const st = useV2();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Structure');
  const all = codexEntries(s);
  const cats = [...new Set(all.map((e) => e.cat))];
  const list = all.filter((e) => (q ? `${e.title} ${e.body}`.toLowerCase().includes(q.toLowerCase()) : e.cat === cat));
  const sel = all.find((e) => e.id === st.sel.codex) ?? list[0];
  return (
    <div className="panel-v2 codex" data-panel="codex">
      <div className="codex-cats">
        <input className="text-input" placeholder="Search" data-test="codex-search" value={q} onChange={(e) => setQ(e.target.value)} />
        {cats.map((c) => <button key={c} className={`nav-btn ${c === cat && !q ? 'active' : ''}`} data-codex-cat={c} onClick={() => { setCat(c); setQ(''); }}>{c} <span className="dim small">{all.filter((e) => e.cat === c).length}</span></button>)}
      </div>
      <div className="codex-list">
        {list.map((e) => <button key={e.id} className={`codex-item ${sel?.id === e.id ? 'active' : ''}`} data-codex={e.id} onClick={() => store.select({ codex: e.id })}>{e.title}{e.design && <span className="chip-mini">[D]</span>}</button>)}
      </div>
      <div className="codex-entry">
        {sel && (
          <>
            <h3>{sel.title}</h3>
            <div className="dim small">{sel.cat}{sel.design ? ' · contains [D] design values (no direct empirical estimate)' : ''}</div>
            {sel.diagram === 'loop' && <div className="codex-diagram"><CoreLoop s={s} live={false} /></div>}
            <p><Rich text={sel.body} /></p>
            {sel.rows && sel.rows.length > 0 && <table className="tbl"><tbody>{sel.rows.map(([k, v]) => <tr key={k}><td className="dim">{k}</td><td>{v}</td></tr>)}</tbody></table>}
            {playerSource(sel.src) && <div className="tipcard-foot">Source: {playerSource(sel.src)}</div>}
          </>
        )}
      </div>
    </div>
  );
}
