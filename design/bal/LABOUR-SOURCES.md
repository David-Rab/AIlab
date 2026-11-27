# Labour sources (L10): the numbers the hiring market and stars need

Task L10 of design/bal/LABOUR-ROUND.md (§4 market, §6 stars, §8 S1–S11). Written 2026-11-27.
Rules: primary sources only (official statistics, filings, papers, AIFM code). Every value has a number, a unit, a source,
a translation and a confidence (H / M / L). UNSOURCED means no primary source was found. Secondary sources are flagged [SECONDARY].
Paper PDFs read as data: `.scratch/l10-dl/papers/` (Sokolova–Sorensen, Bound–Khanna–Morales, Petrongolo–Pissarides,
Davis–Faberman–Haltiwanger). Other figures were read on the official pages and API endpoints listed below.

## 0. Scope and kind mapping

- **Scope:** people a US lab can hire are the people working in the US in the occupation. OEWS counts every US job holder,
  visa holders included. The visa inflow is inside the inflow figures: BLS projections are of jobs, whoever fills them.
  As a check, nearly all new CS doctorates stay: 92.3% of CIS doctorates with definite plans stay in the US, and 89.7% of
  temporary-visa holders do (NSF SED 2024, Tables 9-5 and 6-3).
- **Kinds mapped to occupation codes** (2018 SOC, as used by BLS OEWS and Employment Projections):

| Game kind | SOC proxy | Why | Weak point |
|---|---|---|---|
| `eng` engineers (build work) | 15-1252 Software Developers | the build work is software engineering | covers the whole US industry, not only frontier-grade people |
| `re` research engineers (ML engineering) | 15-2051 Data Scientists | this code's O*NET definition is the one that names machine learning ("…and machine learning to extract and analyze information…", onetonline.org 15-2051.00); there is no ML-engineer code | many lab "research engineers" are coded 15-1252; the code also covers analytics work |
| `sci` research scientists | 15-1221 Computer and Information Research Scientists | the research-scientist occupation of computing | includes non-AI CS research; some lab scientists are coded under other occupations |

**Judgement call (designer):** each pool is a whole US occupation. No primary source narrows it to "frontier-grade" people.
In the §4.2 wage rule this matters little while E ≪ U: the wage then moves with E^(1/η), whatever P is. It does matter for
matching (U^α) and for the date depletion starts to bite.

## 1. S1: pool sizes P0 (May 2025)

Source: BLS OEWS, "Table 1. National employment and wage data from the OEWS survey by occupation, May 2025",
https://www.bls.gov/news.release/ocwage.t01.htm. May 2024 (USDL-25-0451, https://www.bls.gov/news.release/archives/ocwage_04022025.htm) for comparison.

| Kind | SOC | Employment May 2025 | May 2024 | Game P0 | Conf. |
|---|---|---|---|---|---|
| eng | 15-1252 | 1,687,890 | 1,654,440 | 1,687,890 | H for the count, L as "able to work at a frontier lab" |
| re | 15-2051 | 262,440 | 233,440 | 262,440 | M count, L mapping |
| sci | 15-1221 | 37,200 | 38,480 | 37,200 | H count, M mapping |

Translation: P0 = OEWS national employment, persons. Context: Statisticians (15-2041) 29,030, Physicists (19-2012) 20,430.
Neither is added: they are entrants, and the projections in S2 already count transfers into the occupation.

## 2. S2: inflow per year

The §4.2 pool has an inflow and no exit (`P += I ÷ 52`). Gross graduate counts would overstate its growth, because
people also retire or leave the occupation. The consistent source is BLS Employment Projections 2025–35, "Table 1.10
Occupational separations and openings", https://www.bls.gov/emp/tables/occupational-separations-and-openings.htm:

| Kind | Employment 2025 → 2035 (thousands) | Net growth / yr | Separations rate (exit + transfer) | Annual openings (gross entry) |
|---|---|---|---|---|
| eng 15-1252 | 1,717.8 → 1,892.6 | **17,480** | 4.3%/yr (1.4 + 2.9) | 95,300 |
| re 15-2051 | 275.6 → 371.0 | **9,540** | 4.7%/yr (1.7 + 3.0) | 24,800 |
| sci 15-1221 | 38.6 → 47.0 | **840** | 4.8%/yr (1.5 + 3.3) | 2,900 |

- **Game value:** I_k = net growth per year (bold), because the game has no exit from P. If the implementation adds an exit
  flow at the separations rate, use the gross openings instead. Unit: persons/yr. Confidence M. These are BLS's
  projections, not observed flows, and they include BLS's own view of AI demand.
- Cross-checks against graduates:
  - CS degrees in 2021-22 (NCES Digest 2023, Table 325.35, https://nces.ed.gov/programs/digest/d23/tables/dt23_325.35.asp):
    bachelor's 108,503, master's 51,338, doctor's 2,790. Nonresident shares: 9.9% (bachelor's), 44.6% (master's), 58.6% (doctor's) (Tables 322.30 / 323.30 / 324.25).
  - Research doctorates 2024 (NSF SED 2024, NSF 25-349, Table 1-3, https://ncses.nsf.gov/pubs/nsf25349/assets/data-tables/tables/nsf25349-tab001-003.pdf):
    CIS 2,982; maths and statistics 2,093; physics 1,794; electrical and computer engineering 2,576. Of CIS doctorates with
    definite employment plans, 63.0% go to industry (Table 9-5).
  - The sci openings (2,900/yr) are about one year's CS doctorates. That fits.
  - CRA Taulbee 2023 (https://cra.org/wp-content/uploads/2024/05/2023-CRA-Taulbee-Survey-Report.pdf, Table D4): AI/ML is
    477 of 1,678 PhDs with a known specialty (28%), and 278 of the 431 AI/ML graduates with known employment went to North
    American industry. This is a CRA survey report, used as primary survey data.

## 3. S3: AI-lab employment E0 at the start

§4.1 derives E each week from heads in the game (player + rivals + China). So E0 is the game's own start state, not a new
constant. The sourced numbers below check the requirement that "most of the pool is outside".

| Lab | Number | Source | Conf. |
|---|---|---|---|
| Player (frontier leader, the AIFM's leading company) | capabilities eng + RE = L_HUMAN(2025.5) = 1,640 (§9) → eng 579, re 1,061; sci 0.15/0.85 × 1,640 = 289 | AIFM input_data.csv; split from research/19 §1.1 (as LABOUR-ROUND §4.3) | H for the AIFM value; split [D] |
| Anthropic (rival) | ≈ 940 employees on 31 Dec 2024; ≈ 5,300 on 30 Sep 2026; headcount +≈170% from Sep 2025 to Sep 2026, so ≈ 1,960 on 30 Sep 2025 (derived). "A majority" work in research, engineering and product. | Anthropic PBC S-1 (EDGAR CIK 2130357), EEA-prospectus FWP 2026-11-12, §1.1.25 and §5.2.3, https://www.sec.gov/Archives/edgar/data/2130357/000162828026073040/anthropicpbc-fwpxeeaprospea.htm (text checked) | H (total heads); no split by function |
| Google DeepMind (rival) | Primary accounts not read: the Companies House PDF for DeepMind Technologies Ltd 07386350 (FY2024, FY2025) sits behind a redirect. [SECONDARY] The Register (2025-10-14) gives FY2024 staff cost £1.01bn at £264k per head, so ≈ 3,800 average heads. | https://find-and-update.company-information.service.gov.uk/company/07386350/filing-history | L |
| OpenAI (rival or player model) | UNSOURCED. The 990 covers only the nonprofit; no SEC filing was found; no official headcount. | tried: IRS 990 TY2024, EDGAR search, openai.com | — |
| China (DeepSeek, placeholder) | 150 research and engineering contributors (plus 31 data annotation, 18 business) on DeepSeek-V3 | arXiv 2412.19437, contributor list (research/19 §2.2) | M as a lower bound |

**Check:** US-lab technical heads number in the low tens of thousands at most, against eng + re pools of 1.95M (E/P ≲ 1%).
Scientists are the tight pool: the player's 289 plus a few rivals of similar size gives roughly 1,000–1,500 of 37,200 (3–4%).
"Most of each pool outside" holds. Game value: none (derived). The rivals' heads stay the placeholder paths (§4.2 item 2).

## 4. S4: wage w0 (2025, per head-year, total pay)

**Level (primary):** Anthropic S-1, §5.5 Results of Operations, personnel expense ($M) is 95 (2023), 454 (2024) and 1,839 (2025).
Footnote 1: these include stock-based compensation of $29M, $192M and $1.2B (same FWP URL, text checked).
- Translation: average 2025 headcount comes from a log-linear path through 940 (31 Dec 2024) and ≈ 1,963 (30 Sep 2025):
  growth 0.98/yr, mean over 2025 ≈ 1,600 heads. This implies ≈ 2,510 on 31 Dec 2025.
- Per head 2025: **total $1.15M = cash $0.40M + equity $0.75M**.
- Equity loading: SBC is 65% of the total, and total ÷ cash = 2.9.
- Caveats:
  - The figure covers all staff, so go-to-market and corporate staff pull it down.
  - The cash part includes benefits and payroll taxes.
  - SBC is a grant-date fair value at a fast-rising private valuation, so the realised value is higher.
  - Net: a moderate lower bound for technical staff.
- Confidence M.

Cross-checks:
- **Base pay offered on H-1B applications (LCA), 2025.** [SECONDARY mirror of the DOL file] h1bdata.info indexes DOL LCA data.
  - OpenAI OpCo LLC, 109 "Member of Technical Staff" records: median $325k (range $170k–$685k).
  - Anthropic PBC: Member of Technical Staff median $265k (84 records); Research Engineer median $215k (7 records).
  - The primary file is DOL OFLC LCA Disclosure Data FY2025 Q4,
    https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q4.xlsx. It was not processed: the file
    exceeds the fetch limit, and script downloads are not permitted here.
  - These base medians agree with the S-1 cash figure of $0.40M per head once benefits are added.
- **Big-tech equity per head, as a floor on the equity loading.** From the 10-K XBRL ShareBasedCompensation concept:
  - Alphabet FY2025: $24,953M ÷ 190,820 employees = $131k.
  - Meta FY2025: $20,427M ÷ 78,865 = $259k.
  - Sources: https://data.sec.gov/api/xbrl/companyconcept/CIK0001652044/us-gaap/ShareBasedCompensation.json and the same path for CIK0001326801.
- **The outside market.** These are the wages a frontier lab must beat. OEWS May 2025 mean / 90th-percentile annual wage:
  - Software developers $148,100 / $214,670.
  - Data scientists $126,800 / $199,130.
  - CIRS $153,930 / $230,630.
  - OEWS wages exclude non-production bonuses and stock (BLS OEWS technical notes).
  - In software publishers (NAICS 513200): CIRS mean $212,430, software developers $158,300.

**Per kind (judgement call):** no primary source splits lab pay by kind. OpenAI files every technical H-1B role as
"Member of Technical Staff", so the labs themselves price one technical title.
- Game value: **w0 = $1.15M for eng, re and sci alike**.
- Kind differences then emerge from each pool's depletion (§4.2 item 3).
- The kind relatives are UNSOURCED. Tried: LCA titles (one title), OEWS (an economy-wide relative, not lab pay), the S-1 (no split).
- Compare today's TEAM_COST_M of 0.7 / 0.8 / 1.0.

## 5. S5: η (how the market wage rises as AI labs draw down the pool)

Source: Bound, Khanna & Morales (2017), "Understanding the Economic Impact of the H-1B Program on the U.S.", NBER WP 23153,
p. 33, footnote 34: "Our estimated relative labor-supply elasticities lie between 1.96 and 2.48."
https://www.nber.org/papers/w23153. This is the elasticity of US computer scientists relative to non-CS college graduates,
with respect to the relative wage. It comes from a dynamic occupational-choice model calibrated to 1994–2001.
- Translation: the §4.2 rule is a log-odds supply, (E/U) ∝ w^η, so η is the elasticity of the odds of working in the sector
  with respect to the wage. BKM's relative supply elasticity has the same form (CS vs others).
- Game value: **η = 2.2** (midpoint; range 1.96–2.48). Confidence M-L.
- **Judgement call:** this applies an elasticity for "CS vs other college jobs" to "AI labs vs the rest of the occupation".
  The narrower choice is plausibly more elastic, so η could be higher.
- Consequence for the designer: while E ≪ U the wage grows as E^(1/2.2). Labs growing ×2.5/yr (the AIFM path) raise the
  market wage about ×1.5/yr.

## 6. S6: ε (how much a pay premium raises a firm's hires; also used for poaching)

Source: Sokolova & Sorensen, "Monopsony in Labor Markets: A Meta-Analysis", IZA DP 11966 (2018), published ILR Review 74(1)
27–55 (2021), https://docs.iza.org/dp11966.pdf.
- Table 1 (p. 11, 801 estimates) gives the firm-level supply elasticity, median / weighted median:
  - all estimates 1.27 / 1.56;
  - "direct" estimates 1.10 / 1.38;
  - recruitment-based estimates 3.41 / 2.13;
  - "Other advanced" economies (incl. the US) 1.17 / 1.47.
- Eq. (5)–(7), pp. 6–7: ε_firm = ε_R − ε_S. In steady state ε_S = −ε_R, so ε_firm = 2 ε_R.
- The published 2021 version uses 1,320 estimates. The numbers here are from the working-paper version, which was read.

Cross-check: Azar, Berry & Marinescu (2022), "Estimating Labor Market Power", NBER WP 30365, abstract: a firm-level labour
supply elasticity of 4.8 from US online job applications (CareerBuilder), and a market-level elasticity of 0.5. https://www.nber.org/papers/w30365

- Translation: the game's hires ∝ (1 + π)^ε is a recruitment elasticity, so ε = ε_firm ÷ 2.
- Recruitment-based median 3.41 → **ε = 1.7**. Range: 0.7 (all-sample weighted median 1.56 ÷ 2) to 2.4 (ABM 4.8 ÷ 2).
- The poaching share 1 − (1 + π)^(−ε) is a separation elasticity of the same size in steady state, so it uses the same ε.
- Confidence M-L: no estimate is specific to elite tech labour.
- Consequences:
  - +100% premium → ×3.2 hires.
  - Poach share: 32% of rival leavers at +25%, 69% at +100%.

## 7. S7: matching α and the 2025 vacancy filling rate (sets μ)

**α. Source:** Petrongolo & Pissarides (2001), "Looking into the Black Box: A Survey of the Matching Function", J. Econ.
Literature 39(2): 390–431, https://personal.lse.ac.uk/petrongo/jel-final.pdf.
- p. 393: "A plausible range for the empirical elasticity on unemployment is 0.5 to 0.7".
- Conclusions, p. 424: "In some of the estimates that use total hires as dependent variable (not only hires from
  unemployment) the coefficient on unemployment is lower, in the range 0.3–0.4". Constant returns hold.
- Translation: the game's U is the outside pool, nearly all of it employed elsewhere, and its hires are total hires
  (mostly job-to-job). The total-hires figure fits. Game value: **α = 0.35** (range 0.3–0.4; 0.5–0.7 if read as unemployment outflow).
- **Judgement call:** U is not unemployment; the coefficient is borrowed across that difference. Confidence M-L.

**Vacancy filling rate. Source:** BLS JOLTS 2025 annual tables, not seasonally adjusted (https://www.bls.gov/news.release/jolts.t15.htm through t22).
- Information (NAICS 51): average openings 121k, annual hires 903k, so hires per opening per month = 903 ÷ 12 ÷ 121 = **0.62**.
- Professional and business services: 0.82.
- Series JTU510000000000000JOR / HIR.
- Cross-check: Davis, Faberman & Haltiwanger (2013), QJE 128(2): 581–622, p. 591 (Section IV.D, Table III): the daily
  job-filling rate is "about 3% per day in Information" (5% in Professional & Business Services). That is a mean vacancy
  duration of ≈ 33 working days ≈ 1.3 months.
  - Caveat on the same pages: filling rates fall by more than half from small to large establishments.
  - Caveat (p. 590): 42% of hires take place at establishments with no reported vacancy, so hires per opening overstates the per-vacancy rate.
- Game value: **f0 = 0.62 per month = 7.4/yr** (mean vacancy duration ≈ 7 weeks) in the 2025 start state. μ follows by unit
  translation: μ = f0 × (V0/U0)^α. Confidence M for the industry, L for frontier labs (large employers, scarce skills: slower).

## 8. S8: separation rate

Source: BLS JOLTS 2025 annual tables (same URLs). Information: quits rate 1.3%/month (437k quits a year); total separations
2.8%/month, which includes layoffs. Professional and business services: quits 2.3%/month.
- Translation: game attrition is voluntary leaving, so it uses quits: 1.3% × 12 = **15.6%/yr** (vs today's ATTRITION_BASE 12%).
- Confidence L-M: these are industry-wide quits, not AI-lab staff.
- Not used: BLS Employment Projections' occupational separations (4.3–4.8%/yr). They count leaving the occupation, not the employer.
- Tried: Census LEHD Job-to-Job flows for NAICS 5112/5415/5417 (not queried in time) and lab filings (the S-1 gives no attrition figure in the parts read).

## 9. AIFM confirmations

- `L_HUMAN` (aifm-runs/repo `inputs/input_data.csv`, commit 1c40ecd):
  - Values are 1,037.5 at 2025.0 and 2,593.75 at 2026.0.
  - The AIFM interpolates log-linearly (`_log_interp`, progress_model/_impl.py:276), so 2025.5 = √(1037.5 × 2593.75) = **1,640.4**. Confirmed.
- `TOP_PERCENTILE = 0.999` (progress_model/config.py:41; `TOP_RESEARCHER_SD = 3.0902`, line 46). Confirmed.

## 10. S9: star pay and the poach gap

- Star pool (derived, §6.1): 0.001 × P_sci = 0.001 × 37,200 = **37 stars** at the start.
- **Star pay: UNSOURCED as total pay.**
  - Tried: OpenAI Inc. IRS Form 990 TY2023 and TY2024. Part VII lists only nonprofit officers and directors, with reportable
    compensation ≤ $0.33M. It names no researchers, so it is unusable
    (https://projects.propublica.org/nonprofits/organizations/810861541, hosting the IRS filing).
  - Tried: the LCA base pay ceiling. [SECONDARY mirror] OpenAI's maximum MTS base is $685k and Anthropic's maximum $690k. This is base pay only.
  - Court exhibits with pay data: not searched in the time.
- A derived placeholder (L): base ceiling $0.69M × the S-1 equity loading of 2.9 = **$2.0M/yr**. It is likely understated:
  star packages are mostly equity and negotiated.
- **Poach gap: UNSOURCED.** No primary source gives the premium needed to move a star between labs. Keep the C4 premium steps (§6.3).

## 11. S10: where stars work at the start

- **Method:** Semantic Scholar bulk search per venue (NeurIPS, ICML, ICLR), years 2020–2023, sorted by citation count, top 25
  papers merged. Query: `api.semanticscholar.org/graph/v1/paper/search/bulk?venue=…&year=2020-2023&sort=citationCount:desc`, run 2026-11-27.
- **Affiliations:** first and last author as printed on each paper. 14 were checked on the paper header via ar5iv; 11 have a
  single organisation on the header. That gives 50 author slots.
- **Result:**

| Employer | Slots | Share |
|---|---|---|
| US AI lab (all) | 30 | **0.60** |
| of which Google / DeepMind | 12 | 0.24 |
| of which OpenAI | 10 | 0.20 |
| of which Meta | 6 | 0.12 |
| of which Microsoft | 2 | 0.04 |
| US academia / other US (Berkeley, Stanford, UW, Princeton, Salesforce) | 16 | **0.32** |
| China (HKU, SenseTime) | 4 | **0.08** |
| Other abroad | 0 | 0 |

  If staff of US labs based abroad (Paris, London) count as abroad, the split is 0.52 / 0.32 / 0.08 / 0.08.
- **Caveats:**
  - Affiliations are at publication (2020–23), and many people have moved since, mostly toward OpenAI, Anthropic and xAI.
  - A citation top 25 over-weights famous lab papers.
- **Game value:** star employers at start: labs 0.60, outside 0.32, China 0.08. Confidence L.
- **Judgement call:** whether the player (the frontier leader) starts with its share of stars (the OpenAI share 0.20 → about 7 of 37) or with none.

## 12. S11: the player's safety staff at the start

No lab publishes a safety headcount. The best primary counts are contributor credits and statements by team leads:
- **OpenAI, o1 system card contributions** (5 Dec 2024, https://openai.com/openai-o1-contributions/): 70 name slots under safety headings:
  - Safety Leads 8, Safety Research 14, Safety Infrastructure 17, Preparedness Evaluations 17;
  - Internal Red Teaming 4, External Red Teaming 3, Safety Leadership 7.
  - Some names appear twice, so there are fewer than 70 unique people.
- OpenAI GPT-4o contributions (May 2024, https://openai.com/gpt-4o-contributions/): 46 names under "Preparedness, Safety, Policy".
- Anthropic Interpretability: "There are currently 18 members" (13 Jun 2024, https://www.anthropic.com/research/engineering-challenges-interpretability).
- Google DeepMind AGI Safety & Alignment: "anywhere between 30 and 50 is defensible" (team lead R. Shah, comment on
  https://www.alignmentforum.org/posts/79BPxvSsjzBkiSyTq, Aug 2024). The team grew 37–39%/yr.

Translation: the player is the AIFM's leading company, which the AIFM built from OpenAI staffing, so OpenAI's count applies.
- Game value: **≈ 70 safety staff at the start** (a lower bound: launch credits, not the whole organisation).
- The RE : scientist split is UNSOURCED (no lab publishes one). Keep SAF_ROLE_SHARE 90 : 50, which gives **45 re, 25 sci**.
  The o1 list's 17 "Safety Infrastructure" names may be engineering.
- Confidence L.
- **Judgement call:** 70 is far below research/19's 170 [Design] and below one 100-head RE team. With fixed team sizes the
  start cannot hold it exactly. Either the safety start is under one team, or team sizes stop being whole teams.

## 13. Final game values (copy into data/v2/labourMarket.ts)

| id | value | unit | source | conf. |
|---|---|---|---|---|
| P0.eng | 1,687,890 | persons | BLS OEWS May 2025, 15-1252 | H (L as frontier-able) |
| P0.re | 262,440 | persons | BLS OEWS May 2025, 15-2051 | M (L mapping) |
| P0.sci | 37,200 | persons | BLS OEWS May 2025, 15-1221 | H (M mapping) |
| I.eng | 17,480 | persons/yr (net; gross 95,300 with exit 4.3%/yr) | BLS EP 2025–35 Table 1.10 | M |
| I.re | 9,540 | persons/yr (net; gross 24,800, exit 4.7%/yr) | BLS EP 2025–35 Table 1.10 | M |
| I.sci | 840 | persons/yr (net; gross 2,900, exit 4.8%/yr) | BLS EP 2025–35 Table 1.10 | M |
| E0.player | eng 579, re 1,061, sci 289 (capabilities) | heads | AIFM L_HUMAN(2025.5) = 1,640 × research/19 split | H / [D] split |
| E0.rivals, E0.china | game start state (derived; checks in §3) | heads | Anthropic S-1; DeepSeek-V3 | — |
| w0.eng = w0.re = w0.sci | 1.15 (cash 0.40 + equity 0.75; equity loading 2.9×) | $M per head-year, 2025 | Anthropic S-1 §5.5 personnel expense ÷ mean 2025 heads | M (level), kind split UNSOURCED |
| eta (η) | 2.2 (1.96–2.48) | — | Bound, Khanna & Morales 2017 fn 34 | M-L |
| eps (ε) | 1.7 (0.7–2.4) | — | Sokolova & Sorensen 2018/21 Table 1 recruitment median ÷ 2; ABM 2022 | M-L |
| alpha (α) | 0.35 (0.3–0.4) | — | Petrongolo & Pissarides 2001 p. 424 (total hires) | M-L |
| f0 (sets μ) | 0.62 /month = 7.4 /yr | hires per opening | BLS JOLTS 2025, Information; DFH 2013 check | M (L for labs) |
| q (separation) | 0.156 | per yr | BLS JOLTS 2025, Information quits | L-M |
| L_HUMAN(2025.5) | 1,640.4 | heads | AIFM input_data.csv, log-interp | H |
| TOP_PERCENTILE | 0.999 | quantile | AIFM config.py:41 | H |
| stars.n0 | 37 | persons | 0.001 × P0.sci | derived |
| w_star | 2.0 (placeholder) | $M per yr | LCA base ceiling [SECONDARY] × S-1 loading | L / UNSOURCED |
| poachGap.star | UNSOURCED (use the C4 premium steps) | — | — | — |
| stars.employer0 | labs 0.60 (Google 0.24, OpenAI 0.20, Meta 0.12, MS 0.04), outside 0.32, China 0.08 | share | Semantic Scholar top-25 cited NeurIPS/ICML/ICLR 2020–23, paper affiliations | L |
| safety0.player | 70 (re 45, sci 25) | heads | OpenAI o1 contributions page (Dec 2024); split SAF_ROLE_SHARE | L |

## Designer decisions on the judgement calls (2026-11-27)
1. **Pools = whole US occupations: accepted** ("labour isn't a significant bottleneck", which the designer considers realistic).
2. **Wage growth from the sourced η (≈×1.5/yr on the AIFM staff path): accepted.**
3. **Team sizes change so the sourced start fits whole teams; no partially filled teams.** Lead's choice: engineers 100, research engineers 50, scientists 20 (the same sizes in safety). Start (rounded to whole teams): capabilities 6 eng (600; source 579), 21 RE (1,050; 1,061), 14 sci (280; 289); safety 1 RE (50; 45), 1 sci (20; 25).
4. **Starting stars: the player takes the leading lab's share** (0.20 × 37 ≈ 7).
5. **Separation 15.6%/yr accepted. NOT one wage:** a pay ladder engineer < research engineer < scientist < star at the start (before the market moves it). Lead's rule: keep the existing relatives 0.7 : 0.8 : 1.0 (research/19, [D] from Levels.fyi) and scale them so the headcount-weighted mean is the S-1's $1.15M → **engineer $0.86M, research engineer $0.98M, scientist $1.22M** per head-year. Each kind's market wage then moves on its own pool.
6. **Star pay at the start: tens to hundreds of millions per year** (designer), not the $2.0M placeholder. Lead's value: **$50M/yr** per star (about the geometric middle of the range), tagged [D] (designer-set), with the star wage then moving with the star pool like the others.
