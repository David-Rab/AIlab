# 22 - Demand anchors 2025-26: hours of use, consumers, tokens, revenue, spend, developers

Calibration research for the physical serving model (V4a, design/V3-BUILD.md "V4 notes"). V4a found the world's revenue
demand-bound. Sector adoption is fitted to *firm* adoption, so AI covers ~2% of work-hours in 2026. At $1.7-3.2 per
hour of use, the world market comes to ~$60B and the leader gets ~$20B (F7 band $36-54B). This file collects measured
demand quantities. It sets no revenue target. Written 2026-11-19 (task A1, design/V3-TASKS.md).

**Read with:** research/16 §1A and N2a (sectors, g_aug, Bick et al. 2024, BTOS), research/20 §D (FLOP/token, tokens per
task, list prices).

**Tags** (as research/20)
- **[P]**: primary source, fetched and checked this session (URL in §S).
- **[R]**: from a primary source, not fetched in full this session. This covers official pages seen only as search-engine
  excerpts (openai.com returns 403 to the fetcher) and figures recalled from earlier reading. Probably right; re-check
  before quoting in-game.
- **[UNVERIFIED]**: seen only secondhand (press, analysts, aggregators).
- **[D]**: my arithmetic from [P]/[R] numbers (shown).
- **[X]**: extrapolation beyond measured data.
- **[G]**: game recommendation, not a fact.

---

## 0. Summary table

| # | Quantity | Value | Unit / date | Source | Tag |
|---|---|---|---|---|---|
| 1a | US employed adults using genAI for work, past week | 28.2 → 39.2 | % of employed, Q3 2024 → Q2 2026 | Bick/Blandin/Deming RPS (FRED blog) | [P] |
| 1b | US work hours assisted by genAI (all workers) | 4.1 → 5.6 → 6.3 → 5.3 | % of all hours, Q3'24 → Q4'25 → Q2'26 → Q3'26 | RPS, FRED RPSGENAIASSISTWRKHRSALL | [P] |
| 1c | Assisted hours per user | ≈16 | % of a user's work hours (6.3 / 39.2) | [D] | [D] |
| 1d | Work hours saved (all workers) | 1.6 → 2.2 | % of all hours, 2024 → 2026 | RPS (FRED blog) | [P] |
| 1e | Hours saved per hour of use | 0.35-0.39 | h saved / h assisted (2.2/6.3; 1.6/4.1) | [D] | [D] |
| 1f | US firms using AI (BTOS, firm-weighted) | 18 (Dec 2025); 19.8 (May 2026) | % of firms | Fed FEDS Note; Census | [P] |
| 1g | Labour force at firms using LLMs (employment-weighted) | 54 (78 any AI) | % of workers, Nov 2025 | Atlanta Fed SBU via FEDS Note | [P] |
| 1h | ChatGPT Enterprise time saved | 40-60 (60-80 eng./data) | min per active day | OpenAI enterprise report Dec 2025 | [P] |
| 2a | Non-work share of ChatGPT consumer messages | 53 → 73 | %, Jun 2024 → Jun 2025 | Chatterji et al. NBER w34255 | [P] |
| 2b | Claude.ai personal + coursework share | 54 (42 + 12) | % of conversations, Feb 2026 | Anthropic Economic Index Mar 2026 | [P] |
| 2c | ChatGPT weekly active users | 700M (Jul 2025); >900M (Feb 2026) | WAU | NBER w34255; OpenAI | [P]; [R] |
| 2d | ChatGPT consumer subscribers | >50M | Feb 2026 | OpenAI "Scaling AI for everyone" | [R] |
| 2e | Paid share of ChatGPT WAU | ≈5.6 | % (50 / 900) | [D] | [D] |
| 2f | ChatGPT consumer messages | 451M → 2,627M | per day, Jun 2024 → Jun 2025 | NBER w34255 Table 1 | [P] |
| 2g | Messages per WAU per day | ≈3.75 | Jun 2025 (2,627M / 700M) | [D] | [D] |
| 2h | Gemini app MAU | 650M → 750M → 950M → 1B+ | Q3'25 → Q4'25 → Q2'26 → Q3'26 | Alphabet CEO remarks | [P] |
| 3a | Google first-party API tokens | 7 → 10 → 16 → 22 → 32 | B tokens/min, Q3'25 → Q3'26 | Alphabet CEO remarks | [P] |
| 3b | Google tokens, all surfaces | 980T (Jul 2025) → 1.3 quadrillion (Oct 2025) | per month | Alphabet Q3 2025 remarks | [P] |
| 3c | OpenAI enterprise reasoning tokens per org | ×320 | in 12 months to Nov 2025 | OpenAI enterprise report | [P] |
| 4a | Anthropic revenue | 0.386 / 4.585 / 33.2 | $B: FY2024 / FY2025 / 9M 2026 | Anthropic S-1 (Japan FWP) | [P] |
| 4b | Anthropic quarterly revenue | 1.4 → 17.0 | $B, Q3 2025 → Q3 2026 (+1,127%) | S-1 | [P] |
| 4c | Anthropic run-rate | 14 (Feb) → 47 (May) → ≈71 (Sep 30) → 81 (Oct 31) | $B, 2026 | Anthropic posts; S-1 | [P] |
| 4d | OpenAI annualized revenue | >20 (end 2025) | $B | Friar post, via press | [UNVERIFIED] |
| 4e | M365 Copilot paid seats | 15M (Jan 2026) → 30M+ (Jul 2026) | seats | Microsoft earnings | [P] |
| 4f | Gemini Enterprise paid seats | >8M | Feb 2026 | Alphabet Q4 2025 remarks | [P] |
| 4g | ChatGPT workplace seats / paying business users | >7M (Dec 2025) / >9M (Feb 2026) | seats | OpenAI | [P] / [R] |
| 5a | US enterprise genAI spend | 11.5 → 37 | $B, 2024 → 2025 | Menlo Ventures survey + model | [P] |
| 5b | US businesses paying for AI (Ramp) | 56.8 (+13.3 pp yoy) | % of Ramp firms, Oct 2026 | Ramp AI Index | [P] |
| 5c | AI spend per employee (paying firms) | median 16.3; top 10% 801; top 1% 10,199 | $/employee/month, Oct 2026 | Ramp AI Index | [P] |
| 6a | Developers using AI daily | 50.6 (2025) → 73 (2026) | % of respondents | Stack Overflow Dev Survey | [R] / [P] |
| 6b | Claude Code cost per developer | ≈13/active day; 150-250/month | $ | Claude Code docs (→ R20 D2) | [P] |
| 6c | GitHub Copilot | 4.7M paid (Jan 2026, +75% yoy); 50M users (Jul 2026) | | Microsoft earnings | [P] |
| 7 | Anthropic revenue growth vs US hours of use growth | ×12 vs ×1.3 | per year, 2025 → 2026 | [D] | [D] |

---

## 1. Hours of AI use per adopted work-hour

**Worker surveys (US).**
- **Bick, Blandin & Deming, Real-Time Population Survey (RPS)** [P]. This is a nationally representative online survey of
  adults 18-64, published on FRED and in the "Generative AI Adoption Tracker".
  - Past-week work users: 28.2% of employed (Q3 2024) → 39.2% (Q2 2026).
  - Hours assisted, all employed: 4.1% → 6.3% over the same period. The quarterly series reads 5.73 (Q3 2025),
    5.59 (Q4 2025), 5.97 (Q1 2026), 6.27 (Q2 2026) and 5.31 (Q3 2026).
  - Hours saved: 1.6% → 2.2% of all hours.
  - Measure: respondents report workdays of use and time per day in brackets. The series is the bracket midpoint and is
    zero for non-users.
  - The 2024 values were revised after a change in question order. The Feb 2025 post had 21.8% past-week users and a
    1.3-5.4% assisted-hours band; the revised 28.2% supersedes it.
- **Intensity among users (pooled Aug and Nov 2024)** [P]:
  - 31.9% of past-month users used it ≥1 h per workday, and 47.0% used it 15-59 min.
  - 9% of all workers used it every workday; 14% on some days.
  - Time saved by past-week users: ≥4 h/week 20.5%, 3 h 20.1%, 2 h 26.4%, ≤1 h 33.0%. The mean is 5.4% of their hours
    (2.2 h of a 40-h week).
  - The authors' implied gain per hour of use is ~33%.
  - By industry: information 14.0% of hours assisted and 2.6% saved; leisure 2.3% and 0.6%.
  - By occupation: computer/math ~12% of hours assisted.
  - Q2 2026 by industry: professional/scientific/technical 11.4%, finance and insurance 9.7%, production occupations 4.6%
    (FRED search excerpts) [R].
- **Fed FEDS Note (Allen, Apr 2026)** [P], pulling three surveys together:
  - **RPS:** 40.7% of the workforce use genAI for work (Nov 2025, +9.7 pp yoy). 12% use it daily and 35.2% at least once
    last week. Non-work use: ~50% of the population (+10.4 pp yoy).
  - **SBU (Atlanta Fed, executives, employment-weighted):**
    - 78% of the labour force works at firms that have adopted AI; 54% at firms using LLMs. Equal-weighted: 69.4% and
      46.4%.
    - Intensity: 35% use AI up to 1 h/week and 29% 1-5 h/week.
  - **BTOS (Census, firm-weighted):** 18% of firms at Dec 2025.
    - 1-49-employee firms are 95% of firms but only 26.6% of employment; 250+ firms are 0.9% of firms and 56.2% of
      employment.
    - Firm-weighted adoption therefore understates the share of workers whose employer uses AI.
- **Census BTOS** [P]:
  - 17-20% of firms, Dec 2025 to May 2026; 19.8% on 3 May 2026.
  - By size: 250+ employees 37%, 100-249 employees 32%.
  - By sector: Information 39.7%, Finance 33.9%, Retail ~14%.
  - The question changed in Nov 2025 from "producing goods or services" to "any business function".
  - Later readings (21.7% Jul 2026; 23.8% late Aug to early Sep 2026) come via press [UNVERIFIED].
- **Gallup (Aug 2026, n = 21,648 employed)** [P]: 53% use AI at work at least a few times a year, 32% a few times a week
  or more, and 16% daily.
- **OpenAI, "State of Enterprise AI" (Dec 2025; 9,000 workers at ~100 enterprises plus usage data)** [P]:
  - Time saved: 40-60 min per *active day*; 60-80 for data science, engineering and communications. Heavy users report
    >10 h/week.
  - Frontier workers (95th percentile) send 6× the median worker's messages; frontier firms send 2× messages per seat.
  - Workers who use ~7 task types report 5× the time saved of narrow users.
- **Denmark (Humlum & Vestergaard)** [R, → 16 N2a]: users self-report ~2.8% of hours saved, and earnings effects are
  precise zeros. The Mar 2026 revision is retitled "Still Waters, Rapid Currents" (not re-read).

**Derived ratios [D].**
- **Hours of use per worker who uses AI at work** = 6.3 / 39.2 ≈ **16% of their work hours** (≈ 6.4 h/week at 40 h).
  - In Q3 2026: 5.3 / ~40 ≈ 13%.
  - SBU's 1-5 h/week bracket and Gallup's 16% daily users fit this: a minority of daily heavy users makes up most of the
    hours.
- **Use hours ÷ adoption shares** (2026):
  - Ratio to worker use (39%): 0.16 of a user's hours.
  - Ratio to employment-weighted LLM adoption (54%): 6.3 / 54 ≈ 0.12 of the hours of every worker at an adopting firm.
  - Ratio to firm-weighted BTOS (18-20%): 6.3 / 19 ≈ 0.33. The game's current fit sits here, but the denominator is
    wrong (see below).
- **Hours saved per hour of use** = 2.2 / 6.3 = **0.35** (2026); 1.6 / 4.1 = 0.39 (2024). The authors' own figure is
  ~0.33.
  - The OpenAI Enterprise figure of 40-60 min saved per active day is the same order. At ~1.5-2.5 h of use per active
    day it gives ~0.3-0.5 [D].
- **Game comparison:**
  - The game has ~2% of work-hours covered in 2026. The US data say **5.3-6.3%** of hours are AI-assisted, ≈3× the game.
  - The game values an hour of use at wage × (α + (1 − α)·g_aug). With α ≈ 0.45 and g_aug 0.3 that is ≈ 0.6 h saved per
    hour of use; the measured value is ~0.35.
  - Product, hours saved as a share of all hours: game ≈ 2% × 0.6 = 1.2%; data **2.2%** [D].
- **US hours** [D]: ~163M employed × ~1,750 h ≈ 2.85e11 work-hours/yr; 6% → ≈ 1.7e10 AI-assisted hours/yr. At the game's
  $1.7-3.2 per hour of use, that is $29-55B/yr from US human-attended work alone.

**Game-ready (1) [G]:**
- Hours of use = 0.13-0.16 × the work-hours of workers who use AI (~40% of US workers in 2026). Equivalently, ~6% of all
  US work-hours: range 5-6.5% in 2026, 4% in late 2024.
- Fit adoption to **employment-weighted or worker-level** use (40-54%), not to BTOS firm counts (18-20%).
- Hours saved per hour of use = 0.35 (0.3-0.4) in 2025-26. This is the value side's measured anchor; it should rise as
  α grows.

---

## 2. Non-work and prosumer use

- **ChatGPT consumer plans (Free, Plus, Pro; Chatterji, Cunningham, Deming et al., NBER w34255, Sep 2025)** [P]:
  - Daily messages: 451M (Jun 2024: 53% non-work) → 2,627M (Jun 2025: 1,911M non-work = **73%**, 716M work).
  - Non-work grew faster within every sign-up cohort.
  - WAU: 700M+ (end Jul 2025), ~10% of world adults; 18B messages/week.
  - Topics (Jul 2025): Practical Guidance ~29%, Writing 24% (36% a year earlier), Seeking Information growing. These
    three make up ~77%.
  - Programming is 4.2% of messages; companionship/relationships 1.9%.
  - Work messages are 40% Writing; 56% of work messages are "Doing".
- **Anthropic Economic Index** [P]:
  - Claude.ai personal use rose from 35% to 42% of conversations and coursework fell from 19% to 12% (Nov 2025 → Feb
    2026). Work therefore ≈ 46% in both [D].
  - Personal use of chat and Cowork runs ~35% on weekdays and just under 50% at weekends (Jun 2026).
  - Computer and mathematical tasks are 35% of Claude.ai conversations.
  - The Claude.ai average task wage fell from $49.3/h to $47.9/h as use diversified.
  - Opus serves 51% of paid Claude.ai usage.
- **Population (RPS via FEDS Note)** [P]: non-work genAI use ~50% of US adults (Nov 2025) vs work use 41% of the
  workforce.
- **Subscribers and users (official):**
  - OpenAI: >900M WAU, >50M consumer subscribers and >9M paying business users (Feb 2026) [R, official page via search
    excerpt].
  - OpenAI earlier: 800M WAU at DevDay, Oct 2025 [R]. 1.2B WAU (Sep-Nov 2026) is reported only by press [UNVERIFIED].
  - Google: Gemini app 650M MAU (Q3 2025) → 750M (Q4 2025) → 950M with daily actives ~×3 yoy (Q2 2026) → 1B+ (Q3 2026)
    [P]. AI Mode >1B MAU (Q2 2026) [P].
  - Google paid subscriptions, all consumer services, mostly YouTube and Google One: 300M → 325M → 350M (Q3 2025 → Q1
    2026) [P]. AI plans are not broken out.
  - Microsoft: consumer Copilot app daily users ×3 yoy (Jan 2026) [P]. 900M MAU of "AI features" (Oct 2025) appears
    only in a transcript reproduction [UNVERIFIED].
  - Meta AI: ~1B MAU (2025 earnings) [R].
- **Free-to-paid** [D]: ChatGPT 50M / 900M = **5.6%** of WAU pay (Feb 2026). The game uses 5%, which fits.
- **Prices** (list, Nov 2026):
  - Claude [P]: Pro $20/mo ($17 on annual billing), Max $100, Ultra $200, Team $25/$125 per seat (monthly billing).
  - ChatGPT [R]: Plus $20, Pro $200, plus a low tier (Go).
- **ARPU** [X]: the mix of $8-20 tiers plus a few $100-200 tiers gives an average of ~$20-25 per paying consumer per
  month. On that basis, OpenAI's consumer subscriptions are ≈ 50M × $22 × 12 ≈ **$13B/yr** at Feb-2026 stock [D/X].
  No official ARPU found.
- **Messages per user** [D]: 2,627M / 700M ≈ **3.75 messages per WAU per day** (Jun 2025). Messages per WAU grew within
  every cohort (NBER Fig. 5).

**Game-ready (2) [G]:**
- Non-work share of consumer chat = 0.55-0.75: ChatGPT 0.73; Claude.ai, a more work-heavy user base, 0.54.
- Consumer reach: one provider alone reached 13-17% of world adults weekly in 2025-26 (ChatGPT; Gemini ≈ the same in
  MAU). Paid share 5-6%; ARPU $20-25/month.
- A consumer stock of 50M paying users at the leader → ~$13B/yr. This is a separate revenue line from work hours.

---

## 3. Token volumes

- **Google:**
  - First-party models via direct API: 7B tokens/min (Q3 2025) → >10B (Q4 2025) → >16B (Q1 2026) → ~22B (Q2 2026) →
    ~32B (Q3 2026) [P]. That is +40% q/q and >4× yoy in Q3 2026.
  - 32B/min ≈ **46T tokens/day ≈ 1.4 quadrillion/month** on the API alone [D].
  - All surfaces: 480T/month (May 2025, I/O) [R] → 980T (Jul 2025) → >1.3 quadrillion (Oct 2025) [P], ">20× in a year".
  - Customers: 330 processed >1T tokens each in the past 12 months (Q1 2026) and ~500 (Q2 2026). More than 2,000
    processed >100B (Q2 2026) [P].
- **OpenAI:**
  - API 6B tokens/min at DevDay, Oct 2025 [R]. No official 2026 figure found.
  - Enterprise (Dec 2025) [P]: >9,000 organisations processed >10B tokens each and ~200 processed >1T. Reasoning tokens
    per organisation rose ~×320 in 12 months. Enterprise messages ×8 since Nov 2024, +30% per worker.
- **Microsoft** [P]: Foundry customers at a ≥1T-token annualised run-rate ×4 yoy (Jul 2026); no total disclosed.
  Microsoft's last total was ">100T tokens in the quarter" (Apr 2025) [R].
- **DeepSeek** (Feb 2025, whole service) [P, → R20 D2]: 608B input + 168B output tokens/day.
- **Anthropic:** no token totals disclosed in the S-1 sections read.
  - Claude Code sessions are served by Opus 54% of the time vs 10% for chat (AEI Jun 2026) [P].
  - Building apps uses >3× the median tokens per conversation [P].
- **Tokens per active user-day:** not disclosed by anyone.
  - Consumer chat estimate: 3.75 messages/day × ~2-5k tokens incl. context (R20 D2: a 3k/0.8k turn) ≈ **8-20k tokens per
    WAU-day** [X].
  - The game's free user at 1.3k/0.3k a day looks ~5× low. Its paying user at 30k/8k is plausible.
  - Developers: ~10-20M cache-read + 0.1-0.3M output tokens per Claude Code developer-day [D, R20 D2].
- **API vs consumer split:** not disclosed by token. By revenue, Anthropic's consumption (API and usage) is ~79% of 9M 2026
  revenue and subscriptions 21% (press reading of the S-1 MD&A) [UNVERIFIED]. The S-1 text read here says only
  "primarily consumption-based" [P].

**Game-ready (3) [G]:**
- Provider API token volume grows ×4-5 per year (Google 2025 → 26). All-surface volume grew ×20 in the year to Oct 2025,
  driven by search surfaces.
- Consumer chat: ~10k tokens per WAU-day (5-20k).
- Token *intensity* per hour of use must grow ~×3-5 per year for revenue to grow ×10 while human hours grow ×1.3 (§7).

---

## 4. Disclosed revenue and run-rate of frontier labs

**Anthropic (S-1 via the Japanese-offering FWP of 12 Nov 2026, and official posts)** [P]:

| Period | Revenue ($B) | Compute & infrastructure ($B) |
|---|---|---|
| FY2023 | 0.041 | 0.433 |
| FY2024 | 0.386 | 2.522 |
| FY2025 | 4.585 | 7.326 |
| 9M 2025 | 2.545 | 4.381 |
| 9M 2026 | 33.242 | 18.808 |
| Q3 2025 / Q3 2026 | 1.4 / 17.0 | +382% (Q3 yoy) |

- **Run-rate** = trailing 28-day consumption × 13 + monthly subscriptions × 12 [P].
  - $14B (12 Feb 2026), with Claude Code >$2.5B [P].
  - >$47B (May 2026) [P].
  - $65B (end Jul 2026) [UNVERIFIED].
  - ≈$71B (30 Sep 2026: $81B less the stated +$10B) [D].
  - **$81B (31 Oct 2026)** [P].
- **Growth:** quarter-on-quarter revenue +48% (Q4 2025) and **+132%** (Q1 2026) [P].
- **Customers:** customers with ≥$100k trailing revenue rose from >950 to >11,900 (Sep 2025 → Sep 2026). There are
  >1,900 at ≥$1M and ~250 at ≥$10M. Net revenue retention is ~900% [P].
- **Channels:** cloud-provider marketplaces were 47% of FY2025 revenue and 44% of 9M 2026. The top 5 customers are ~25%;
  government <2% [P].
- **Per user:** Claude Enterprise users who do not use Claude Code spend **<$75/month** on average. The top 5% of Claude
  Code users spend ~20× that, ≈ $1,500/month [P; D].
- **Margins** [P]: Q3 2026 operating margin −3% and adjusted 15%; 9M 2026 adjusted operating income $4.1B (12%).
- **Calendar-2026 estimate** [X]: Q4 at the October rate is ≈ $6.75B/month × 3 ≈ $20-23B, so CY2026 ≈ **$53-56B**. That
  sits at the top of the game's F7 band ($36-54B).

**OpenAI:**
- Annualized revenue >$20B in 2025 (vs $6B in 2024); compute 1.9 GW (CFO post, Jan 2026) [UNVERIFIED, press quoting the
  post].
- Run-rate ~$25B (Feb 2026) and ~$50B (end Sep 2026); ads ~$1B annualised (Aug 2026) [UNVERIFIED].
- Seats: >1M business customers and >7M ChatGPT workplace seats; Enterprise seats ~×9 yoy (Dec 2025) [P]. More than 9M
  paying business users (Feb 2026) [R].

**Microsoft:**
- Paid M365 Copilot seats: 15M (Jan 2026) → **>30M** (Jul 2026), with net adds more than doubling q/q [P].
- GitHub Copilot: 4.7M paid subscribers (Jan 2026, +75% yoy) [P].
- Foundry: 100k customers (Jul 2026) [P].
- No new seat count in Oct 2026 [UNVERIFIED]. Azure +48% (FY27 Q1) [UNVERIFIED].

**Google:**
- Gemini Enterprise: >8M paid seats (Feb 2026); paid MAU +40% q/q (Apr 2026) [P].
- Cloud revenue: +48% (Q4 2025), +63% (Q1 2026, >$20B in the quarter), +82% (Q2 2026), +103% (Q3 2026) [P].
- Backlog: $155B (Q3 2025) → $240B → >$460B → $514B (Q2 2026) [P].
- Revenue from products built on Google's genAI models: +200% yoy (Q3 2025) → "nearly 800%" yoy (Q1 2026) [P].

**Seat prices:**
- Claude [P]: Enterprise $20/seat/month (annual, 20-seat minimum) + usage at API rates; Team $20/$25 (standard) and
  $100/$125 (premium).
- Others [R]: M365 Copilot $30/user/month; ChatGPT Business ~$25-30.

**Market size [D/X]:**
- Disclosed paid seats by mid-2026: M365 Copilot 30M + ChatGPT ~10M + Gemini 8M+ + Claude (undisclosed) ≈ **≥50M**.
- At $20-30 per seat that is ≈ $12-18B/yr.
- Frontier-lab model revenue in CY2026 ≈ Anthropic ~$55B + OpenAI ~$35-45B [X] + Google/Microsoft first-party model
  revenue (not disclosed) ≈ **$100-130B**, vs the game's ~$60B world.

**Game-ready (4) [G]:**
- Leader revenue CY2026 ≈ $55B (Anthropic, [X] from [P]); run-rate exit ~$80-90B. The second lab is ~0.7× the leader.
- Split for a business-led lab: ~80% consumption (API, usage-billed agents) and ~20% subscriptions [UNVERIFIED].
- About 45% of revenue comes through cloud marketplaces [P].
- Enterprise seats ≈ 50M paid worldwide in mid-2026, doubling every ~6 months (Microsoft).

---

## 5. Firm spend on AI

- **Ramp AI Index (card and bill-pay data, >85,000 US businesses; paid transactions only)** [P]:
  - 56.8% of businesses pay for AI (Oct 2026), +13.3 pp yoy (≈43.5% in Oct 2025 [D]).
  - By provider: Anthropic 44.8%, OpenAI 40.6%.
  - Token spend share (week to 15 Nov 2026): Anthropic 58.7%, OpenAI 37.2%.
  - **Spend per employee, paying firms (Oct 2026):** median $16.32/month; top-10% group median $800.84; top-1% group
    $10,199.
  - This heavy tail is the agent and API buyer. The median firm spends ≈ one seat per 1.5 employees.
- **Menlo Ventures (495 US enterprise decision-makers, Nov 2025, plus a bottom-up model; excludes chips, inference
  serving and AI features inside existing software)** [P]:
  - Enterprise genAI spend: **$37B in 2025** vs $11.5B in 2024 (×3.2), ~6% of global SaaS.
  - Infrastructure $18B: foundation-model APIs $12.5B, training infrastructure $4.0B, data and orchestration $1.5B.
  - Applications $19B: horizontal $8.4B, departmental $7.3B (coding **$4.0B**, up from ~$0.55B), vertical $3.5B.
  - Enterprise LLM API share: Anthropic 40%, OpenAI 27%, Google 21%.
  - Caveat: a vendor-adjacent survey; methodology is published.
- **Per worker [D]:**
  - $37B ÷ ~65M US knowledge-and-office workers ≈ $570/yr ≈ $47/month (2025).
  - Ramp's median $16/month per employee across all employees of paying firms is the same order.
- **Share of software budgets:** no primary figure found beyond Menlo's "6% of SaaS" (2025).

**Game-ready (5) [G]:**
- Firm AI spend per employee: median ~$15-20/month (seat-like), heavy tail to $800+ (top decile) and $10k (top 1%).
- The distribution should be lognormal-like, not one price per hour: ~20-30% of firms generate most of the token spend.
- US enterprise genAI spend in 2025: $37B (×3.2 yoy). Ramp paid adoption ~57% of firms in Oct 2026, +13 pp/yr.

---

## 6. Developers and coding agents

- **Stack Overflow Developer Survey**:
  - 2025 [R, official page via search excerpt]: 50.6% of professional developers use AI tools daily (n = 26,004); 84% use or plan to. Daily AI agent use is
    ~14% [UNVERIFIED, press].
  - 2026 [P]: **73%** use coding assistants and agents daily (n = 10,926). Claude Code is used by 66% of agent users and
    GitHub Copilot by 59%.
- **Claude Code:**
  - Docs [P, → R20 D2]: ≈ $13 per developer per active day; $150-250 per developer-month; <$30 a day for 90% of users.
  - Run-rate >$2.5B, more than doubled in Jan-Feb 2026 (12 Feb 2026); business subscriptions ×4 since the start of 2026;
    weekly active users ×2 since 1 Jan; 4% of GitHub public commits; enterprise >50% of Claude Code revenue [P].
  - Heavy users: the top 5% of Claude Code users spend ~$1,500/month [D from S-1].
- **GitHub Copilot** [P]: 4.7M paid subscribers (Jan 2026, +75% yoy); 50M users (Jul 2026).
- **Google** [P]: Antigravity >1.5M WAU (Feb 2026) → >2.4M (Jul 2026); >9M developers building monthly (Q2 2026).
- **OpenAI Codex** [P]: weekly active users ×2 and weekly messages +50% in the six weeks before Dec 2025. Later 4-8M WAU
  figures (2026) come from trackers [UNVERIFIED].
- **Developer-hours [D]:**
  - ~4.5M US software developers (BLS) [R] × 73% daily × ~2-4 h/day of agent use ≈ 1.5-3e9 h/yr in the US.
  - At $13/day ≈ $3-6 per developer-hour of use. That is above the game's $1.7-3.2 because agent sessions run with
    ≥90% cached context and long autonomous stretches.
  - Developers are ~3% of employment but ~10-20% of hours of use, and a larger share of tokens.

**Game-ready (6) [G]:**
- Software sector: daily use 50% (2025) → 73% (2026) of developers.
- Spend ~$150-250 per developer-month on average, with heavy users at ~$1,500.
- Tokens per developer-day 10-20M cache-read plus 0.1-0.3M output.
- Revenue per hour of use in SOFT ≈ 1.5-2× other sectors.

---

## 7. Growth 2025 → 2026 (for checking the dynamics)

| Quantity | 2025 | 2026 | Factor per year | Tag |
|---|---|---|---|---|
| US workers using AI at work (RPS) | 31% (Nov 2024) → 40.7% (Nov 2025) | 39.2% (Q2) | ×1.3 (2024→25), then flat | [P] |
| US hours assisted (RPS) | 5.7% (Q3) | 5.3% (Q3) / 6.3% (Q2) | ×1.0-1.15 | [P] |
| US hours saved | 1.6% (2024) | 2.2% | ×1.2 | [P] |
| Daily AI users at work (Gallup) | 12% (late 2025) | 16% (Aug 2026) | ×1.35 | [P]/[R] |
| BTOS firms | +68% (yr to Sep 2025, old question) | 17.7% → 21.7% (Jan → Jul) | ×1.2-1.4 | [P]/[UNVERIFIED] |
| Ramp paid firms | 43.5% (Oct) | 56.8% (Oct) | +13 pp | [P]/[D] |
| ChatGPT WAU | 700M (Jul) | >900M (Feb) | ~×1.5 | [P]/[R] |
| ChatGPT messages/day | 451M (Jun 2024) → 2,627M (Jun 2025) | n/a | ×5.8 (2024→25) | [P] |
| Gemini app MAU | 650M (Q3) | 1B+ (Q3) | ×1.55 | [P] |
| Google API tokens/min | 7B (Q3) | 32B (Q3) | ×4.6 | [P] |
| Anthropic quarterly revenue | $1.4B (Q3) | $17.0B (Q3) | ×12.3 | [P] |
| Anthropic run-rate | ~$5-9B (end 2025) [UNVERIFIED] | $14B (Feb) → $81B (Oct) | ~×6 in 8 months | [P] |
| Anthropic ≥$100k customers | >950 (Sep) | >11,900 (Sep) | ×12.5 | [P] |
| M365 Copilot paid seats | 15M (Jan 2026) | 30M (Jul 2026) | ×2 in 6 months | [P] |
| Google Cloud revenue growth | +48% (Q4 2025) | +103% (Q3 2026) | accelerating | [P] |
| US enterprise genAI spend (Menlo) | $11.5B (2024) | $37B (2025) | ×3.2 | [P] |
| Developers using AI daily (SO) | 50.6% | 73% | ×1.45 | [P] |

**Decomposition [D]:**
- Human-attended hours of use grew only ×1.0-1.3 in 2025-26 in the US.
- Lab revenue grew ×6-12. Spend per hour of use therefore rose ×5-10 per year, while list prices per token at the
  frontier *fell* ~×3.75 in 16 months (R20 D3).
- So tokens (or agent-work) per human-attended hour grew ~×15-30. This is consistent with Google API tokens ×4.6, OpenAI
  reasoning tokens per organisation ×320, and the hours-independent heavy tail in Ramp.
- Growth is in **intensity and machine-run work**, not in people or hours.

**Game-ready (7) [G]:**
- 2025 → 2026 targets: worker adoption ×1.0-1.3; human hours of use ×1.1-1.3; consumer WAU ×1.5; tokens ×4-5; leader
  revenue ×10 (calendar ~$4.6B → ~$55B).
- If the game's tokens per hour rise only through α (substitution share), it cannot reach ×10.

---

## What the game's world should contain

**Quantities the data fix (recommended value; range) [G]:**

1. **Hours of AI use per adopted work-hour.**
   - Count adoption per worker: ~40% of US workers in 2026 (range 35-45%); 28% in 2024.
   - Hours of use = **0.15 of each adopting worker's hours** (0.12-0.18), i.e. **~6% of all US work-hours** in 2026
     (5-6.5%).
   - Do not fit A to BTOS firm counts: they are firm-weighted and ~2-3× below employment-weighted adoption (SBU 54% LLM).
2. **Hours saved per hour of use** = 0.35 (0.3-0.4), measured for 2024-26. The game's α + (1 − α)·g_aug ≈ 0.6 is ~1.7×
   too high for today's augmented use. Let it rise with agency, but start near 0.35.
3. **Consumer chat:**
   - Non-work share 0.7 (0.55-0.75).
   - Reach of the leading provider ~15% of world adults weekly (13-17%); all providers ~50% of US adults use genAI
     outside work.
   - Paid share 5.5% (5-6%); ARPU $20-25/month.
   - 3.75 messages and ~10k tokens per WAU-day (5-20k).
   - Raise the free-user token use from 1.6k to ~8-10k/day.
4. **Subscriber stock:** the leader ~50M consumer subscribers in early 2026 (→ ~$13B/yr) [D/X].
5. **Enterprise seats:** ~50M paid seats worldwide mid-2026 (×2 per half-year), $20-30/seat/month. Average enterprise
   usage beyond the seat is ~$50-75/month for non-coding users.
6. **Developers:** 73% daily (2026); $150-250 per developer-month; heavy users ~$1,500.
7. **Firm spend distribution:** median ~$16 per employee-month, top decile ~$800, top 1% ~$10k. The tail (agents/API) is
   most of the dollars.
8. **Revenue checks:** leader CY2026 ~$55B (exit run-rate ~$80B); frontier-lab world ~$100-130B; US enterprise genAI
   2025 $37B; leader 2025 $4.6B (Anthropic) or ~$13-20B (OpenAI) [UNVERIFIED].
9. **Token growth:** API tokens ×4-5/yr; intensity per human hour ×15-30/yr over 2025-26.

**Design choices the data leave open [D]:**
- How machine-run agent work is denominated: agent-hours not tied to a human's hour, with parallelism k (agents per
  supervising human), or as "tokens per adopted task".
- The split of value between saved wages and new output (Jevons).
- Regional scaling of US hours to RoW and China. No primary hours series exists outside the US and Denmark.
- Whether the heavy tail is a firm type (frontier firms) or a product feature (coding agent ×2 tokens, deep research ×3).
- Consumer ARPU tiers and ads (OpenAI ads ~$1B annualised [UNVERIFIED]).
- How fast intensity keeps growing after 2026. The S-1 says run-rate growth "will decline over time" [P].

---

## Could not verify

- OpenAI's official revenue, run-rate and 2026 WAU: openai.com returns 403 to the fetcher, and figures beyond the Feb 2026
  "Scaling AI for everyone" excerpt are press only.
- Anthropic's consumption/subscription split and any consumer subscriber count. The MD&A was not in the readable FWP; the
  full S-1/A exceeds the fetch limit.
- Any provider's tokens per user-day, and the API vs consumer split of tokens.
- BTOS after May 2026 (press only).
- Microsoft's seat count after Jul 2026.
- Primary hours-of-use data outside the US.

## S. Sources (fetched this session unless tagged [R])

**Workers and firms**
- FRED Blog (Aug 2026). Does generative AI save time at work? https://fred.stlouisfed.org/blog/2026/08/does-generative-ai-save-time-at-work/
- FRED series RPSGENAIASSISTWRKHRSALL (work hours assisted, employed adults). https://fred.stlouisfed.org/series/RPSGENAIASSISTWRKHRSALL
- Bick, Blandin, Deming (St. Louis Fed, Feb 2025). The Impact of Generative AI on Work Productivity. https://www.stlouisfed.org/on-the-economy/2025/feb/impact-generative-ai-work-productivity
- Allen (Apr 2026). Monitoring AI Adoption in the U.S. Economy. FEDS Notes. https://www.federalreserve.gov/econres/notes/feds-notes/monitoring-ai-adoption-in-the-u-s-economy-20260403.html
- US Census Bureau (May 2026). Large Firms With at Least 20 Employees Biggest AI Users. https://census.gov/library/stories/2026/05/ai-use-businesses.html
- Gallup (2026). AI is changing how employees spend time at work. https://www.gallup.com/workplace/716585/ai-changing-employees-spend-time-work.aspx
- OpenAI (Dec 2025). The State of Enterprise AI 2025 Report (PDF). https://cdn.openai.com/pdf/7ef17d82-96bf-4dd1-9df2-228f7f377a29/the-state-of-enterprise-ai_2025-report.pdf
- Humlum & Vestergaard. Large Language Models, Small Labor Market Effects (NBER w33777); rev. Mar 2026 "Still Waters, Rapid Currents" https://www.rfberlin.com/wp-content/uploads/2026/03/26078.pdf [R]

**Consumers and usage**
- Chatterji, Cunningham, Deming, Hitzig, Ong, Shan, Wadman (Sep 2025). How People Use ChatGPT. NBER w34255. https://www.nber.org/system/files/working_papers/w34255/w34255.pdf
- Anthropic Economic Index, March 2026 report. https://www.anthropic.com/research/economic-index-march-2026-report
- Anthropic Economic Index, June 2026 report. https://www.anthropic.com/research/economic-index-june-2026-report
- OpenAI (Feb 2026). Scaling AI for everyone. https://openai.com/blog/scaling-ai-for-everyone [R: search excerpt, page 403]
- Claude pricing. https://claude.com/pricing (as of 2026-11-19)

**Providers' disclosures**
- Alphabet Q3 2025 CEO remarks. https://blog.google/inside-google/message-ceo/alphabet-earnings-q3-2025/
- Alphabet Q4 2025 CEO remarks. https://blog.google/inside-google/message-ceo/alphabet-earnings-q4-2025/
- Alphabet Q1 2026 CEO remarks. https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q1-2026/
- Alphabet Q2 2026 CEO remarks. https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/
- Alphabet Q3 2026 CEO remarks. https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q3-2026/
- Microsoft FY26 Q2 earnings call. https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q2
- Microsoft FY26 Q4 earnings call. https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q4
- Anthropic (Feb 2026). Series G. https://www.anthropic.com/news/anthropic-raises-30-billion-series-g-funding-380-billion-post-money-valuation
- Anthropic (May 2026). Series H. https://www.anthropic.com/news/series-h
- Anthropic, PBC. Free-writing prospectus (Japanese offering, incl. Part II company overview and business), 12 Nov 2026. https://www.sec.gov/Archives/edgar/data/2130357/000162828026073045/anthropicpbc-fwpjapanamend.htm
- Anthropic, PBC. S-1 and S-1/A filings (file no. 333-299633), index. https://www.sec.gov/Archives/edgar/data/2130357/000162828026074338/ [R: main document over the fetch limit]

**Spend and developers**
- Ramp AI Index. https://ramp.com/data/ai-index (Oct 2026 data)
- Menlo Ventures (Dec 2025). 2025: The State of Generative AI in the Enterprise. https://menlovc.com/perspective/2025-the-state-of-generative-AI-in-the-enterprise/
- Stack Overflow Developer Survey 2025, AI. https://survey.stackoverflow.co/2025/ai [R: via search excerpt]
- Stack Overflow Developer Survey 2026, AI. https://survey.stackoverflow.co/2026/ai
- Claude Code: Manage costs. https://code.claude.com/docs/en/costs (→ R20)
