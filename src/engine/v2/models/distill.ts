// Distillation into mini variants (V2-SPEC §3.3.1; model v3 V1: design/MODEL-V3.md §4.5). Owner: WS1.
// The student's capability is the teacher's G minus the distillation gap (models/effective.ts distillGap, fitted to
// the DeepSeek-R1 distills, research/20 C4); its serving cost scales with its active parameters (runs.ts).
export { distillFlop, distillGap } from './effective';
export { DISTILL, STUDENT_DEFAULT } from '../../../data/v2/runDesign';
