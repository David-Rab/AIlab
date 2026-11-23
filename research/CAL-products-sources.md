# CAL-products-sources: sourcing the products stand-ins (calibration step 1)

Scope: the product numbers that REVIEW-FIXES.md "Deferred to calibration" and review/products.md F1, F5, F9 kept as
stand-ins. These are primary sources only (papers, government sites, official program docs, vendor docs and pricing,
company reports). The code comment for each number points to its ID here. Confidence: H = a measured value of the same
quantity; M = a close proxy; L = an analogue or a bound.

## Tools (data/v2/features.ts)

**T1. Computer use, 0.15 (GUI-only share of Office, Finance, Legal and Government tasks). Kept, [D stand-in].**
- No primary source splits tasks into "needs a GUI" and "an API can do it".
- Upper bound: Eloundou, Manning, Mishkin, Rock, "GPTs are GPTs" (arXiv 2303.10130; Science 2024).
  - E1 is direct exposure ("via ChatGPT ... decrease the time ... by at least half").
  - E2 covers tasks where "additional software could be developed on top of the LLM", which includes retrieval, long
    documents, internal data and images.
  - Table 3, task-level mean (human / GPT-4 ratings): α (E1) 0.15 / 0.14, ζ (E1 + E2) 0.47 / 0.56.
  - Group gaps ζ − α (human ratings) come from https://github.com/openai/GPTs-are-GPTs data/occ_level.csv, as unweighted
    occupation means. SOC 43 Office/Admin is 0.43; SOC 13 Business/Finance about 0.53; SOC 23 Legal 0.63.
- GUI work is only part of E2, so 0.15 is plausible but has no source. Confidence on the bound: H. On 0.15: L.
- Secondary: Wang et al. 2026 (arXiv 2603.01203) has an LLM label O*NET tasks as digital or physical (Legal 70%
  digital). That split is digital vs physical, not GUI vs API.
- Player text now says "an assumed 13%".
- Computer use's +0.25 F is a definition, not a measurement: one of four affordances (code execution, internet, money,
  weights access), equally weighted. Kept, [D].

**T2. Voice & vision.**
- Chat appeal: 0.15 → **0.075 [P, M]**.
  - Source: Chatterji et al. 2025, "How People Use ChatGPT", NBER w34255 (https://www.nber.org/papers/w34255): "Multimedia
    grew from 2% to just over 7%, with a large spike in April 2025 after ChatGPT released new image-generation
    capabilities".
  - Multimedia covers Create an Image, Analyze an Image and Other Media. The unit is share of consumer messages.
  - An app without the tool loses those messages, so appeal is 1 / (1 − 0.07) ≈ 1.075.
  - Voice is not a separate topic: voice messages are classified by what they are about.
- Media sector, 0.15: kept, [D stand-in].
  - Eloundou et al. rate images (E3) but "combine E2 and E3 for all analyses", so there is no separate image number.
  - The Arts/Media gap ζ − α is about 0.37 (human), an upper bound.
- The two shares are now two typed effects on the feature: Chat 0.075 and MEDIA 0.15. Before, one shared value covered
  both.

**T3. Memory: horizon ×1.3, Chat appeal ×1.1 (share 0.1). Kept, [D stand-in]. Recommend deleting the appeal term.**
- No primary source measures what cross-session memory does to the time horizon or to an app's appeal.
- Closest: Agent Workflow Memory (arXiv 2409.07429): "improves the baseline results by 24.6% and 51.1% relative success
  rate on Mind2Web and WebArena". That is memory of task workflows and the unit is success rate, so it is neither
  cross-session user memory nor time horizon.
- The horizon effect has a mechanism (agents keep state across steps), so it stays as an assumption.
- The appeal term has neither a mechanism nor a source.
- Player text now says "both assumed".

**T4. Companion mode, Chat appeal: share 0.2 → 0.025 [P, H for general assistants].**
- NBER w34255: "only 2.4% of all ChatGPT messages are about Relationships and Personal Reflection (1.9%) or Games and Role
  Play (0.4%)".
- Anthropic, "How people use Claude for support, advice, and companionship", Jun 2025
  (https://www.anthropic.com/news/how-people-use-claude-for-support-advice-and-companionship):
  - "Only 2.9% of Claude.ai interactions are affective conversations"
  - "companionship and roleplay combined comprise less than 0.5% of conversations"
- 0.025 is the upper end, computed as 1 / (1 − 0.024). The share holds for general assistants. Dedicated companion apps
  are not in Chat, and no primary source gives their market share.
- The review recommended deleting the appeal term. Sourced, it is now ×1.025, almost nothing; deleting it is still the
  simpler choice (designer).
- Companion SYC ×1.5: kept, [D stand-in], already marked.
  - It stands for longer conversations per user. No primary ratio was found.

## Sector adaptations and certification (engine/v2/models/adaptations.ts)

**A1. ADAPT_COVER 0.15. Kept, [D stand-in].**
- No primary measure exists of the share of a sector's tasks that need the sector's own systems.
- Eloundou E2 (which includes "access to internal data") bounds it at 0.3–0.6 by sector.

**C1. CERT_DAYS 120 → 240 [P, M].**
- OpenAI: "ChatGPT Enterprise and API Platform" got "FedRAMP 20x Moderate authorization" on 27 Apr 2026
  (https://openai.com/index/openai-available-at-fedramp-moderate/). The AI prioritisation opened in Aug 2025
  (https://www.fedramp.gov/ai/), so about 8 months.
- FedRAMP Rev5: "Final authorization times were exceeding one year and at times approaching up to two years"
  (https://www.fedramp.gov/2025-09-30-fedramp-built-a-modern-foundation-in-fy25-to-deliver-massive-improvements-in-fy26/).
- 20x Phase 2 pilot: 18 Nov 2025 → first authorizations 6 Mar 2026, about 3.5 months (https://www.fedramp.gov/20x/).
- Prioritised AI services had to "meet the requirements for a FedRAMP 20x authorization within two months of acceptance"
  (fedramp.gov/ai).
- DoD IL4/5 needs FedRAMP High plus extra controls. Anthropic's Claude has it only through AWS Bedrock GovCloud (AWS, May
  2025).
- HITRUST caps assessor fieldwork at 90 days, plus 2–4 weeks of QA
  (https://hitrustalliance.net/hubfs/23257256/HITRUST-CSF-Validated-Assessment-Pre-Submission-Timeline.pdf).
- SOC 2 Type II: AICPA sets no minimum; observation periods are usually 3–12 months.
- Range 3–24 months.

**C2. CERT_CASH $0.4B → $0.004B [P, M].**
- GAO-24-106591, pp. 15–16 (https://www.gao.gov/assets/d24106591.pdf): 8 providers reported "approximately $12.4 million
  for pursuing those authorizations and ranged from $300,000 to $3.7 million"; the sponsoring agency's costs "nearly all
  ranged from $69,000 to $400,000".
- $4M is the top of both. There is no primary cost for HITRUST, SOC 2 or IL5.
- The engineering is the scaffold build (ADAPT_TW), so it is not counted here.

**C3. HIPAA has no certification.**
- HHS "does not endorse or otherwise recognize private organizations' 'certifications'"
  (https://www.hhs.gov/hipaa/for-professionals/faq/are-we-required-to-certify-our-organizations-compliance-with-the-standards/index.html).
- HEALTH's certification is HITRUST (voluntary). The comment is corrected.

## KYC and distillation

**K1. KYC_REFUSE 0.1 → 0.25 [P-analogue, L].**
- Ofcom, Online Nation 2025: on the largest UK adult sites, unique visitors fell between July and August 2025, after age
  checks began on 25 Jul: Pornhub −31%, xHamster −28%, xvideos −24%. Ofcom: "The decline in visitors to these services
  following 25 July may be due to visitors' unwillingness or inability to complete the age assurance check."
  - The quote is from Ofcom's PDF as indexed (https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/online-research/online-nation/2025/online-nations-report-2025.pdf).
    The PDF blocked a direct fetch.
- Ofcom, Report on the use of age assurance (Jul 2026), §4.39–4.41: the fall is driven by "migration to services with no
  age checks, users choosing to use fewer age assured sites, or some VPN use"
  (https://assets.publishing.service.gov.uk/media/6a5770ae6d6d5c7e2845c9d0/Web-_accessible_Report_on_the_use_of_age_assurance_1.pdf).
- This is an upper-end analogue. Anonymity matters more to these users than to most API buyers. As in the game, unverified
  substitutes are one click away.
- Vendor surveys (IDnow 46% "abandoned a transaction") are marketing and not used.

**K2. KYC_REVIEW_COST 0.02: deleted (review F5).**
- Ofcom 2026 §7.14: per-check cost "median of around £0.06, with most estimates falling at or below £0.10", in a
  £0.05–0.30 range.
- Stripe Identity (https://stripe.com/identity): "$1.50" per document + selfie verification.
- A one-off check is under 1% of a year of a $20/month account, so it rounds to nothing.

**D1. DISTILL_HARVEST_SHARE 0.01. Kept, [D stand-in].**
- Anthropic, "Detecting and preventing distillation attacks", 23 Feb 2026: "over 16 million exchanges with Claude through
  approximately 24,000 fraudulent accounts" (MiniMax "over 13 million").
- The post gives no campaign duration and no share of traffic.
- No lab publishes its own traffic. OpenAI's DevDay 2025 page states 6B API tokens/min (https://openai.com/devday/).
- ~1e11 tokens over 90 days of the anonymous half of a frontier API:
  - ~3e-4 of it at OpenAI's volume (8.6e12 tokens/day)
  - ~7e-3 of it at this game's day-0 player API (3.4e11 tokens/day, scripts/v2/_p10)
- 0.01 is the top of that range. Lowering it toward 1e-3 would make KYC 1 matter on a big API, which is the review's
  complaint (designer). Confidence on the bracket: L, since it mixes one lab's campaign with another lab's volume.

## Misuse per token vs per user (review F9). Recommendation only, no change.

- Anthropic's threat reports, "Detecting and countering misuse of AI: August 2025"
  (https://www.anthropic.com/news/detecting-countering-misuse-aug-2025), and the Nov 2025 espionage case, report misuse as
  actors and accounts.
- The serious cases ran on agentic, frontier products (Claude Code), at high request rates per actor. That is many
  tokens per misuser, not free-tier chat.
- No data gives misuse per token or per user, so nothing settles the question.
- The game already reads each lineup model's own capability for its exposure (RD-P10). A low-uplift nano's large token
  share therefore adds little hazard.
- Keep tokens. At calibration, measure the free-tier nano's share of misuse hazard. If it dominates, switch to queries
  (users × queries per user).
