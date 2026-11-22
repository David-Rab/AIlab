# Notes for the UI phase (collected during the engine work)

- Domain score scale (after RD-U05, 2026-11-23): score = λ(G_d − δ_d·Δ_bm), 10 = the domain's best human. At the start
  five domains (SOCIAL, MEDIA, CYBER, BIO, PHYS) show 0 and RSCH ~3.5 lower: uninformative. Design a readable scale
  (e.g. position vs median expert and best human per domain) when the Models screen is redesigned.
- Product actions with no real cost (update, serving, feature toggle, product policy, make variant) honestly show no
  cost line since the "≥ 1 cost" rule was removed; the products redesign (Phase 7) decides which deserve real costs.
