// Left navigation (IA.md L0): panels grouped by sphere; badges show where action waits (Watch count, decisions per
// sphere, new findings, idle chips). Locked panels show the act and its trigger.
import type { LucideIcon } from 'lucide-react';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ACT_NAMES, Tip, TipCard, UNLOCK_ACT, unlocked } from '../ui';
import { ICON } from '../icons';
import { ACT_TRIGGER } from './TopStrip';
import { navBadges } from './watch';

export { navBadges };

export interface NavItem { id: string; label: string; icon: LucideIcon; desc: string; group?: string }
export const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: ICON.overview, desc: 'Your company at a glance (the core loop), who is close, how the race got here, and what needs you now.' },
  { id: 'company', label: 'Company', icon: ICON.company, desc: 'Where compute goes and what it produces; people, compute split, security.', group: 'COMPANY' },
  { id: 'finance', label: 'Finance', icon: ICON.finance, desc: 'Cash flow, raising, contracts, debt, board and markets.', group: 'COMPANY' },
  { id: 'compute', label: 'Compute', icon: ICON.computePanel, desc: 'Chip market, orders, sites and power.', group: 'COMPANY' },
  { id: 'research', label: 'Research', icon: ICON.research, desc: 'Research projects in priority order, the recipe stacks and the tech tree.', group: 'MODELS' },
  { id: 'models', label: 'Models', icon: ICON.models, desc: 'Lineage, model card, runs in progress and the RL environment suites.', group: 'MODELS' },
  { id: 'blueprint', label: 'Blueprint', icon: ICON.runs, desc: 'Design your next model and start its training run: size, slots, limits and plan.', group: 'MODELS' },
  { id: 'products', label: 'Products', icon: ICON.deploy, desc: 'What customers buy: model and monitor, features, price, safeguards (all live), and the serving split.', group: 'MODELS' },
  { id: 'safety', label: 'Safety', icon: ICON.safety, desc: 'Trait graph, agendas, tools, incidents and findings.', group: 'SAFETY' },
  { id: 'risk', label: 'Risk', icon: ICON.risks, desc: 'Where catastrophe risk comes from, and the flows that feed it.', group: 'SAFETY' },
  { id: 'relations', label: 'Relations', icon: ICON.relations, desc: 'Government, public, rivals, China, evaluators; commitments.', group: 'WORLD' },
  { id: 'world', label: 'World', icon: ICON.world, desc: 'AI at work by sector, jobs, control index, technologies.', group: 'WORLD' },
  { id: 'codex', label: 'Codex', icon: ICON.codex, desc: 'How the game works (the core loop), every limit, term, trait, idea, benchmark and event, with sources.' },
];

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
            <Tip as="div" place="right" closeOnClick content={() => <TipCard title={n.label} value={ok ? undefined : `Act ${act}`}>{ok ? n.desc : `Unlocks in Act ${act} · ${ACT_NAMES[act]} (${ACT_TRIGGER[act] ?? ''}).`}</TipCard>}>
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
