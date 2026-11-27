/**
 * Calibration-harness hooks (balance Stage 1, design/bal/STAGE1-DESIGN.md "Engine hooks"). Every field is undefined
 * in normal play and only scripts (scripts/v2/*) ever set one; with all fields undefined each reader below takes
 * exactly its old code path. Nothing in src/ writes this object.
 *
 *  - noDiffusion       no recipe diffusion between labs (rule A, production.ts productionSystem). Rule B
 *                      (distillation, actors/rivals.ts) is not covered.
 *  - computePath(yr)   total H100e of the reference lab at decimal year yr. Replaces refTotal (production/ces.ts) and
 *                      refTotalAt (compute/market.ts), so everything that reads the reference path follows it: the
 *                      leader lab, the finance autopilot's target and a stub like scripts/v2/lib.ts refComputeStub,
 *                      which feeds the player's lab. It is read in the reference function, not in a stub system, so
 *                      the player's lab and the market agree on one path.
 *  - staffPath(yr)     capabilities headcount multiplier vs 2025.5 (1 at 2025.5). hRef(yr) = H_REF_BASE × staffPath(yr)
 *                      (production/ces.ts), which sets the non-player labs' staff growth and the headcount RefBot
 *                      hires towards. A passive player does not hire, so its staff does not follow. The player's own staff
 *                      follows it only through the market: the harness sets the hiring targets and the pay premium with
 *                      the player's real actions (scripts/v2/botgame.ts ForcedStaff, L19); no engine exception.
 */
export const FORCING: {
  noDiffusion?: boolean;
  computePath?: (year: number) => number;
  staffPath?: (year: number) => number;
} = {};
