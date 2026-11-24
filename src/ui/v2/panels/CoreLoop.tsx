// The core loop of STRUCTURE §2 (design/diagrams/STRUCT1) as a static diagram for the Codex. The live hub with a
// verdict per screen is the Overview's (Overview.tsx, UB-A).
//   Financing → Cash → Teams → Research → Models → Assurance → Products → Customers → (Cash)
//   Compute feeds Research, Models and Products; the takeoff loop: internal agents take over the teams' work.
import type { GameStateV2 } from '../../../engine/v2';
import { ICON } from '../icons';
import { C } from '../theme';
import type { GoTarget } from '../kit';

interface LoopNode { id: string; n?: number; name: string; term: string; sub: string; icon: typeof ICON.L; to: GoTarget; x: number; y: number; w?: number; store?: boolean }
const W = 1500;
const NW = 158;
const NH = 50;
const Y0 = 60;
const NODES: LoopNode[] = [
  { id: 'financing', name: 'Financing', term: 'raiseCeiling', sub: 'raises · debt · deals', icon: ICON.raise, to: { panel: 'finance' }, x: 8, y: Y0 },
  { id: 'cash', name: 'Cash', term: 'cash', sub: 'buys people and compute', icon: ICON.cash, to: { panel: 'finance' }, x: 196, y: Y0, store: true },
  { id: 'teams', n: 1, name: 'Teams', term: 'team', sub: 'engineers · research engineers · scientists', icon: ICON.staff, to: { panel: 'lab', tab: 'people' }, x: 384, y: Y0 },
  { id: 'research', n: 2, name: 'Research', term: 'techTree', sub: 'portfolio · know-how', icon: ICON.research, to: { panel: 'research' }, x: 572, y: Y0 },
  { id: 'models', n: 3, name: 'Models', term: 'blueprint', sub: 'next run → training', icon: ICON.models, to: { panel: 'models' }, x: 760, y: Y0 },
  { id: 'assurance', n: 4, name: 'Assurance', term: 'sightLimit', sub: 'sight limit', icon: ICON.U, to: { panel: 'safety' }, x: 948, y: Y0 },
  { id: 'products', n: 5, name: 'Products', term: 'product', sub: 'tools · price · safeguards', icon: ICON.product, to: { panel: 'products' }, x: 1136, y: Y0 },
  { id: 'customers', n: 6, name: 'Customers', term: 'customerStock', sub: 'share of spend', icon: ICON.staff, to: { panel: 'products' }, x: 1324, y: Y0, w: 168 },
  { id: 'compute', name: 'Compute', term: 'computeOnline', sub: 'H100e online', icon: ICON.compute, to: { panel: 'compute' }, x: 384, y: Y0 + 82, store: true },
];
const BY = Object.fromEntries(NODES.map((n) => [n.id, n]));
const R = (id: string) => BY[id].x + (BY[id].w ?? NW);
const L = (id: string) => BY[id].x;
const MY = (id: string) => BY[id].y + NH / 2;

function Edge({ d, dashed, color = '#4b5d77' }: { d: string; dashed?: boolean; color?: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={dashed ? 1.6 : 2} strokeDasharray={dashed ? '5 4' : undefined} markerEnd="url(#cl-arrow)" />;
}

/** The loop. `live` = Overview (readings + verdicts, clickable); otherwise the static codex version. */
export function CoreLoop(_: { s: GameStateV2; live?: false }) {
  const H = Y0 + 82 + NH + 8;
  const main = ['financing', 'cash', 'teams', 'research', 'models', 'assurance', 'products', 'customers'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="coreloop" data-test="coreloop-static">
      <defs>
        <marker id="cl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b7c91" /></marker>
      </defs>
      {/* main chain */}
      {main.slice(0, -1).map((id, i) => <Edge key={id} d={`M${R(id)},${MY(id)} L${L(main[i + 1]) - 3},${MY(main[i + 1])}`} />)}
      {/* customers pay → cash */}
      <Edge d={`M${BY.customers.x + 84},${Y0} L${BY.customers.x + 84},14 L${BY.cash.x + 79},14 L${BY.cash.x + 79},${Y0 - 3}`} />
      <text x={(BY.cash.x + BY.customers.x) / 2 + 80} y={10} textAnchor="middle" className="cl-edge">customers pay</text>
      {/* takeoff loop: models → teams (dotted) */}
      <Edge dashed color={C.cap} d={`M${BY.models.x + 40},${Y0} C${BY.models.x + 20},${Y0 - 40} ${BY.teams.x + 110},${Y0 - 40} ${BY.teams.x + 100},${Y0 - 3}`} />
      <text x={(BY.teams.x + BY.models.x) / 2 + 70} y={Y0 - 34} textAnchor="middle" className="cl-edge takeoff">takeoff loop: AI staff do more of the teams' work</text>
      {/* cash → compute; compute → research, models, products */}
      <Edge d={`M${BY.cash.x + 79},${Y0 + NH} L${BY.cash.x + 79},${MY('compute')} L${L('compute') - 3},${MY('compute')}`} />
      {(['research', 'models', 'products'] as const).map((id) => <Edge key={id} d={`M${R('compute')},${MY('compute')} L${BY[id].x + 60},${MY('compute')} L${BY[id].x + 60},${Y0 + NH + 3}`} />)}
      {NODES.map((n) => {
        const w = n.w ?? NW;
        const Ic = n.icon;
        return (
          <g key={n.id} className="cl-node" data-loop={n.id}>
            <rect x={n.x} y={n.y} width={w} height={NH} rx={n.store ? 14 : 6} fill={C.panel2} stroke={C.line2} strokeWidth={1} />
            <foreignObject x={n.x + 8} y={n.y + 6} width={w - 16} height={NH - 10}>
              <div className="cl-in">
                <div className="cl-t"><Ic size={13} />{n.n ? <span className="cl-n">{n.n}</span> : null}<b>{n.name}</b></div>
                <div className="cl-r">{n.sub}</div>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
