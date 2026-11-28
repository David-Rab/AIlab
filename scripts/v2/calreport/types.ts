/** One calibration target (scripts/v2/calreport.ts). */
export interface Target {
  /** Stable id, e.g. 'safety.refPmisAtAsi'. */
  id: string;
  /** What is measured, in words. */
  label: string;
  /** The sourced band, as text (e.g. '0.40–0.80'). */
  band: string;
  /** The value the current code gives, as text. */
  value: string;
  /** In band. */
  ok: boolean;
  /** Where the band comes from (doc § or paper). */
  source: string;
}
