// SAFETY (UB-9 header + Risks; UB-C Model, Instruments, Safeguards, Incidents & cases; UI-IA §1 SAFETY, approved mockups
// design/ux/mockups/rd/safety*.png and saf-*.png). The header (model picker, Loss-of-control risk, Unstopped harm, sight
// curve, Safety framework) and the Risks tab live in SafetyRisks.tsx; each other tab in its own file. Safety programmes
// live on RESEARCH › Portfolio (a link chip here).
import { footholdView, safetyView } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { Ref, tabOf, Tabs } from '../kit';
import { RisksTab, SafetyHeader } from './SafetyRisks';
import { ModelTab } from './SafetyModel';
import { InstrumentsTab } from './SafetyInstruments';
import { SafeguardsTab } from './SafetySafeguards';
import { IncidentsTab } from './SafetyIncidents';
import './safety.css';

/** UB-9 tab ids, and the old ids other screens still link to. */
const TAB_ALIAS: Record<string, string> = { overview: 'risks', graph: 'model', footholds: 'safeguards', incidents: 'cases', lines: 'risks' };

export function Safety({ s }: { s: GameStateV2 }) {
  const sv = safetyView(s);
  const raw = tabOf('safety', 'risks');
  const tab = TAB_ALIAS[raw] ?? raw;
  const openInc = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;
  const openCases = sv.investigations.filter((i) => !i.outcome).length;
  const fv = footholdView(s);
  return (
    <div className="panel-v2 safety" data-panel="safety">
      <SafetyHeader s={s} />
      <div className="sf-tabs">
        <Tabs panel="safety" def="risks" tabs={[
          { id: 'risks', label: 'Risks' }, { id: 'model', label: 'Model' }, { id: 'instruments', label: 'Instruments' },
          { id: 'safeguards', label: 'Safeguards', badge: fv.suspected + fv.located || undefined },
          { id: 'cases', label: 'Incidents & cases', badge: openCases + openInc || undefined },
        ]} />
        <Ref id="safetyProgrammes" to={{ panel: 'research', tab: 'projects' }}>Safety programmes</Ref>
      </div>
      {tab === 'risks' && <RisksTab s={s} />}
      {tab === 'model' && <ModelTab s={s} />}
      {tab === 'instruments' && <InstrumentsTab s={s} />}
      {tab === 'safeguards' && <SafeguardsTab s={s} />}
      {tab === 'cases' && <IncidentsTab s={s} />}
    </div>
  );
}
