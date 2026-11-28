// World: three tabs. Work (WorldWork.tsx: the economy tiles, the sector table and card, jobs, the since-start chart), Risk
// (WorldRisk.tsx: world risk by source, the flows) and Tech & control (WorldTech.tsx: control index, robots, the 29 world
// technologies, the moonshot). Actions: transition fund (Work), moonshot (Tech & control).
import type { GameStateV2 } from '../../../engine/v2';
import { PanelHead, Tabs, tabOf } from '../kit';
import { WorldWork } from './WorldWork';
import { WorldRisk } from './WorldRisk';
import { WorldTech } from './WorldTech';
import { ICON } from '../icons';

export function World({ s }: { s: GameStateV2 }) {
  const tab = tabOf('world', 'work');
  const names = (id: string) => (id === 'player' ? s.player.name : id === 'china' ? 'China' : id === 'player:open' ? 'Your open weights' : s.rivals.find((r) => r.core.id === id)?.core.name ?? id);
  return (
    <div className="panel-v2" data-panel="world">
      <PanelHead icon={ICON.world} title="World" sub="AI at work, jobs, technology" tabs={<Tabs panel="world" def="work" tabs={[{ id: 'work', label: 'Work', icon: ICON.world }, { id: 'risk', label: 'Risk', icon: ICON.risks }, { id: 'tech', label: 'Tech & control', icon: ICON.staff }]} />} />
      {tab === 'work' && <WorldWork s={s} names={names} />}
      {tab === 'risk' && <WorldRisk s={s} />}
      {tab === 'tech' && <WorldTech s={s} names={names} />}
    </div>
  );
}
