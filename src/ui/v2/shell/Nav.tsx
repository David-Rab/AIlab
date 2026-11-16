// Left navigation (IA.md L0): panels grouped by sphere; badges show where action waits (Watch count, decisions per
// sphere, new findings, idle chips). Locked panels show the act and its trigger.
import type { LucideIcon } from 'lucide-react';
import { eventDef, idleTeams } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ACT_NAMES, Tip, TipCard, UNLOCK_ACT, unlocked } from '../ui';
import { ICON } from '../icons';
import { ACT_TRIGGER } from './TopStrip';
import { watchItems } from './watch';

export interface NavItem { id: string; label: string; icon: LucideIcon; desc: string; group?: string }
export const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: ICON.overview, desc: 'Who is close, how the race got here, and what needs you now.' },
  { id: 'company', label: 'Company', icon: ICON.company, desc: 'Where compute goes and what it produces; people, compute split, security.', group: 'COMPANY' },
  { id: 'finance', label: 'Finance', icon: ICON.finance, desc: 'Cash flow, raising, contracts, debt, board and markets.', group: 'COMPANY' },
  { id: 'compute', label: 'Compute', icon: ICON.computePanel, desc: 'Chip market, orders, sites and power.', group: 'COMPANY' },
  { id: 'research', label: 'Research', icon: ICON.research, desc: 'Know-how, the tech tree, research projects and the queue.', group: 'MODELS' },
  { id: 'models', label: 'Models', icon: ICON.models, desc: 'Lineage, model card and runs in progress.', group: 'MODELS' },
  { id: 'rundesigner', label: 'Runs', icon: ICON.runs, desc: 'Design and launch training runs; see what a recipe pushes.', group: 'MODELS' },
  { id: 'deployments', label: 'Deploy', icon: ICON.deploy, desc: 'Channels, pricing, serving capacity and demand.', group: 'MODELS' },
  { id: 'safety', label: 'Safety', icon: ICON.safety, desc: 'Trait graph, agendas, tools, incidents and findings.', group: 'SAFETY' },
  { id: 'risk', label: 'Risk', icon: ICON.risks, desc: 'Where catastrophe risk comes from, and the flows that feed it.', group: 'SAFETY' },
  { id: 'relations', label: 'Relations', icon: ICON.relations, desc: 'Government, public, rivals, China, evaluators; commitments.', group: 'WORLD' },
  { id: 'world', label: 'World', icon: ICON.world, desc: 'Automation by sector, jobs, control index, technologies.', group: 'WORLD' },
  { id: 'codex', label: 'Codex', icon: ICON.codex, desc: 'Every term, trait, agenda, benchmark and event, with sources.' },
];

const EVENT_PANEL: Record<string, string> = { finance: 'finance', company: 'company', model: 'safety', incident: 'safety', research: 'safety', alert: 'risk', gov: 'relations', china: 'relations', rival: 'relations', public: 'relations', world: 'world', milestone: 'models', security: 'company' };

/** Badge per nav id: number, '!' or undefined. */
export function navBadges(s: GameStateV2): Record<string, { n: string; tone: 'warn' | 'info' | 'bad' }> {
  const b: Record<string, { n: string; tone: 'warn' | 'info' | 'bad' }> = {};
  const w = watchItems(s);
  if (w.length) b.overview = { n: String(w.length), tone: w.some((x) => x.sev >= 3.5) ? 'bad' : 'warn' };
  const dec: Record<string, number> = {};
  for (const p of s.events.pending) { const id = EVENT_PANEL[eventDef(p.id)?.icon ?? ''] ?? 'overview'; dec[id] = (dec[id] ?? 0) + 1; }
  for (const [id, n] of Object.entries(dec)) if (id !== 'overview') b[id] = { n: String(n), tone: 'warn' };
  const fresh = s.player.safety.findings.filter((f) => s.time.day - f.day <= 30).length;
  if (fresh && !b.safety) b.safety = { n: String(fresh), tone: 'info' };
  const idleSci = idleTeams(s).length;
  if (idleSci) b.research = { n: String(idleSci), tone: 'warn' };
  if (w.some((x) => x.id === 'idle') && !b.compute) b.compute = { n: '!', tone: 'warn' };
  if (w.some((x) => x.id === 'capped') && !b.deployments) b.deployments = { n: '!', tone: 'warn' };
  return b;
}

export function Nav({ s }: { s: GameStateV2 }) {
  const st = useV2();
  const badges = navBadges(s);
  let lastGroup: string | undefined;
  return (
    <nav className="nav2">
      {NAV.map((n) => {
        const ok = unlocked(s, n.id);
        const act = UNLOCK_ACT[n.id] ?? 1;
        const Icon = n.icon;
        const head = n.group && n.group !== lastGroup ? <div className="nav2-grp">{n.group}</div> : null;
        lastGroup = n.group ?? lastGroup;
        const bd = badges[n.id];
        return (
          <div key={n.id} className={n.id === 'codex' ? 'nav2-bottom' : undefined}>
            {head}
            <Tip as="div" place="right" content={() => <TipCard title={n.label} value={ok ? undefined : `Act ${act}`}>{ok ? n.desc : `Unlocks in Act ${act} · ${ACT_NAMES[act]} (${ACT_TRIGGER[act] ?? ''}).`}</TipCard>}>
              <button className={`nav2-it ${st.panel === n.id ? 'on' : ''} ${ok ? '' : 'lock'}`} data-nav={n.id} disabled={!ok} onClick={() => store.setPanel(n.id)}>
                {ok ? <Icon size={18} /> : <ICON.locked size={16} />}
                <span>{n.label}</span>
                {ok && bd && <span className={`nav2-badge ${bd.tone}`} data-badge={n.id}>{bd.n}</span>}
              </button>
            </Tip>
          </div>
        );
      })}
    </nav>
  );
}
