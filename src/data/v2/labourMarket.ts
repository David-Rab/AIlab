// The labour market's data (design/bal/LABOUR-ROUND.md §4 and §6; values and sources in design/bal/LABOUR-SOURCES.md §13,
// the designer's decisions of 2026-11-27 after it override the table where they differ). State only: the weekly
// behaviour (inflow, wage, matching, poaching) is departments/market.ts (L12). Confidence per constant: H high, M medium,
// L low (LABOUR-SOURCES.md §13 column "conf."). Tags: [D] = designer-set.
import type { TeamRole } from '../../engine/v2/types';

/** Kinds of labour: one pool per kind, shared by capabilities and safety staff (LABOUR-ROUND §4.1). */
export const LABOUR_KINDS: readonly TeamRole[] = ['eng', 're', 'sci'];

/** P0: everyone able to do the job, the whole US occupation, persons at the 2025 start [BLS OEWS May 2025: 15-1252 software
 *  developers, 15-2051 data scientists, 15-1221 computer and information research scientists; LABOUR-SOURCES §13].
 *  Confidence: eng H (L as frontier-able), re M (L on the mapping), sci H (M on the mapping). Designer accepted
 *  "pools = whole US occupations" (decision 1). */
export const P0: Record<TeamRole, number> = { eng: 1_687_890, re: 262_440, sci: 37_200 };

/** I: net inflow into each pool, persons per year (gross entrants less exits; the game has no exit flow from P)
 *  [BLS Employment Projections 2025-35, Table 1.10: eng gross 95,300 at exit 4.3%/yr, re 24,800 at 4.7%, sci 2,900 at 4.8%;
 *  LABOUR-SOURCES §13]. Confidence M. */
export const INFLOW: Record<TeamRole, number> = { eng: 17_480, re: 9_540, sci: 840 };

/** w0: the market wage at the 2025 start, $M per head-year. A pay ladder (designer decision 5): the existing relatives
 *  0.7 : 0.8 : 1.0 (research/19 §1.2, [D] from Levels.fyi) scaled so the headcount-weighted mean is the S-1's $1.15M
 *  [Anthropic S-1 §5.5 personnel expense / mean 2025 heads; LABOUR-SOURCES §13]. Level M, kind split [D]. */
export const W0: Record<TeamRole, number> = { eng: 0.86, re: 0.98, sci: 1.22 };

/** W_STAR0: a star's pay at the start, $M per year [D] designer-set (decision 6: "tens to hundreds of millions"; the lead's
 *  value is about the geometric middle). The earlier 2.0 (LCA base ceiling x S-1 loading) is retired. Confidence L. */
export const W_STAR0 = 50;

/** η: shape of the log-logistic reservation wages, wage = w0 x (E/U ratio)^(1/η) [Bound, Khanna & Morales 2017 fn 34;
 *  1.96-2.48; LABOUR-SOURCES §13]. Confidence M-L. */
export const ETA = 2.2;

/** ε: elasticity of hiring to the pay premium [Sokolova & Sorensen 2018/21 Table 1, recruitment median / 2; ABM 2022;
 *  0.7-2.4; LABOUR-SOURCES §13]. Confidence M-L. */
export const EPS = 1.7;

/** α: unemployed-side elasticity of the matching function [Petrongolo & Pissarides 2001 p. 424, total hires; 0.3-0.4;
 *  LABOUR-SOURCES §13]. Confidence M-L. */
export const ALPHA = 0.35;

/** f0: vacancy fill rate in the 2025 start state, hires per opening per month; sets the matching scale μ in L12
 *  [BLS JOLTS 2025, Information sector; DFH 2013 check; 7.4/yr; LABOUR-SOURCES §13]. Confidence M (L for labs). */
export const F0_PER_MONTH = 0.62;

/** q: separation rate, per year [BLS JOLTS 2025, Information quits; LABOUR-SOURCES §13; designer accepted 15.6%/yr,
 *  decision 5]. Confidence L-M. */
export const SEPARATION = 0.156;

/** T: years over which a head's pay moves to the market offer (contract renewal; LABOUR-ROUND §4.2 item 7, open question Q2)
 *  [D] designer: gradual, annual renewal. Every head's pay relaxes toward the offer at rate 1/T per year (continuous: after
 *  one year the gap has closed by 1 - e^-1 = 63%). */
export const PAY_RENEWAL_YEARS = 1;

/** A star is a researcher above this quantile of the researcher distribution [AIFM config.py:41 TOP_PERCENTILE = 0.999;
 *  LABOUR-SOURCES §13]. Confidence H. The star count is (1 - this) x P0.sci = 37 (derived). */
export const STAR_TOP_PERCENTILE = 0.999;

/** The stars' employers at the start, shares [Semantic Scholar top-25 cited NeurIPS/ICML/ICLR 2020-23, by paper
 *  affiliation: Google 0.24, OpenAI 0.20, Meta 0.12, Microsoft 0.04, outside 0.32, China 0.08; LABOUR-SOURCES §13].
 *  Confidence L. */
export const STAR_EMPLOYER0 = { google: 0.24, openai: 0.20, meta: 0.12, microsoft: 0.04, outside: 0.32, china: 0.08 } as const;

/** Which named lab each game lab stands for, in rank order (designer decision 4: the player is the leading lab and takes
 *  OpenAI's share). The player first, then the game's rivals in their order; a rival past the list, or a name with no rival
 *  to hold it, holds nothing (its share goes to "outside"). Mapping by rank is the lead's choice, not sourced. */
export const STAR_LAB_ORDER: readonly (keyof typeof STAR_EMPLOYER0)[] = ['openai', 'google', 'meta', 'microsoft'];

/** The pay-premium menu, share above the market wage [D] (LABOUR-ROUND §4.1: 0 / +10 / +25 / +50 / +100%). */
export const PREMIUM_STEPS: readonly number[] = [0, 0.10, 0.25, 0.50, 1.00];

/** Generated names for the stars (first + last), neutral and mixed in origin. [D] flavour. */
export const STAR_FIRST_NAMES: readonly string[] = [
  'Aiko', 'Amara', 'Andrei', 'Beatriz', 'Chen', 'Dara', 'Elena', 'Farid', 'Grace', 'Hana', 'Ibrahim', 'Ines', 'Jun',
  'Kavya', 'Leila', 'Mateo', 'Nadia', 'Omar', 'Priya', 'Quinn', 'Rafael', 'Sofia', 'Tomas', 'Uma', 'Viktor', 'Wei',
  'Xavier', 'Yara', 'Zoe', 'Arjun', 'Bianca', 'Caleb', 'Dmitri', 'Esther', 'Felix', 'Gita', 'Hugo', 'Imani', 'Jonas', 'Keiko',
];
export const STAR_LAST_NAMES: readonly string[] = [
  'Abara', 'Becker', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Gupta', 'Haddad', 'Ivanov', 'Jensen', 'Kim', 'Lindqvist',
  'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quispe', 'Rossi', 'Sato', 'Tanaka', 'Umeh', 'Varga', 'Wagner', 'Xu', 'Yilmaz',
  'Zhang', 'Almeida', 'Banerjee', 'Chowdhury', 'Dimitrov', 'Evans', 'Fontaine', 'Garcia', 'Holm', 'Ito', 'Joshi', 'Kowalski', 'Larsen', 'Mbeki', 'Novak',
];
