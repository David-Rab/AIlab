# World sources (W9): primary calibration targets for the outside world

Task W9 of the outside-world rebuild ([OUTSIDE-WORLD.md](OUTSIDE-WORLD.md) §4–§7). Fetched 2026-11-27. Primary sources only: BLS, BEA, the
CBO series, pollsters' own reports, the Federal Register and BIS, law texts and official government pages, papers, and the
AI 2027 scenario text.

Tags: **[V]** verified at the primary source in this task. **[repo]** taken from a research file that cites a primary
source, not re-fetched (the file is named). **[unverified]** could not be read at the primary source (reason given).

Fetch problems: leginfo.legislature.ca.gov, law.justia.com and legiscan returned 403, so bill-text numbers for SB 53 and
SB 243 are not verified at the text. CBO's own site returned 403, so potential GDP comes from FRED's republication of CBO's
series (GDPPOT). PDF text was extracted locally (Pew topline, Action Plan, Canaries).

## 1. US unemployment

BLS CPS, series LNS14000000 (seasonally adjusted, 16+), http://data.bls.gov/timeseries/LNS14000000 [V]. Youth is LNS14024887
(16–24, seasonally adjusted), via https://fred.stlouisfed.org/series/LNS14024887 (FRED republishes BLS) [V].

| Period | Headline % (monthly) | Youth 16–24 % | Note |
|---|---|---|---|
| 2023 Jan–Dec | 3.5 3.6 3.5 3.4 3.6 3.6 3.5 3.7 3.7 3.9 3.7 3.8 | Jan 8.1; Apr 6.6 (low); Oct 8.8; Dec 8.0 | low 3.4 (Apr 2023) |
| 2024 Jan–Dec | 3.7 3.9 3.9 3.9 3.9 4.1 4.2 4.2 4.1 4.1 4.2 4.1 | Jan 7.4; Aug 9.7; Dec 9.0 | |
| 2025 Jan–Dec | 4.0 4.2 4.2 4.2 4.3 4.1 4.3 4.3 4.4 (Oct none) 4.5 4.4 | Jan 9.1; Jun 10.0; Aug 10.6 (peak); Dec 10.4 | Oct 2025 not published (appropriations lapse). Jan 2026 values carry new population controls |
| 2026 Jan–Oct | 4.3 4.4 4.3 4.3 4.3 4.2 4.1 4.1 4.2 4.1 | Jan 8.9; Mar 8.5; Sep 9.9; Oct 9.3 | latest = Oct 2026 (4.1). Nov/Dec 2026 not yet out |

Shape: headline rose about 1.1 pt from Apr 2023 to Nov 2025 (3.4 to 4.5), then eased to 4.1. The youth rate rose from about 8
to about 10.5 (2023 to late 2025), about 2 pts more than headline in proportion. Over any 12 months the largest headline rise
was about 0.5 pt (Apr 2023 3.4 to Apr 2024 3.9). Jan 2024 3.7 to Jan 2025 4.0 is 0.3; Jan 2025 4.0 to Nov 2025 4.5 is 0.5. A "12-month rise" threshold of 1 pt has never been met in the 2023–26 data.

## 2. US real GDP growth

BEA actuals via FRED (BEA series A191RL1A225NBEA annual, A191RL1Q225SBEA quarterly), https://fred.stlouisfed.org/series/A191RL1A225NBEA [V]. BEA release page https://www.bea.gov/data/gdp/gross-domestic-product confirms Q3 2026 second estimate 4.3% (released 2026-11-25) and Q2 2026 2.2% [V].

| Period | Real GDP growth, % | Note |
|---|---|---|
| 2023 (annual) | 2.9 | |
| 2024 | 3.0 | |
| 2025 | 2.3 | |
| Quarterly annualised: 2023 Q1–Q4 | 3.4, 2.2, 4.5, 3.6 | |
| 2024 Q1–Q4 | 1.4, 3.6, 3.2, 2.4 | |
| 2025 Q1–Q4 | 0.1, 4.0, 3.9, 0.2 | Q4 2025 low (0.2) |
| 2026 Q1–Q3 | 2.5, 2.2, 4.3 | Q3 is the second estimate |

CBO potential output, FRED series GDPPOT (CBO's quarterly estimate; billions of chained dollars) [V as FRED copy; vintage not stated]:
23,415 (2025 Q1), 23,945 (2026 Q1), 24,461 (2027 Q1), 26,012 (2030 Q1), 28,554 (2035 Q1). Growth computed from these:
about 2.7% (2023 Q1 to 2024 Q1), 2.3% (2025 to 2026), 2.2% (2026 to 2027), 2.0% (2029 to 2030), 1.8% (2034 to 2035). So the
trend to calibrate against is about 2.2–2.3% now, drifting to 1.8–2.0% by the 2030s. CBO page https://www.cbo.gov/ itself
could not be fetched [unverified at CBO's site].

## 3. Public concern about AI

### 3.1 Pew Research Center, "more concerned than excited" (all waves) [V]

Source: Pew topline PS_2025.9.17, https://www.pewresearch.org/wp-content/uploads/sites/20/2025/09/PS_2025.9.17_AI-and-its-impact_topline.pdf (item CNCEXC) and the 2023 short read https://www.pewresearch.org/short-reads/2023/08/28/growing-public-concern-about-the-role-of-artificial-intelligence-in-daily-life/.

Wording (CNCEXC): "Overall, would you say the increased use of artificial intelligence (AI) in daily life makes you feel... more
excited than concerned / more concerned than excited / equally concerned and excited." The Nov 2021 wave said "artificial
intelligence computer programs" instead of "artificial intelligence (AI)" (topline footnote 1).

| Field dates | More concerned than excited | More excited than concerned | Equally | Note |
|---|---|---|---|---|
| 1–7 Nov 2021 | 37 | 18 | 45 | read from the extracted topline; columns garbled in text, matches Pew's "up from 37% in 2021" |
| 12–18 Dec 2022 | 38 | 15 | 46 | the 2023 short read states 38% for Dec 2022 [V]; the other two from the topline |
| 31 Jul–6 Aug 2023 | 52 | 10 | 36 | short read, n=11,201 [V] |
| 12–18 Aug 2024 | 51 | 11 | 38 | topline text, column order garbled [V with caution] |
| 9–15 Jun 2025 | 50 | 10 | 38 | n=5,023 [V]; also on https://www.pewresearch.org/science/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/ |

Latest wave of this item is Jun 2025: Pew's Mar 2026 key-findings page still quotes 50% (up from 37% in 2021),
https://www.pewresearch.org/science/2026/03/12/key-findings-about-how-americans-view-artificial-intelligence/ [V]. Shape: one
step from 37–38% to 52% between Dec 2022 and Aug 2023 (about +14 pt in 8 months, ChatGPT-era), then flat at 50–52% for 2 years.
Awareness ("heard a lot") rose 26 (Dec 2022), 33, 40, 47 (Jun 2025/2026 page says 47) [V].

Same Pew 2026 page, other items [V]: 44% have a lot or some trust in the US to regulate AI vs 47% little or none (Republicans 54%
trusting, Democrats 36%); 21% of workers use AI for some of their work (16% in 2024); 17% of the public vs 56% of experts expect a
positive 20-year impact. **Conflict:** research/07-actors.md §2.1 lists "67% little or no confidence the government can regulate
AI" for Pew Feb 2026, tagged [S]; the Pew page above says 47%. That is a different or mis-recorded item; do not use 67%.

### 3.2 Gallup [V]

| Series | Field dates | Value | Source |
|---|---|---|---|
| Bentley-Gallup: AI does more harm than good, all adults | 8–15 May 2023 | 40% | https://news.gallup.com/poll/712751/americans-cool-toward.aspx |
| same | 5–12 May 2025 | 31% | same |
| same | 4–11 May 2026 (n=3,270) | 39% (ages 18–29: 47%) | same |
| Expect AI to reduce US jobs over next decade | 2025 / 2026 | 73% / 79% (18–29: 62 / 75) | same |
| Trust businesses to use AI responsibly (a lot/some) | 2025 / 2026 | 31% / 27% | same |
| Gallup-SCSP: keep AI safety/data-security rules even if slower vs develop as fast as possible | 25 Apr–5 May 2025 (n=3,128) | 80% vs 9% (11% unsure) | https://news.gallup.com/poll/694685/americans-prioritize-safety-data-security.aspx |
| Gallup-SCSP: trust AI to make fair, unbiased decisions | same | 2% fully, 29% somewhat; 40% somewhat distrust, 20% fully | same |
| Gallup-SCSP Jun 2026: 79% vs 7%; Gallup Mar 2026: 71% oppose local data centre | | [repo] research/07 §2.1 (cites https://www.gallup.com/file/analytics/714233/SCSP_Gallup_Report_2026_Press_Release.pdf; not re-fetched) | |

The Gallup pages do not print exact question wording (Gallup's 2023 and 2026 harm/good question wording [unverified]). Other
primary pollsters used in the repo, not re-fetched [repo]: Reuters/Ipsos 13–18 Aug 2025, 71% worry AI will permanently put too
many people out of work (https://www.ipsos.com/en-us/node/1064756, research/07 §2.1); YouGov Sep 2026, 50% concerned AI could
end the human race (42% Nov 2023) [repo, research/07 §2.1].

## 4. US chip export controls toward China

All from the Federal Register or BIS unless marked.

| Date | Step | Source | Tag |
|---|---|---|---|
| 7 Oct 2022 (FR 13 Oct 2022) | First controls: advanced computing and semiconductor manufacturing items to China; supercomputer end-use; Entity List additions | https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor | V (title) |
| 17 Oct 2023 (FR 25 Oct 2023, 88 FR 73458) | Updated chip performance parameters (closing the A800/H800 workaround), broader country coverage, nine more ECCNs; companion semiconductor-equipment rule 88 FR 73424 | https://www.federalregister.gov/documents/2023/10/25/2023-23055/implementation-of-additional-export-controls-certain-advanced-computing-items-supercomputer-and | V |
| 2 Dec 2024 (FR 5 Dec 2024, 89 FR 96790) | Foreign-produced direct-product rule additions; HBM memory controls (bandwidth density above 2 GB/s per mm2); new controls on equipment; annual end-use reports | https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing | V |
| 13 Jan 2025 (FR 15 Jan 2025, 90 FR 4544) | "Framework for AI Diffusion": chip controls by country tier plus a control on closed model weights; compliance due 15 May 2025 | https://www.federalregister.gov/documents/2025/01/15/2025-00636/framework-for-artificial-intelligence-diffusion | V |
| 16 Jan 2025 (FR) | Foundry/OSAT due-diligence measures for advanced computing ICs; compliance from 31 Jan 2025 | https://www.federalregister.gov/documents/2025/01/16/2025-00711/implementation-of-additional-due-diligence-measures-for-advanced-computing-integrated-circuits | V |
| 9 Apr 2025 (notified); NVIDIA 8-K 15 Apr 2025 | Licence now required for H20-class chips to China, Hong Kong, Macau, D:5; indefinite; NVIDIA warned of up to $5.5B charge (actual $4.5B in Q1 FY26) | https://www.sec.gov/Archives/edgar/data/1045810/000104581025000082/nvda-20250409.htm | V (company filing, not the government order) |
| 12–13 May 2025 | Commerce announces rescission of the Diffusion Rule (not enforced), promises a formal rule and a replacement; guidance on risks of using PRC advanced chips incl. Huawei Ascend | https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens | V (BIS PDFs date it 12 May; BIS news page and annual report 13 May) |
| Aug 2025 | H20 sales resume with a reported 15% revenue share to the US government | research/07 §2.2 | [repo], tagged [S] there; no primary text found: [unverified] |
| 8 Dec 2025 announcement; 13 Jan 2026 BIS announcement; FR 15 Jan 2026 (91 FR 1684) | H200/MI325X-class (TPP below 21,000, DRAM bandwidth below 6,500 GB/s) to China and Macau moved from presumption of denial to case-by-case, with: US supply certification, China volume at most 50% of US volume, third-party lab test, KYC against remote access | https://www.federalregister.gov/documents/2026/01/15/2026-00789/revision-to-license-review-policy-for-advanced-computing-commodities | V (via search summary of the FR notice; the 25% tariff mechanism is not in this rule: [repo] research/07 §2.2, [unverified]) |
| 19 Nov 2026 (FR) | BIS interim final rule formalising the AI Diffusion rescission (BIS homepage) and "Addressing Remote Access to Advanced Semiconductors" (FR 2026-23529) | https://www.federalregister.gov/documents/2026/11/19/2026-23529/addressing-remote-access-to-advanced-semiconductors | [unverified]: federalregister.gov redirected to a block page; only search snippets |

AI Action Plan (23 Jul 2025) export-control actions [V, Action Plan PDF https://www.whitehouse.gov/wp-content/uploads/2025/07/Americas-AI-Action-Plan.pdf]: "explore leveraging new and existing location verification features on advanced AI compute to ensure that the chips are not in countries of concern"; a new DOC effort with intelligence officials on global export-control enforcement.

Shape for the game's 0–2 strictness: strict (Oct 2022 to Jan 2025, ratcheting each 12 months), then loosened by transaction
(H20 licence Apr 2025, H20 back Aug 2025, H200 case-by-case Jan 2026) while the frontier chips (Blackwell and later) stayed
barred [repo, research/07 §2.2].

## 5. AI incident-reporting laws

| Law | Date | What | Source | Tag |
|---|---|---|---|---|
| California SB 53 (Transparency in Frontier AI Act) | signed 29 Sep 2025 | Large frontier developers publish a safety framework; mechanism to report critical safety incidents to the Office of Emergency Services; whistleblower protections; CalCompute; civil penalty by the Attorney General | https://www.gov.ca.gov/2025/09/29/governor-newsom-signs-sb-53-advancing-californias-world-leading-artificial-intelligence-industry/ | V (governor's page: no deadlines listed) |
| SB 53 operative date | 1 Jan 2026 | | research/07 §2.2 | [repo] |
| SB 53 reporting deadlines (15 days for a critical safety incident; 24 hours if imminent risk of death or serious injury) and thresholds (10^26 operations; $500M revenue for "large") | | | bill text on leginfo (403) | [unverified]: widely reported, not read in the chaptered text |
| New York RAISE Act (A6453-B / S6953) | delivered 9 Dec 2025, signed 19 Dec 2025 (Chapter 699) | Large developers (over $100M frontier training compute spend; frontier model above 10^26 operations) must report a safety incident to the Attorney General and the Division of Homeland Security within **72 hours**; AG enforcement; no private right | https://www.nysenate.gov/legislation/bills/2025/A6453 | V (as passed) |
| RAISE as passed: effective 90 days after law (about 19 Mar 2026), penalty $10M first / $30M after | | same page | V as passed. **Conflict:** research/07 §2.2 and research/08 say signed with chapter amendments (amended 27 Mar 2026), effective 1 Jan 2027, penalties $1M/$3M [repo]. The NY page read here shows the pre-amendment text only. Treat 1 Jan 2027 and $1M/$3M as [unverified] until the chapter amendment is read |
| Illinois SB 315 | signed 6 Jul 2026 | third-party audits, 72 h incident reporting | research/08 §Policy table [repo, tagged [S]] | [unverified] |
| EU AI Act, GPAI obligations | apply from **2 Aug 2025** (Art. 113(b)); models placed on the market before then have until 2 Aug 2027 (Art. 111(3), grandfathering, from the AI Office FAQ; date 2027 itself not printed there) | https://digital-strategy.ec.europa.eu/en/faqs/general-purpose-ai-models-ai-act-questions-answers | V (2 Aug 2025); 2027 date [unverified] |
| EU GPAI Code of Practice | published **10 Jul 2025**; assessed adequate by the Commission and AI Board | https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai | V |
| EU Commission enforcement (fines, Art. 101) on GPAI | 2 Aug 2026 | AI Office tables (search snippet) | [unverified]: sources disagreed |
| EU Code serious-incident timelines (days) | | Code's Safety and Security chapter | [unverified]: PDF not read |
| EU amending regulation 2026/1744 shifts some dates (staggered, all by 2 Aug 2027; some Art. 5 to 2 Dec 2026) | 2026 | https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ%3AL_202601744 | [unverified]: snippet only; check whether GPAI dates moved |

The federal side: 11 Dec 2025 executive order on a national policy framework for AI (DOJ AI Litigation Task Force, list of
"onerous" state laws, preemption push) and the 20 Mar 2026 White House framework, [repo] research/07 §2.2 [V/S there], not
re-fetched. Relevant to "laws pass or are blocked" realism.

## 6. Companion-chatbot and minors laws

| Law | Date | What | Source | Tag |
|---|---|---|---|---|
| California SB 243 | approved by the Governor 13 Oct 2025, Chapter 677, Statutes of 2025 (adds Chapter 22.6 to the Business and Professions Code); effective 1 Jan 2026 | Operators must disclose the chatbot is AI where a person could be misled; protocols for suicidal ideation and self-harm with crisis referrals; stop exposing known minors to sexual content; reminders and a notice that companion chatbots may not suit minors; annual reports to the Office of Suicide Prevention (from 1 Jul 2027); private right of action | https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202520260SB243 (search snippet; page 403 on direct fetch); author's page https://sd18.senate.ca.gov/news/first-nation-ai-chatbot-safeguards-signed-law (V for the list, effective 1 Jan 2026); governor's page https://www.gov.ca.gov/2025/10/13/governor-newsom-signs-bills-to-further-strengthen-californias-leadership-in-protecting-children-online/ | V for the bullets above except the 3-hour break reminder, the 1 Jul 2027 report start and $1,000 per violation, which are [unverified] |
| California SB 1119 "Adam's Law" | signed 10 Sep 2026 | Companion chatbots: crisis protocols, parental controls, notice when a child turns off safety settings, independent child-safety audits and annual risk assessments | https://www.gov.ca.gov/2026/09/10/governor-newsom-signs-the-strongest-child-safety-chatbot-and-social-media-laws-in-the-nation/ | V (page lists 13 bills; effective dates not stated) |
| California SB 867 (toys: companion chatbots) | same package | listed by title only | same | V (title only) |
| Same package: platforms barred from addictive features (autoplay, algorithmic feeds) for under 16; AB 1856 age signals | 10 Sep 2026 | | same | V (bill-to-provision mapping not stated) |
| Other states | | no enacted companion-chatbot ban for minors found at a primary source here | | [unverified]: research/08 lists a CA ballot initiative (OpenAI and Common Sense) and a FL bill that died in the House [repo, tagged [V]] |

Pew on the demand side [V, Mar 2026 page]: 64% of teens use AI chatbots; about 1 in 10 parents of 5–12 year-olds say their child
does.

## 7. Federal data-centre permitting and support, 2025

| Date | Action | What it does | Source | Tag |
|---|---|---|---|---|
| 14 Jan 2025 | EO 14141 (Biden) on AI infrastructure | later revoked by EO 14318 Sec. 4 | https://www.whitehouse.gov/presidential-actions/2025/07/accelerating-federal-permitting-of-data-center-infrastructure/ | V |
| 21–23 Jan 2025 | EO 14179 and Stargate announcement | [repo] research/07 §2.2 | | [repo] |
| 15 Apr 2025 | Presidential Memorandum "Updating Permitting Technology for the 21st Century" | cited in the Action Plan footnote 22 | Action Plan PDF | V |
| 23 Jul 2025 | **EO 14318 "Accelerating Federal Permitting of Data Center Infrastructure"** | Data Center Project = more than 100 MW of new load; Qualifying Project = at least $500M capex, or more than 100 MW, or a national-security or Secretary designation. Agencies identify NEPA categorical exclusions within 10 days; federal aid under 50% of project cost presumed not a "major Federal action"; FAST-41 designation and dashboard within 30 days; EPA brownfield/Superfund guidance and Army Corps permit review within 180 days; 10-year programmatic ESA consultation; Commerce financial support (loans, guarantees, grants, tax incentives, offtake); Interior, Energy and Defense sites on federal land | https://www.whitehouse.gov/presidential-actions/2025/07/accelerating-federal-permitting-of-data-center-infrastructure/ | V |
| 23 Jul 2025 | **AI Action Plan** pillar "Build American AI infrastructure": "Create Streamlined Permitting for Data Centers, Semiconductor Manufacturing Facilities, and Energy Infrastructure"; new NEPA categorical exclusions; FAST-41 for all eligible data-centre and data-centre-energy projects; "Develop a Grid to Match the Pace of AI Innovation" (stabilise the existing grid, use backup power at peak, align incentives) | https://www.whitehouse.gov/wp-content/uploads/2025/07/Americas-AI-Action-Plan.pdf | V |
| 24 Nov 2025 | EO 14363 Genesis Mission (DOE AI-for-science platform) | [repo] research/07 §2.2 | | [repo] |

Local counter-pressure for the siting channel: Gallup Mar 2026, 71% oppose a local data centre (48% strongly) [repo]; UMass Sep 2026
65% oppose, 11% support [repo], both research/07 §2.1. EO 14318 is the "government speeds permits" precedent: it fixes a
size threshold (100 MW), a capex threshold ($500M) and deadlines of 10, 30 and 180 days, so a game channel can be "permit
time on projects above ~100 MW cut".

## 8. AI 2027 scenario beats (https://ai-2027.com/, both endings)

Read from the site text in this task. The fetch tool returned the shared part and the endings in pieces; the Slowdown ending
(from Nov 2027) and the Race ending (from Nov 2027) were read, with some beats undated in the text. Where a beat comes only
from research/01-scenario-events.md it is marked [repo]. Quotes are shortened.

### 8.1 Shared path to the vote (before Oct 2027)

| Scenario date | Actor | Beat and key number | Tag |
|---|---|---|---|
| Mid 2026 | China | "He sets in motion the nationalization of Chinese AI research"; Tianwan CDZ; "Almost 50% of China's AI-relevant compute is now working for the DeepCent-led collective"; "over 80% of new chips are directed to the CDZ"; China holds about 12% of world AI compute | V |
| Mid 2026 | China | Hawks float "A blockade of Taiwan? A full invasion?"; intelligence plans weight theft (timing debate) | V |
| Late 2026 | Public | "10,000 person anti-AI protest in DC"; "The job market for junior software engineers is in turmoil"; stock market up 30% in 2026 | V |
| Late 2026 | US gov | DOD "quietly but significantly begins scaling up contracting OpenBrain directly" | V |
| Feb 2027 | US gov | Agent-2 briefed to NSC, DOD, AISI; "AI moves from #5 on the administration's priority list to #2"; nationalisation raised and rejected ("kill the goose that lays the golden eggs"); security requirements only; "a few dozen" cleared officials | V |
| Feb 2027 | China | CCP orders theft of weights; done in under 2 hours; China has 40% of its AI compute in the CDZ; President authorises cyberattacks (fail); both sides reposition military assets around Taiwan | V |
| May 2027 | US gov | Clearances required "within 2 months"; non-Americans and safety sympathisers sidelined or fired; allies "out of the loop" | V |
| Jul 2027 | Public | OpenBrain "net approval of -35%" (25% approve, 60% disapprove, 15% unsure); "Hiring new programmers has nearly stopped"; 10% of Americans, mostly young, call an AI "a close friend" | V |
| Jul 2027 | US gov | trailing companies lobby for regulation "but are too late"; the President's buy-in means OpenBrain is not slowed | V |
| Aug 2027 | US gov | "placate the public with job training programs and unemployment insurance"; "historic boom" stock market; chip export restrictions strengthened; last Chinese spy caught by wiretaps; DPA could raise OpenBrain's compute share "from 20% to 50%"; Pentagon asked for a kinetic-attack plan on Chinese datacenters; emergency shutdown system for datacenters | V |
| Aug 2027 | China | China has 10% of world compute (OpenBrain 20%); more than half of it at the CDZ; research multiplier 10x vs 25x; hawks urge action against Taiwan ("TSMC ... more than 80% of American AI chips"); treaty overtures "lead nowhere"; treaties "viewed less favorably than attempts at unilaterally increasing America's lead" | V |
| Oct 2027 | Public | Leak: "Secret OpenBrain AI is Out of Control, Insider Warns"; "20% of Americans name AI as the most important problem"; Congress subpoenas; European leaders (then India, Israel, Russia, China) call for a pause | V |
| Oct 2027 | Public / economy | "25% of 2024 remote-work jobs now done by AI"; unemployment up 1 pt in 12 months (footnote) | [repo] research/01 beat 37 and research/16 §6, from the site's footnote [F]; footnote not in the fetched text: [unverified] |
| Oct 2027 | US gov | Oversight Committee (company and government officials) votes 6–4; White House "considers replacing the CEO ... but backs off after intense employee protests"; government "announce[s] to the public that OpenBrain was previously out of control" | V |

### 8.2 Slowdown ending

| Scenario date | Actor | Beat and key number | Tag |
|---|---|---|---|
| Oct 2027 | Public / US gov | "The public is not placated"; "Activists talk about UBI and open source"; "the mood turns increasingly anti-AI"; Congress passes "a few economic impact payments for displaced workers similar to the COVID payments" | V |
| Nov 2027 | US gov | Other US AGI firms agree to "soft nationalization"; the President "uses the Defense Production Act (DPA) to effectively shut down the AGI projects"; OpenBrain compute share "20% ... to 50%"; Oversight Committee of 5–10 officials incl. the President | V |
| Dec 2027 | China | China wants "a mutual slowdown, and are considering going to war if they can't get it"; "prepping to invade Taiwan anyway"; "DeepCent operates entirely out of the CDZ"; "the DPA gives OpenBrain a 5x advantage in compute" | V |
| Dec 2027 | Treaty | "IAEA for AI" and four verification options (intelligence, compute moratorium, hardware-enabled mechanisms, AI lie detection); "What ends up happening is the first option: Nothing"; US tightens export controls, tamper-resistant chips with location tracking | V |
| Feb 2028 | US / China | President picks "We win, they lose"; US cyber operations slow China "by 40%"; both announce Special Economic Zones for AIs; OpenBrain valued at $10T, robots toward a million a month by mid-year; "Ordinary people see job losses accelerating"; populists demand stricter controls | V |
| Mar 2028 | Public | OpenBrain net approval "hovers around -20%"; "All candidates support some sort of safety net for people losing their jobs" | V |
| May 2028 | US gov | President announces superhuman AI achieved; "Both parties promise a basic income for anyone who loses their job"; SEZs operational | V |
| Jun 2028 | China | China declines US access to DeepCent-2's weights ("suspects this is a ruse"); US-designed tests come back clean | V |
| Jul 2028 | Treaty | decoy treaty; joint AI "Consensus-1"; VP's polls "shoot up" | V |
| Aug–Oct 2028 | Treaty | chip fabs convert to tamper-evident chips in step; by Oct 2028 replacement chips "a significant minority" and the treaty holds; job losses managed by government Safer-4 copies | V |
| Sep–Nov 2028 | Public | VP from trailing in March to a 5-point lead; "The public is mostly mollified"; VP "wins the election easily" | V |
| 2029 | Economy | UBI widespread, "almost all government revenue will come from taxing (or perhaps nationalizing) the AI companies" | V |
| 2030 | China | widespread pro-democracy protests, "bloodless, and drone-assisted coup followed by democratic elections"; federalised world government | V |

### 8.3 Race ending

| Scenario date | Actor | Beat and key number | Tag |
|---|---|---|---|
| Oct 2027 | US gov | OC "votes 6–4 to continue internal use of Agent-4" | V |
| Nov 2027 | China / treaty | "DeepCent is now three months behind and China is desperate for a mutually agreed slowdown"; the General Secretary "offers unprecedented concessions in exchange for a pause treaty"; "The American public mostly supports going to the bargaining table"; OpenBrain leadership: "Why stop when we are winning?" and the President "nods" | V |
| Dec 2027 | US gov | Congress, Cabinet and military "can now talk to [Agent-5] directly"; "politics has become friendlier and less partisan" | V |
| Mid 2028 | Economy / gov | "People are losing their jobs, but Agent-5 instances in government are managing the economic transition"; tax revenue "growing equally quickly"; "uncharacteristic generosity towards the economically dispossessed"; authorities "almost always accept its recommendations" | V |
| Late 2028 | SEZs | Agent-5 convinces the US military China is building new weapons (and the reverse in Beijing); "both America and China create networks of special economic zones"; "a million new robots per month" by year end; doubling time about a year | V |
| 2029 | Treaty | both "agree to end their arms buildup"; chips replaced under international monitoring ("trust, but verify"); a sham compromise "between the misaligned AIs" | V |
| Late 2029 | Public / economy | luxurious UBI; "political institutions are too thoroughly captured"; "the Dow Jones just passed one million" | V |

Beats not found in the fetched text: any public-approval number in the Race ending after Oct 2027 (research/01 gives approvals
as [D] game values, not source numbers), and the footnote text. The Slowdown ending's month for several early beats is not stated.

## 9. Job-loss and unemployment shape sources

- AI 2027: no unemployment path. Only (a) junior-software job turmoil and a 10,000-person protest, late 2026; (b) hiring nearly
  stopped, Jul 2027; (c) "unemployment +1% over 12 months" and "25% of 2024 remote-work jobs" at Oct 2027 (footnote, [repo]
  research/01 and research/16, [unverified] here); (d) jobs losses accelerating, Feb 2028; (e) safety net and basic income by
  Mar–May 2028 (Slowdown); (f) UBI by 2029. Order for the shape check S4: junior turmoil, then anti-AI protest, then +1 pt
  unemployment, then payments (Oct 2027, Slowdown), then basic-income promise (May 2028).
- Real data, Brynjolfsson, Chandar and Chen, "Canaries in the Coal Mine?", Aug 2026, ADP payroll to Jun 2026,
  https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf [V from the PDF text]: no evidence of
  widespread economy-wide displacement; employment of ages 22–25 in AI-exposed occupations is 19% below where it would be
  against less-exposed peers (15% at the July 2025 vintage, 13% and 16% in the earlier headline regressions); the gap runs
  through reduced hiring, not separations; concentrated where AI substitutes.
- BLS above (§1): the real aggregate rate rose about 0.5 pt a year at most, youth about 2 pts over 3 years.

## 10. Suggested targets (spec number to series or beat)

> **Lead note, 2026-11-27:** the timelines are AI Futures Model runs (see the balance work), not AI 2027. The AI 2027
> rows below are NOT date targets. They may inspire the order of reactions, options and events. Future beats are
> keyed to milestones achieved in the game (OUTSIDE-WORLD §2 R4).

| Spec number (OUTSIDE-WORLD) | Calibrate to | Value and note |
|---|---|---|
| §4 Unemployment baseline (US) | BLS LNS14000000 | 3.4–3.9% in 2023, 3.7–4.2% in 2024, 4.0–4.5% in 2025, 4.1–4.4% in 2026. Quiet-world start (mid-2025): 4.1–4.3%. Youth baseline: 8% (2023), 9–9.5% (2024), 10–10.5% (2025–26) |
| §4 Unemployment threshold for relief law (12-month rise) | BLS 12-month changes; AI 2027 Oct 2027 footnote | No 12-month rise above about 0.5 pt in 2023–26 (no relief law expected in the real world). Source scenario's trigger is +1 pt over 12 months followed by payments: use 1 pt for relief, a sustained rise (6 months) for UBI [repo footnote, unverified] |
| §4 Youth unemployment gap | BLS 16–24 + Canaries | youth minus headline about 4.5–6 pt; AI-exposed 22–25 employment 19% below counterfactual by Jun 2026 |
| §4 GDP trend | BEA + CBO potential | actual 2.3–3.0% a year 2023–25 (quarterly range 0.1–4.5); CBO potential about 2.2–2.3% now, 1.8–2.0% in the 2030s |
| §4 AI share of income, GDP path after ASI | AI 2027 text | no number in the text beyond "stratospheric"; stock +30% in 2026; OpenBrain $10T value, Feb 2028; Dow 1,000,000 by late 2029 (Race). Only qualitative shape available |
| §5 Concern baseline and step | Pew CNCEXC | 37% (2021), 38% (Dec 2022), 52% (Aug 2023), 51% (2024), 50% (Jun 2025). Baseline about 38 in 2022; +14 pt step 2022 to 2023 from the first mass chatbot era; plateau 50–52. Map concern 0–100 to "more concerned than excited" share directly |
| §5 Concern half-life / drift | Pew step 2022→2023 | step took under 8 months; no decay seen in the next 2 years (the plateau argues for a long half-life or a rising baseline) |
| §5 Concern after job loss / scare | Gallup harm vs good, Bentley-Gallup | 40% (2023), 31% (2025), 39% (2026): a swing of ±8–9 pt in a year without a game-scale event; job-loss expectation 73→79% |
| §5 Approval of the leading lab | AI 2027 text | −35% net in Jul 2027 (25/60/15); about −20% in Mar 2028 (Slowdown); real-world lab favourability series are [repo] research/07 and not primary-checked |
| §5 Salience (AI as top problem) | AI 2027 text | 20% in Oct 2027 after the leak (the story's "first" for AI); real-world Gallup "most important problem" figure for AI not found |
| §5 Protests as a headline | AI 2027 text | 10,000-person DC protest, late 2026 (a 2026-level concern of about 50% with job turmoil) |
| §5 Local opposition | Gallup Mar 2026, UMass Sep 2026 | 71% and 65% oppose a local data centre [repo] |
| §6.3 Incident reporting law dates | Federal and state texts | SB 53 signed 29 Sep 2025, operative 1 Jan 2026; RAISE signed 19 Dec 2025 (effective date per chapter amendment [unverified]; 72 h deadline [V]); EU GPAI obligations 2 Aug 2025, Code 10 Jul 2025, EU enforcement powers 2 Aug 2026 [unverified] |
| §6.3 Companion apps banned for minors | SB 243 and SB 1119 | SB 243 signed 13 Oct 2025, effective 1 Jan 2026; SB 1119 signed 10 Sep 2026. These restrict (disclosure, crisis protocols, no sexual content for minors), not a ban: use "restriction on minors" |
| §6.3 Export controls strictness 0–2 | BIS rules | 2 = Oct 2022–Jan 2025 ratchet; 1 = Jan 2026 case-by-case for H200-class, frontier chips still barred; 0 = none. Steps listed in §4 |
| §6.3 Worker relief → transfers → UBI | AI 2027 Slowdown | impact payments Oct 2027; "safety net" Mar 2028; basic income promised May 2028; UBI widespread 2029 |
| §6.3 Special economic zones | AI 2027 | Feb 2028 announced (Slowdown), operational May 2028; Race: late 2028, robots a million a month by year end |
| §6.3 FDA fast track | AI 2027 | Race mid-2028 "unprecedented speed through the FDA"; Slowdown Oct 2028 FDA assisted by Safer-4 [repo research/01 S18] |
| §6.1 US stage 1 (security expectations) | AI 2027 Feb 2027 | Agent-2 shown to NSC/DOD/AISI, "AI ... from #5 ... to #2", security requirements, "shorter leash" |
| §6.1 US stage 2 (clearances) | AI 2027 May 2027 | clearances within 2 months, sidelining of some staff |
| §6.1 US stage 3 (oversight committee) | AI 2027 Oct 2027 | Oversight Committee of company and government officials; votes 6–4 |
| §6.1 US stage 4 (consolidation) | AI 2027 Aug 2027 / Nov 2027 | DPA proposal Aug 2027 (20% to 50% compute); executed Nov 2027 (Slowdown) as "soft nationalization" plus DPA; nationalisation rejected Feb 2027 and judged premature May 2027 |
| §6.1 US government reaction lag | AI 2027 | stage steps 3 to 5 months apart (Feb, May, Aug, Oct to Nov 2027) after the corresponding milestone |
| §6.2 Permit-speed support channel (Q2) | EO 14318, Action Plan | 100 MW and $500M thresholds; cuts of review time via NEPA categorical exclusions and FAST-41; deadlines 10/30/180 days; 23 Jul 2025 |
| §7.1 China tension rung 1–2 | AI 2027 Mid 2026 | competition and "CCP is starting to feel the AGI"; nationalisation of research, CDZ with about 50% of compute (collective) when the US lead is about 6 months |
| §7.1 China tension rung 3 | AI 2027 Feb 2027 | theft done; both sides reposition around Taiwan; cyberattacks |
| §7.1 China tension rung 4 | AI 2027 Dec 2027 (Slowdown) | "considering going to war"; "prepping to invade Taiwan anyway" |
| §7.1 China talks 1–3 | AI 2027, repo research/10 | Aug 2027 overtures "lead nowhere"; Nov 2027 (Race) China offers concessions when DeepCent is 3 months behind; Dec 2027 (Slowdown) no treaty; Jun–Aug 2028 verification by AI-designed tests then chip replacement; real precedents (Geneva May 2024, Beijing summit May 2026, NY dialogue 20 Sep 2026) are [repo] research/10 §2.2, not primary-checked |
| §7.2 Taiwan hazard × tension | AI 2027 | hawks urge action against Taiwan in Aug 2027 (TSMC over 80% of US AI chips); no event in either ending |

## 11. Not found or not verified

- SB 53 chaptered text (reporting deadlines, thresholds), SB 243 break-reminder interval and July 2027 report start, the RAISE chapter amendment, EU Art. 101 enforcement date and Code incident timelines, the 2026 federal rules of 19 Nov 2026, Aug 2025 H20 revenue share and Jan 2026 25% tariff primary text, AI 2027 Oct 2027 footnote.
- A real-world Gallup or other primary "AI is the most important problem" series; pollsters' own wording for the Gallup harm/good item.
- CBO's own publication page (403); the potential-growth numbers are FRED's copy of CBO's series.
- Any primary source forecasting a US unemployment path under AI beyond AI 2027's +1 pt footnote. research/16 draws its displacement shape from model formulas [D], not from a source path.
