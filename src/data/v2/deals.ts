// Strategic deal templates and debt instruments (V2-SPEC §3.7.4; research/15 §1.7). Owner: WS3.
// TODO(WS3, M1): transcribe terms (size ranges, strings, take-or-pay multiples) from research/15 §1.7.
import type { StrategicDeal } from '../../engine/v2/types';

export interface DealTemplate { id: StrategicDeal['template']; name: string; strings: StrategicDeal['strings'] }

export const DEAL_TEMPLATES: DealTemplate[] = [
  { id: 'hyperscalerEquity', name: 'Hyperscaler equity', strings: { observer: true, exclusivity: true } },
  { id: 'customASIC', name: 'Custom ASIC', strings: {} },
  { id: 'chipVendorEquity', name: 'Chip-vendor equity', strings: {} },
  { id: 'vendorFinance', name: 'Vendor financing', strings: {} },
  { id: 'sovereign', name: 'Sovereign', strings: { inCountrySite: true } },
  { id: 'spv', name: 'SPV', strings: {} },
  { id: 'neocloud', name: 'Neocloud take-or-pay', strings: {} },
  { id: 'megaJV', name: 'Mega-JV', strings: { boardSeat: true } },
];

export const PARTNERS = ['Northwind Cloud', 'Azimuth', 'Silica Systems', 'Gulf Sovereign Fund', 'Vantage Neocloud'];
