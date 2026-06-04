# Sigma — Remediation tradeoff analysis (2026-06-04)

_Synthesis across the [`code-review-2026-06-03.md`](../qa/code-review-2026-06-03.md) (93 confirmed findings) and the [`code-compliance-audit-2026-06-03.md`](code-compliance-audit-2026-06-03.md) (6 unique items + team-owned dependencies), with legal hooks in [`regulatory-map-2026-06-03.md`](regulatory-map-2026-06-03.md). Question answered: **if we implement the full feedback, what do the issues do together, and do we lose any functionality — or is it only a gain?**_

The two source reports are deliberately deduplicated (the compliance audit lists only items with no technical twin). "Implementing the full feedback" therefore means: the code review's 93 findings **+** the compliance audit's 6 unique items (A4, Ac1, Ac2, O1, Al1, H1) **+** the team-owned policy artifacts several code fixes depend on.

---

## Bottom line

Implementing the full feedback is **~90% pure gain** — security, correctness, accessibility, data integrity, and cleanup, none of which removes user-facing capability, and several of which *restore* correct data. It is **not** purely a gain. There are three places where we genuinely give something up, and two of them are not bugs — they are the **legal mandate (АОП–МИДТ чл. 8 anonymization)** and the **product mission (anti-corruption transparency)** pulling in opposite directions. Honest framing: *most of the list makes the product strictly better; a small, high-stakes subset trades transparency and architectural freedom for legal compliance.*

---

## How the findings interlock (one fix often resolves many)

The ~99 findings collapse into a handful of root causes. The leverage points:

| Cluster | Findings sharing the root cause | Leverage |
|---|---|---|
| **Unauthenticated ETL write path** | Critical (row injection) + High (DoS/cron collision) + Medium twin + Low (unchecked cast) | One auth gate + body schema + disable `workers_dev` closes all four |
| **No systemic anonymization** | A4 (the *control*) sits above `bidders.name`, the owner tables, consortium-fragment search links | Building A4's classify-redact stage + a "no natural-person name reaches any published surface" test resolves the per-surface PII findings at once |
| **normalize vs. refresh-slice drift** | `annex_suspect` amount divergence, ~17 missing columns, GROUP-BY collapse, `current_value` dead branches, `as_of`/`suspect` count mismatches | Real fix is *factoring the shared SQL so the two scripts can't diverge* — an architectural improvement, not 6 patches |
| **Filter/scope drift in the UI** | FilterRail drops authority/bidder, companies CSV ignores filters, `pageCursors` Prev/Next inversion, missing first-page guards | Same family; a `CSV-row-set == list-row-set` test pins them |
| **Resource responses bypass security headers** | web resource routes, all CSVs/sitemaps, `contract.json`, the parked `apps/api` worker | One shared `securityHeaders()` in the fetch handler covers every response |
| **Untrusted-feed contract honored inconsistently** | dropped numeric validation (worker port), `publishedDate` regression, `load-fx`/`load-ocds` injection, feed-URI path traversal, `xlsx@0.18.5` | All "validate at the trust boundary" — coordinate as one ingest-hardening pass |
| **Silent staleness / inflation** | cron-403 freeze + false `refreshed_at`, home counters (suspect over-count, all-rows counts), fabricated deep-page ranks | All make optimistic numbers honest |

**Two structural facts:**

1. The **ETL pipeline and DB scripts are touched by many findings** — sequence them as coordinated overhauls, not piecemeal patches, or you re-open the same files repeatedly and risk re-introducing the normalize/refresh drift the review flags.
2. Several compliance fixes are **code-blocked on policy artifacts that don't exist yet** (see [Blocked-on-decisions](#code-blocked-on-non-code-decisions)). You cannot "just implement" them.

---

## The tradeoff ledger

### A — Pure gain, no loss (the bulk of the list)

ETL auth, admin fail-closed, `load-fx` SQL injection, path traversal, security headers, CI audit/secret-scan/lint gates, keyset Prev/Next, filter-scope restoration, numeric-validation parity, `annex_suspect` parity, column parity, GROUP-BY de-dup, `OR IGNORE` drop, accessibility (Ac1/Ac2, focusable pagination), money/pct formatting edge cases, licence/attribution (O1), dead-code & stale-reference cleanup, test coverage.

Several of these **add** visible data: fixing `OR IGNORE` and the GROUP-BY collapse surfaces **more** real contracts; fixing fabricated ranks yields correct labels. Nothing here removes capability.

### B — Looks like a regression, is actually an integrity gain

- **Honest freshness.** Data has been frozen since 2026-05-24 (the foreign-IP 403 documented in the code review's cron-403 finding). The site currently *hides* this and advances `refreshed_at` anyway. The fix makes staleness visible — it will look less fresh because it *is*. Honesty, but stakeholders may read it as a downgrade → needs a changelog note.
- **Corrected leaderboard sums.** Fixing the `annex_suspect` divergence changes published totals (the bug inflated some ≥100×). Numbers move — possibly down — under existing URLs.
- **Filtered CSV scope.** The companies CSV currently exports the *full* rollup under a filtered URL; the fix returns the filtered subset. Anyone relying on that quirk to grab a full dump loses it (the authorities CSV already behaves correctly — this just removes the inconsistency).

These are *perceived-quality* costs only. Mitigation is communication, not code.

### C — Genuine functionality loss (legally driven)

- **Natural-person names disappear.** чл. 8 mandates full anonymization of personal data before publication; `bidders.name` currently publishes ЕТ sole-trader / individual-winner full personal names to profiles, search, CSV, sitemap, and `/contracts/:id.json`. Redacting them removes a class of entities from the transparency surface. **This is the central irony:** the site exists to name who takes public money, and the controlling agreement requires *not* naming the natural persons among them. Loss is bounded — GDPR doesn't protect legal persons, so **company/legal-entity leaderboards survive intact**; only ЕТ and individual winners get pseudonymized. The `legal_form` classifier hook already exists, so it's buildable — but it *is* a real reduction in transparency.
- **Owner tables.** `company_owners`/`beneficial_owners` hold natural-person names but are never served. The data-minimization fix drops the name columns — foreclosing a future "show beneficial ownership" feature unless lawful-basis + retention + access-boundary machinery is built instead. Either lose the capability or pay ongoing compliance cost to retain it.
- **Trade-secret redaction (чл. 8, second limb).** Beyond personal data, чл. 8 also requires anonymizing trade-secret data. Scope TBD (gated on the team's exclusion list), but could mean redacting some contract fields — a further, currently-unsized data loss.

### D — Architectural / future cost

- **H1 (hosting).** Taken literally, moving from Cloudflare to the Държавен облак for data residency means abandoning the entire Workers/D1/DO/Vectorize/edge-cache stack and the kolkostruva reuse — a large re-architecture and a real loss of the current model's benefits. **Non-obvious upside:** the data freeze is *caused* by Cloudflare's non-BG egress IP getting 403'd by data.egov.bg. A BG-hosted deployment could fix the single worst operational problem (frozen data) *and* satisfy data residency at once. So H1 is the one "loss" that may pay for itself.
- **Al1 (risk layer).** The parked risk-scoring feature, when resumed, inherits a heavy compliance envelope: public algorithms, per-score explainability, an appeal path, logged decisions. Implementing the feedback raises the future cost of that feature — it loses nothing today.

### E — Cosmetic shape changes (not real losses)

CSV cells gaining a leading `'` on formula-prefixed values; edge-cache hit-rate dipping slightly under a `Vary`/anonymous guard or per-response nonce rewrite; `xlsx` → minimal RFC-4180 splitter (drops general spreadsheet parsing the loader never used); touch-target layout tweaks.

---

## The two real tensions to escalate

1. **Transparency ⟂ anonymization.** A decision, not a bug. чл. 8 wins legally, so the practical answer is "anonymize natural persons, keep legal entities" — but someone owns the product call on how much ЕТ-level transparency to lose, and the чл. 8 ruleset must define exactly who counts as a natural person and how to pseudonymize. **Code cannot ship before that ruleset exists.**
2. **Stack benefits ⟂ data residency.** H1 forces a choice between the Cloudflare advantages and BG hosting. Because BG hosting also unfreezes the data, this is more "which set of benefits" than "gain vs. loss."

---

## Code blocked on non-code decisions

You cannot implement the full feedback in code alone. These are gated on team-owned artifacts the audit lists:

- **A4 / natural-person redaction** → needs the чл. 8 anonymization spec (ЕТ handling).
- **Trade-secret redaction** → needs the exclusion list (reform #18).
- **O1 attribution** → needs the licence/attribution policy.
- **H1** → needs the hosting decision (+ DPIA, lawful basis / LIA, RoPA).

---

## Phased remediation sequence

### Phase 0 — Ship now (unblocked, pure gain) — clusters A + B
1. **Close the ETL write path** (Critical + High + Medium + Low). Auth gate on every non-`/health` route, body schema validation, disable `workers_dev`, gate the `releases` fixture behind a dev-only flag, add rate-limit/concurrency guard.
2. **Coordinated ingest-hardening pass** (one branch over `packages/ingest` + `scripts/*`): numeric-validation parity, `publishedDate` fallback, `load-fx`/`load-ocds` injection guards, feed-URI path-traversal sanitization, atomic staging.
3. **Coordinated DB-script pass** (factor shared SQL so normalize/refresh can't drift): `annex_suspect` parity, column parity, GROUP-BY de-dup, `OR IGNORE` fix, count/freshness definitions, honest `refreshed_at`.
4. **UI scope/paging fixes:** FilterRail hidden inputs, companies-CSV filter forwarding, direction-aware `pageCursors`, first-page Prev guards.
5. **Security headers** via one shared helper across web resource routes + `apps/api`.
6. **CSV formula-injection** shared-helper fix.
7. **Accessibility** (Ac1 focus management, Ac2 touch targets/reflow, focusable pagination).
8. **CI gates** (`pnpm audit`, secret scan, wire `lint`), `xlsx` replacement, deploy-guard `CLOUDFLARE_ACCOUNT_ID`.
9. **Formatting / cleanup / test-coverage** low+info items.

> Items in Phase 0 B (honest freshness, corrected sums, filtered-CSV scope) need a **changelog/stakeholder note** so the corrected numbers don't read as a regression.

### Phase 1 — Policy-gated (land code behind the decision)
- **A4 anonymization stage** + the "no natural-person name reaches any published surface" test — once the чл. 8 ruleset exists. Pseudonymize ЕТ/individuals across `bidders.name` consumers (profile, search_index, CSV, sitemap, `/contracts/:id.json`).
- **Owner-table minimization** (drop name columns or build retention/erasure + access boundary) — once lawful basis is decided.
- **Trade-secret redaction** — once the exclusion list exists.
- **O1 licence/attribution** on exports + per-dataset attribution register — once the policy exists.

### Phase 2 — Own track (doubles as the freeze fix)
- **H1 hosting / data-residency** reconciliation. Treat as the fix for the foreign-IP 403 data freeze, not only a compliance line. Evaluate BG-hosted deployment vs. retaining Cloudflare with a BG egress path.

### Deferred / forward-looking
- **Al1 algorithmic transparency** — applies only if/when the risk layer resumes. Bank the requirement; no code today.

---

## Net answer

It is **not** "only a gain." It's overwhelmingly gain — but we lose **(a)** transparency for natural-person contractors (legally required, bounded to ЕТ/individuals), **(b)** optionally the beneficial-owner data unless we pay to retain it, and **(c)** potentially the Cloudflare architecture if H1 is honored. Everything else either improves the product outright or trades a *perception* of freshness/size for *actual* correctness. The hardest items aren't really code problems — they're the transparency-vs-law and stack-vs-residency decisions the engineering work is downstream of.
