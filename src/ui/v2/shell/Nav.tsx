// Left navigation (§6.2): panels, locked per act unless the tutorial is off (§1.5, §6.8).
import { BookOpen, Boxes, Brain, DollarSign, FlaskConical, Globe2, Handshake, Lock, Map, Radar, Rocket, Users, Zap, type LucideIcon } from 'lucide-react';
import type { GameStateV2 } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ACT_NAMES, Tip, TipCard, UNLOCK_ACT, unlocked } from '../ui';

export const NAV: { id: string; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'map', label: 'Map', icon: Map, desc: 'Risk map: labs, deployments, sectors and the flows between them.' },
  { id: 'finance', label: 'Finance', icon: DollarSign, desc: 'Cash flow, ledger, raise ceiling, board, deals and debt.' },
  { id: 'compute', label: 'Compute', icon: Zap, desc: 'Chip market, orders, sites and power.' },
  { id: 'departments', label: 'Depts', icon: Users, desc: 'Staff, hiring, compute split, security.' },
  { id: 'models', label: 'Models', icon: Brain, desc: 'Lineage, model card, run queue, paradigms.' },
  { id: 'rundesigner', label: 'Runs', icon: Rocket, desc: 'Design and launch training runs.' },
  { id: 'deployments', label: 'Deploy', icon: Boxes, desc: 'Live deployments, pricing, serving capacity.' },
  { id: 'safety', label: 'Safety', icon: FlaskConical, desc: 'Agendas, techniques, trait graph, incidents, eval gate.' },
  { id: 'relations', label: 'Relations', icon: Handshake, desc: 'Counterparties, blocs, commitments, China, government.' },
  { id: 'world', label: 'World', icon: Globe2, desc: 'Sectors, jobs, control index, tech tree, macro.' },
  { id: 'risk', label: 'Risk', icon: Radar, desc: 'Risk sources: estimated catastrophe paths from your beliefs.' },
  { id: 'codex', label: 'Codex', icon: BookOpen, desc: 'Every term, agenda, trait, benchmark and event, with sources.' },
];

export function Nav({ s }: { s: GameStateV2 }) {
  const st = useV2();
  return (
    <nav className="nav">
      {NAV.map((n) => {
        const ok = unlocked(s, n.id);
        const emph = n.id === 'risk' && s.tutorial.act >= 4;
        const Icon = n.icon;
        return (
          <Tip as="div" key={n.id} content={() => <TipCard title={n.label} value={ok ? undefined : `Act ${UNLOCK_ACT[n.id]}`}>{ok ? n.desc : `Unlocks in Act ${UNLOCK_ACT[n.id]} · ${ACT_NAMES[UNLOCK_ACT[n.id]]}`}</TipCard>}>
            <button className={`nav-btn ${st.panel === n.id ? 'active' : ''} ${ok ? '' : 'locked'} ${emph ? 'emph' : ''}`} data-nav={n.id} disabled={!ok} onClick={() => store.setPanel(n.id)}>
              {ok ? <Icon size={16} /> : <Lock size={14} />}
              <span>{n.label}</span>
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}
