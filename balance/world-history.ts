// Real-world series for the outside-world calibration (design/world/SOURCES.md, W9). Typed copies for the world dashboard
// (scripts/v2/worlddash.ts); every series names its source. `date` is a decimal year (month start, or the event day);
// `unverified` mirrors the [unverified] tag in SOURCES.md. Values are as printed there: nothing is re-fetched.

export interface RealPoint { date: number; value: number | null; label?: string; unverified?: boolean }
export interface RealSeries { id: string; name: string; unit: string; source: string; url: string; note?: string; points: RealPoint[] }
/** gameKey: the id the game's `laws.inForce` uses for the same law, so the dashboard can set game date against real date. */
export interface RealEvent { date: number; label: string; kind: 'export' | 'law'; gameKey?: 'sb53' | 'raise' | 'euGpai'; source: string; unverified?: boolean }

const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Decimal year of a calendar date (month 1-12; day defaults to 1). */
export const dy = (y: number, m: number, d = 1): number => y + (DIM.slice(0, m - 1).reduce((a, b) => a + b, 0) + (d - 1)) / 365;

function monthly(startYear: number, rows: (number | null)[][]): RealPoint[] {
  const out: RealPoint[] = [];
  rows.forEach((r, i) => r.forEach((v, m) => out.push({ date: dy(startYear + i, m + 1), value: v, label: `${startYear + i}-${String(m + 1).padStart(2, '0')}` })));
  return out;
}

/** BLS CPS, seasonally adjusted, 16+. Oct 2025 was not published (null). Latest published month: Oct 2026. */
export const US_UNEMPLOYMENT: RealSeries = {
  id: 'unemployment', name: 'US unemployment rate', unit: '% of labour force',
  source: 'BLS CPS, series LNS14000000 (SOURCES.md section 1)', url: 'http://data.bls.gov/timeseries/LNS14000000',
  note: 'Oct 2025 not published (appropriations lapse); Jan 2026 values carry new population controls.',
  points: monthly(2023, [
    [3.5, 3.6, 3.5, 3.4, 3.6, 3.6, 3.5, 3.7, 3.7, 3.9, 3.7, 3.8],
    [3.7, 3.9, 3.9, 3.9, 3.9, 4.1, 4.2, 4.2, 4.1, 4.1, 4.2, 4.1],
    [4.0, 4.2, 4.2, 4.2, 4.3, 4.1, 4.3, 4.3, 4.4, null, 4.5, 4.4],
    [4.3, 4.4, 4.3, 4.3, 4.3, 4.2, 4.1, 4.1, 4.2, 4.1],
  ]),
};

/** Youth (16-24): SOURCES.md prints only these months, not the full series. */
export const US_YOUTH_UNEMPLOYMENT: RealSeries = {
  id: 'youth', name: 'US youth (16-24) unemployment rate', unit: '% of labour force',
  source: 'BLS CPS, series LNS14024887 via FRED (SOURCES.md section 1)', url: 'https://fred.stlouisfed.org/series/LNS14024887',
  note: 'Only the months SOURCES.md prints (not every month).',
  points: ([[2023, 1, 8.1], [2023, 4, 6.6], [2023, 10, 8.8], [2023, 12, 8.0], [2024, 1, 7.4], [2024, 8, 9.7], [2024, 12, 9.0], [2025, 1, 9.1],
    [2025, 6, 10.0], [2025, 8, 10.6], [2025, 12, 10.4], [2026, 1, 8.9], [2026, 3, 8.5], [2026, 9, 9.9], [2026, 10, 9.3]] as [number, number, number][])
    .map(([y, m, v]) => ({ date: dy(y, m), value: v, label: `${y}-${String(m).padStart(2, '0')}` })),
};

/** BEA real GDP growth, quarterly annualised, plotted at the quarter start. 2026 Q3 is the second estimate. */
export const US_GDP_GROWTH: RealSeries = {
  id: 'gdp', name: 'US real GDP growth (quarterly, annualised)', unit: '% per year',
  source: 'BEA via FRED, A191RL1Q225SBEA (SOURCES.md section 2)', url: 'https://fred.stlouisfed.org/series/A191RL1Q225SBEA',
  note: 'Annual: 2023 2.9, 2024 3.0, 2025 2.3 (A191RL1A225NBEA).',
  points: ([[2023, [3.4, 2.2, 4.5, 3.6]], [2024, [1.4, 3.6, 3.2, 2.4]], [2025, [0.1, 4.0, 3.9, 0.2]], [2026, [2.5, 2.2, 4.3]]] as [number, number[]][])
    .flatMap(([y, qs]) => qs.map((v, q) => ({ date: dy(y, q * 3 + 1), value: v, label: `${y} Q${q + 1}` }))),
};

/** Pew "more concerned than excited" (item CNCEXC); the game's concern value arrives with W4. */
export const PEW_CONCERN: RealSeries = {
  id: 'concern', name: 'Americans more concerned than excited about AI (Pew)', unit: '% of adults',
  source: 'Pew Research Center, topline PS_2025.9.17, item CNCEXC (SOURCES.md section 3.1)', url: 'https://www.pewresearch.org/wp-content/uploads/sites/20/2025/09/PS_2025.9.17_AI-and-its-impact_topline.pdf',
  note: 'Latest wave Jun 2025; Pew still quotes 50% in Mar 2026. The Aug 2024 column order is garbled in the topline text.',
  points: [
    { date: dy(2021, 11, 4), value: 37, label: 'Nov 2021' }, { date: dy(2022, 12, 15), value: 38, label: 'Dec 2022' }, { date: dy(2023, 8, 3), value: 52, label: 'Aug 2023' },
    { date: dy(2024, 8, 15), value: 51, label: 'Aug 2024', unverified: true }, { date: dy(2025, 6, 12), value: 50, label: 'Jun 2025' },
  ],
};

export const EXPORT_CONTROL_STEPS: RealEvent[] = [
  { date: dy(2022, 10, 7), label: 'First chip controls on China', kind: 'export', source: 'https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor' },
  { date: dy(2023, 10, 17), label: 'Chip rules tightened (A800/H800 gap closed)', kind: 'export', source: 'https://www.federalregister.gov/documents/2023/10/25/2023-23055/implementation-of-additional-export-controls-certain-advanced-computing-items-supercomputer-and' },
  { date: dy(2024, 12, 2), label: 'HBM memory and equipment controls', kind: 'export', source: 'https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing' },
  { date: dy(2025, 1, 13), label: 'AI Diffusion framework (country tiers)', kind: 'export', source: 'https://www.federalregister.gov/documents/2025/01/15/2025-00636/framework-for-artificial-intelligence-diffusion' },
  { date: dy(2025, 4, 9), label: 'H20 licence required', kind: 'export', source: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581025000082/nvda-20250409.htm' },
  { date: dy(2025, 5, 13), label: 'Diffusion rule rescinded', kind: 'export', source: 'https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens' },
  { date: dy(2025, 8, 1), label: 'H20 sales resume (15% revenue share)', kind: 'export', source: 'research/07 section 2.2 (no primary text found)', unverified: true },
  { date: dy(2026, 1, 13), label: 'H200-class to China case-by-case', kind: 'export', source: 'https://www.federalregister.gov/documents/2026/01/15/2026-00789/revision-to-license-review-policy-for-advanced-computing-commodities' },
  { date: dy(2026, 11, 19), label: 'Diffusion rescission formalised; remote-access rule', kind: 'export', source: 'https://www.federalregister.gov/documents/2026/11/19/2026-23529/addressing-remote-access-to-advanced-semiconductors', unverified: true },
];

export const LAW_DATES: RealEvent[] = [
  { date: dy(2025, 7, 10), label: 'EU GPAI Code of Practice published', kind: 'law', source: 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai' },
  { date: dy(2025, 8, 2), label: 'EU AI Act: GPAI obligations apply', kind: 'law', gameKey: 'euGpai', source: 'https://digital-strategy.ec.europa.eu/en/faqs/general-purpose-ai-models-ai-act-questions-answers' },
  { date: dy(2025, 9, 29), label: 'California SB 53 signed', kind: 'law', source: 'https://www.gov.ca.gov/2025/09/29/governor-newsom-signs-sb-53-advancing-californias-world-leading-artificial-intelligence-industry/' },
  { date: dy(2025, 12, 19), label: 'New York RAISE Act signed', kind: 'law', source: 'https://www.nysenate.gov/legislation/bills/2025/A6453' },
  { date: dy(2026, 1, 1), label: 'SB 53 operative', kind: 'law', gameKey: 'sb53', source: 'research/07 section 2.2 (repo)', unverified: true },
  { date: dy(2027, 1, 1), label: 'RAISE effective (after chapter amendment)', kind: 'law', gameKey: 'raise', source: 'research/07 section 2.2, research/08 (repo; conflicts with the NY page)', unverified: true },
];

export const REAL_SERIES: RealSeries[] = [US_UNEMPLOYMENT, US_YOUTH_UNEMPLOYMENT, US_GDP_GROWTH, PEW_CONCERN];
