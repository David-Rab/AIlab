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
  { id: 'company', label: 'Company', icon: ICON.company, desc: 'Where compute goes and what it produces; people, AI staff, security.', group: 'COMPANY' },
  { id: 'finance', label: 'Finance', icon: ICON.finance, desc: 'Cash flow, raising, contracts, debt, board and markets.', group: 'COMPANY' },
  { id: 'compute', label: 'Compute', icon: ICON.computePanel, desc: 'Chip market, orders, sites, power and your compute allocation.', group: 'COMPANY' },
  { id: 'research', label: 'Research', icon: ICON.research, desc: 'Your research portfolio in priority order, your know-how and your discoveries.', group: 'MODELS' },
  { id: 'models', label: 'Models', icon: ICON.models, desc: 'Lineage, model card, runs in progress, your training data and environments.', group: 'MODELS' },
  { id: 'blueprint', label: 'Next run', icon: ICON.runs, desc: 'Design your next run and start it: size, options, limits and prediction.', group: 'MODELS' },
  { id: 'products', label: 'Products', icon: ICON.deploy, desc: 'What customers buy: lineup, tools, price, safeguards (all live), and serving.', group: 'MODELS' },
  { id: 'safety', label: 'Safety', icon: ICON.safety, desc: 'Traits, safety research, instruments, safeguards, incidents and cases.', group: 'SAFETY' },
  { id: 'risk', label: 'Risk', icon: ICON.risks, desc: 'Where risk comes from, and the flows that feed it.', group: 'SAFETY' },
  { id: 'relations', label: 'Relations', icon: ICON.relations, desc: 'Government, public, rivals, China, evaluators; commitments.', group: 'WORLD' },
  { id: 'world', label: 'World', icon: ICON.world, desc: 'AI at work by sector, jobs, control index, technologies.', group: 'WORLD' },
  { id: 'codex', label: 'Codex', icon: ICON.codex, desc: 'How the game works (the core loop), every limit, term, trait, idea, benchmark and event.' },
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
