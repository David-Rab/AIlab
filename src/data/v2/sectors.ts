// Sectors (V2-SPEC §3.11.2; research/16 §1A.1, 14 US work segments; CN/ROW mirror them). Owner: WS5.
import type { DomainId, SectorId } from '../../engine/v2/types';

export interface SectorDef {
  id: SectorId; name: string;
  /** Share of US employment (%), relative wage (avg 1). */
  empPct: number; wage: number;
  tasks: Partial<Record<DomainId, number>>;
  theta: number; R0: number; p: number; q: number; alphaMax: number; eta: number;
  /** Start adoption A (0..1) at Jul 2025 [D]. TODO(WS5): calibrate to research/16 §N3a. */
  A0: number;
}

export const SECTORS: SectorDef[] = [
  { id: 'SOFT', name: 'Software and IT', empPct: 3, wage: 1.9, tasks: { CODE: 0.55, REASON: 0.2, AGENCY: 0.15, SOCIAL: 0.1 }, theta: 0, R0: 0.05, p: 0.1, q: 2.0, alphaMax: 0.85, eta: 0.8, A0: 0.15 },
  { id: 'OFFICE', name: 'Admin, clerical, customer service', empPct: 12, wage: 0.8, tasks: { REASON: 0.35, SOCIAL: 0.35, MEDIA: 0.1, AGENCY: 0.2 }, theta: 0, R0: 0.1, p: 0.06, q: 1.4, alphaMax: 0.9, eta: 0.1, A0: 0.06 },
  { id: 'FIN', name: 'Finance, insurance, accounting', empPct: 6, wage: 1.6, tasks: { REASON: 0.55, CODE: 0.1, SOCIAL: 0.2, AGENCY: 0.15 }, theta: 0.3, R0: 0.25, p: 0.05, q: 1.2, alphaMax: 0.8, eta: 0.3, A0: 0.05 },
  { id: 'LEGAL', name: 'Legal and compliance', empPct: 1, wage: 1.8, tasks: { REASON: 0.6, SOCIAL: 0.25, AGENCY: 0.15 }, theta: 0.5, R0: 0.4, p: 0.04, q: 1.0, alphaMax: 0.7, eta: 0.4, A0: 0.04 },
  { id: 'MEDIA', name: 'Creative, media, marketing', empPct: 2, wage: 1.2, tasks: { MEDIA: 0.5, SOCIAL: 0.25, REASON: 0.25 }, theta: 0, R0: 0.1, p: 0.08, q: 1.6, alphaMax: 0.75, eta: 0.6, A0: 0.08 },
  { id: 'SCI', name: 'Science and engineering R&D', empPct: 3, wage: 1.7, tasks: { REASON: 0.5, CODE: 0.2, AGENCY: 0.1, PHYS: 0.2 }, theta: 0.5, R0: 0.15, p: 0.06, q: 1.4, alphaMax: 0.7, eta: 1.0, A0: 0.05 },
  { id: 'HEALTH', name: 'Healthcare', empPct: 13, wage: 1.1, tasks: { REASON: 0.3, SOCIAL: 0.25, PHYS: 0.45 }, theta: 1.5, R0: 0.55, p: 0.03, q: 0.8, alphaMax: 0.6, eta: 0.6, A0: 0.02 },
  { id: 'EDU', name: 'Education', empPct: 9, wage: 0.9, tasks: { SOCIAL: 0.45, REASON: 0.35, MEDIA: 0.2 }, theta: 0.5, R0: 0.45, p: 0.04, q: 0.9, alphaMax: 0.5, eta: 0.3, A0: 0.03 },
  { id: 'GOV', name: 'Government administration', empPct: 6, wage: 1.0, tasks: { REASON: 0.45, SOCIAL: 0.3, AGENCY: 0.25 }, theta: 0.5, R0: 0.5, p: 0.03, q: 0.8, alphaMax: 0.7, eta: 0.1, A0: 0.02 },
  { id: 'MIL', name: 'Military and defense industry', empPct: 2, wage: 1.1, tasks: { REASON: 0.25, CYBER: 0.15, AGENCY: 0.2, PHYS: 0.4 }, theta: 1.0, R0: 0.4, p: 0.03, q: 1.0, alphaMax: 0.6, eta: 0.2, A0: 0.01 },
  { id: 'MFG', name: 'Manufacturing', empPct: 8, wage: 1.0, tasks: { PHYS: 0.7, REASON: 0.15, CODE: 0.15 }, theta: 0.5, R0: 0.15, p: 0.04, q: 1.0, alphaMax: 0.9, eta: 0.3, A0: 0.01 },
  { id: 'LOG', name: 'Transport, logistics, warehousing', empPct: 6, wage: 0.9, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.4, p: 0.03, q: 0.9, alphaMax: 0.9, eta: 0.2, A0: 0.01 },
  { id: 'ENGY', name: 'Energy, utilities, construction', empPct: 7, wage: 1.1, tasks: { PHYS: 0.75, REASON: 0.15, AGENCY: 0.1 }, theta: 1.0, R0: 0.35, p: 0.02, q: 0.8, alphaMax: 0.8, eta: 0.5, A0: 0.01 },
  { id: 'SERV', name: 'Retail, hospitality, personal services', empPct: 22, wage: 0.6, tasks: { PHYS: 0.55, SOCIAL: 0.35, REASON: 0.1 }, theta: 0.5, R0: 0.15, p: 0.03, q: 0.8, alphaMax: 0.8, eta: 0.1, A0: 0.01 },
];

export const SECTOR_IDS: SectorId[] = SECTORS.map((s) => s.id);
/** US employment base (persons) used with empPct (research/16: ≈159M nonfarm + 1.3M military). */
export const US_EMPLOYMENT = 160e6;
/** Region scales relative to US (§3.11.3): ROW wage × 0.5, employment × 6; CN employment ≈ 4.6×. [D] */
export const REGION_SCALE = { US: { emp: 1, wage: 1 }, CN: { emp: 4.6, wage: 0.3 }, ROW: { emp: 6, wage: 0.5 } } as const;
