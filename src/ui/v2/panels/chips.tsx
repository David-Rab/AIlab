// Package chips (STRUCTURE §4.9): one model chip and one monitor chip, shared by Products (product packages) and
// Company › Agents at work (internal packages). A chip is a compact picker; the caller decides what a pick does
// (both screens open a before → after preview before anything applies).
import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { GameStateV2, ModelVersion } from '../../../engine/v2';
import { measuredLOf } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { ICON } from '../icons';

export interface ChipOption { value: string; label: string; disabled?: string }

/** Options for a model picker: live versions (optionally filtered) with their measured level. */
export function modelOptions(s: GameStateV2, filter: (v: ModelVersion) => boolean = () => true, lock?: (v: ModelVersion) => string | undefined): ChipOption[] {
  return s.player.models.versions
    .filter((v) => v.status !== 'retired' && v.status !== 'rolledBack' && filter(v))
    .map((v) => {
      const why = lock?.(v);
      return { value: v.id, label: `${v.name} · L ${F.level(measuredLOf(s, v).L)}${why ? ' · locked' : ''}`, ...(why ? { disabled: why } : {}) };
    });
}

/** Model or monitor chip: icon, picker, optional readout on the right (e.g. catch rate). `changed` = draft differs. */
export function PkgChip({ kind, value, options, onPick, changed, extra, testId, sub }: {
  kind: 'model' | 'monitor'; value: string; options: ChipOption[]; onPick: (v: string) => void; changed?: boolean; extra?: ReactNode; testId?: string; sub?: ReactNode;
}) {
  const Ic = kind === 'model' ? ICON.models : Eye;
  return (
    <div className={`mchip ${changed ? 'chg' : ''}`} data-chip={kind}>
      <Ic size={13} />
      <select className="msel" data-test={testId} value={value} onChange={(e) => onPick(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={!!o.disabled} title={o.disabled}>{o.label}</option>)}
      </select>
      {sub}
      {extra}
    </div>
  );
}

/** Catch-rate readout for a monitor chip with its breakdown (products' rule: 85% × 0.52^gap, AG07 control tools). */
export function CatchX({ rate, gap, base, control, coverage, testId, note, copy, collusion }: { rate: number; gap: number; base?: number; control?: number; coverage?: number; testId?: string; note?: ReactNode; copy?: boolean; collusion?: number }) {
  const coll = copy && collusion !== undefined && collusion < rate - 1e-6;
  return (
    <Tip content={() => <TipCard title={<Term id="catchRate">Catch rate</Term>} value={F.pct(rate)} rows={[
      { label: 'Monitor as capable as the model', value: '85%' },
      { label: <Term id="gap">Oversight gap</Term>, value: `${gap.toFixed(2)} × 4 in M → ×${(0.52 ** gap).toFixed(2)}` },
      ...(base !== undefined ? [{ label: 'Before control tools', value: F.pct(base) }] : []),
      ...(control !== undefined ? [{ label: 'AI-control tools (AG07)', value: `+${F.pct(control * 0.5)} of the rest` }] : []),
      ...(coverage !== undefined && coverage < 1 ? [{ label: 'Funded (safety pool)', value: F.pct(coverage) }] : []),
      ...(coll ? [{ label: <Term id="collusion">Same lineage: scheming-type incidents</Term>, value: F.pct(collusion ?? 0), tone: 'neg' as const }] : []),
    ]}>{note ?? 'Model-behaviour incidents it catches stay internal.'}</TipCard>}>
      <span className="mchip-x">catch <b data-test={testId}>{F.pct(rate)}</b>{coll && <span className="tone-neg" data-test={testId ? `${testId}.coll` : undefined}> · {F.pct(collusion ?? 0)} scheming</span>}</span>
    </Tip>
  );
}
