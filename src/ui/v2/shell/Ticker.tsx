// Headline ticker (§6.5 severity 1): newest headlines and low-severity log lines.
import { dateOf, fmtMonth } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { Tip, TipCard } from '../ui';

export function Ticker({ s }: { s: GameStateV2 }) {
  const items = [
    ...s.headlines.slice(-12).map((h) => ({ day: h.day, text: h.text, tag: h.sector ?? 'news' })),
    ...s.log.filter((e) => (e.severity ?? 1) <= 1).slice(-8).map((e) => ({ day: e.day, text: e.text, tag: e.kind })),
  ].sort((a, b) => b.day - a.day).slice(0, 14);
  return (
    <Tip as="div" className="ticker" content={() => (
      <TipCard title="Headlines" rows={items.map((i) => ({ label: <span className="small">{i.text}</span>, value: <span className="dim small">{fmtMonth(dateOf(s, i.day))}</span> }))} />
    )}>
      <div className="ticker-track" data-test="ticker">
        {items.map((i, k) => (
          <span key={k} className="tick-item"><span className="dim">{fmtMonth(dateOf(s, i.day))}</span> {i.text}</span>
        ))}
      </div>
    </Tip>
  );
}
