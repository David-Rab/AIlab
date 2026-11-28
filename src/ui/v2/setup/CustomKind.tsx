// Setup: the Custom lab kind (design/corp/CORPORATE.md §6.2): a position, a charter and who owns the company, with a live
// preview of the structure label, the board's seats and who controls the company.
import type { ReactNode } from 'react';
import { controllerOf, seatsOf, startControl, structureLabel } from '../../../engine/v2';
import type { CustomKind, PositionId } from '../../../engine/v2';
import { POSITIONS, POSITION_BY_ID, customKind, type Difficulty } from '../../../data/v2/starts';
import { useV2 } from '../store';
import { Term, Tip, TipCard } from '../ui';
import { positionNumbers } from './kindFacts';

export const CUSTOM_DEFAULT: CustomKind = { position: 'frontier', charter: {}, capTable: 'founderMajority' };
export const DIFF_TONE: Record<Difficulty, string> = { Easy: 'good', Medium: 'warn', Hard: 'bad', Impossible: 'bad' };

/** The five positions, with a line each; the two with a real trade-off are tagged. */
const POSITION_LINES: Record<PositionId, { line: string; tradeoff?: string }> = {
  frontier: { line: 'The lead lab: the best model, the most compute and three live products.' },
  contender: { line: 'Near the frontier with real revenue; you must raise money about once a year.' },
  scratch: { line: 'A few founders, seed money and a downloaded model.' },
  capital: { line: 'Big compute on campuses already built, a model six months behind.', tradeoff: 'Compute and users, but the model lags and the talent pull is weak.' },
  talent: { line: 'Elite founders and patient money; no compute, no product, no revenue.', tradeoff: 'Strongest talent pull and a rich seed, but nothing to sell and little compute.' },
};
const POSITION_ORDER: PositionId[] = ['frontier', 'contender', 'scratch', 'capital', 'talent'];

const CHARTERS: { v: 'none' | 'mission' | 'cap'; label: string; charter: CustomKind['charter']; desc: string }[] = [
  { v: 'none', label: 'Founders and investors', charter: {}, desc: 'No mission body: the owners decide, and investors fund you at full appeal.' },
  { v: 'mission', label: 'Mission body', charter: { missionBody: true }, desc: 'A mission body takes a tenth of the company and two thirds of the votes. Its safety committee can halt the release of a model your own evals red-flag. Investors like you a little less.' },
  { v: 'cap', label: 'Mission body with a profit cap', charter: { missionBody: true, profitCap: true }, desc: 'A mission body as above, and investors’ returns are capped, which makes raising money much harder.' },
];
const OWNERS: { v: CustomKind['capTable']; label: string; desc: string }[] = [
  { v: 'founderMajority', label: 'Founder-majority', desc: 'Founders hold 60% and investors 40%: the founders control the company.' },
  { v: 'investorHeavy', label: 'Investor-heavy', desc: 'Founders hold 35% and investors 65%: no one holds a majority, so the board decides by vote.' },
  { v: 'wholly', label: 'Wholly owned by Azimuth', desc: 'Azimuth owns the company outright and funds it through a yearly budget; it cannot raise outside equity.' },
];
const charterKey = (c: CustomKind['charter']): 'none' | 'mission' | 'cap' => (c.profitCap ? 'cap' : c.missionBody ? 'mission' : 'none');
const FRONTIER_WHOLLY = 'The frontier start has no parent budget, so a division of Azimuth cannot start there.';
const NO_MISSION_IN_DIVISION = 'A division has no mission body: Azimuth owns the company outright.';

function Option({ active, disabled, reason, title, desc, opt, onPick, tag }: { active: boolean; disabled?: boolean; reason?: string; title: string; desc: ReactNode; opt: string; onPick: () => void; tag?: ReactNode }) {
  return (
    <Tip content={() => <TipCard title={title}>{disabled && reason ? `${reason} ${typeof desc === 'string' ? desc : ''}` : desc}</TipCard>}>
      <button className={`chip custom-opt ${active ? 'active' : ''}`} data-opt={opt} disabled={disabled} onClick={onPick}>{title}{tag}</button>
    </Tip>
  );
}

/** The board as seats, e.g. "CEO · 4 mission · 1 founder director · 1 investor". */
function boardLine(c: CustomKind): string {
  const seats = seatsOf(startControl(customKind(c)));
  const n = (f: (k: string) => boolean) => seats.filter((s) => f(s.kind)).length;
  const parts = [
    'CEO',
    ...(n((k) => k === 'mission') ? [`${n((k) => k === 'mission')} mission`] : []),
    ...(n((k) => k === 'founder') > 1 ? [`${n((k) => k === 'founder') - 1} founder director${n((k) => k === 'founder') > 2 ? 's' : ''}`] : []),
    ...(n((k) => k === 'financial') ? [`${n((k) => k === 'financial')} investor${n((k) => k === 'financial') > 1 ? 's' : ''}`] : []),
    ...[...new Set(seats.filter((s) => s.kind === 'strategic').map((s) => s.holder))].map((h) => `${seats.filter((s) => s.holder === h).length} ${h}`),
  ];
  return parts.join(' · ');
}
function controlLine(c: CustomKind): string {
  const h = controllerOf(startControl(customKind(c)));
  if (!h) return 'No one holds a majority: the board decides by vote';
  if (h.kind === 'mission') return 'The mission body holds ⅔ of the votes';
  if (h.kind === 'partner') return `${h.id} holds all the votes and sets your budget`;
  return 'The founders hold a majority of the votes';
}

export function CustomEditor() {
  const st = useV2();
  const c = st.draftSetup.custom ?? CUSTOM_DEFAULT;
  const set = (p: Partial<CustomKind>) => { st.draftSetup = { ...st.draftSetup, labKind: 'custom', custom: { ...c, ...p } }; st.notify(); };
  const wholly = c.capTable === 'wholly';
  const kind = customKind(c);
  return (
    <div className="custom-kind" data-test="custom-kind">
      <div data-picker="custom-position">
        <div className="picker-label"><Term id="position">Position</Term></div>
        <div className="picker-opts">
          {POSITION_ORDER.map((id) => {
            const d = POSITIONS.find((x) => x.id === id)!;
            const blocked = id === 'frontier' && wholly;
            const info = POSITION_LINES[id];
            return (
              <Option key={id} opt={id} active={c.position === id} disabled={blocked} reason={FRONTIER_WHOLLY} title={d.name}
                desc={`${info.line} ${info.tradeoff ? `${info.tradeoff} ` : ''}${positionNumbers(POSITION_BY_ID[id])}`}
                onPick={() => set({ position: id })}
                tag={<><span className={`tag2 ${DIFF_TONE[d.difficulty]}`}>{d.difficulty}</span>{info.tradeoff && <span className="tag2 warn" data-test="tradeoff">trade-off</span>}</>} />
            );
          })}
        </div>
      </div>
      <div data-picker="custom-charter">
        <div className="picker-label"><Term id="charterOption">Charter</Term></div>
        <div className="picker-opts">
          {CHARTERS.map((o) => (
            <Option key={o.v} opt={o.v} active={charterKey(c.charter) === o.v} disabled={wholly && o.v !== 'none'} reason={NO_MISSION_IN_DIVISION} title={o.label} desc={o.desc} onPick={() => set({ charter: o.charter })} />
          ))}
        </div>
      </div>
      <div data-picker="custom-owners">
        <div className="picker-label"><Term id="owners">Owners</Term></div>
        <div className="picker-opts">
          {OWNERS.map((o) => {
            const blocked = o.v === 'wholly' && c.position === 'frontier';
            return <Option key={o.v} opt={o.v} active={c.capTable === o.v} disabled={blocked} reason={FRONTIER_WHOLLY} title={o.label} desc={o.desc} onPick={() => set(o.v === 'wholly' ? { capTable: o.v, charter: {} } : { capTable: o.v })} />;
          })}
        </div>
      </div>
      <div className="custom-preview" data-test="custom-preview">
        <span className="custom-preview-label"><Term id="structureLabel">{structureLabel(startControl(kind))}</Term></span>
        <span className="small">{boardLine(c)}</span>
        <span className="small dim">{controlLine(c)}</span>
      </div>
    </div>
  );
}
