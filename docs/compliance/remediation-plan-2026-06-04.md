# Sigma — Remediation plan: tradeoff-tier items (2026-06-04)

_Executable companion to [`tradeoff-analysis-2026-06-04.md`](tradeoff-analysis-2026-06-04.md). That doc tiers the full feedback (the [code review](../qa/code-review-2026-06-03.md) + the [compliance audit](code-compliance-audit-2026-06-03.md)); **this** doc plans the tiers that involve a real **choice** — **C** (functionality loss), **D** (architectural/future cost), **E** (cosmetic). Tiers **A** (pure gain) and **B** (integrity gain that reads as a regression) are pure execution — sequence them per the tradeoff analysis "Phase 0"; they are not re-detailed here._

**Governing principle (operator decision, 2026-06-04):** Sigma **complies with the law** (GDPR + Bulgarian law) and does **not** self-impose anonymization stricter than the law requires. The АОП–МИДТ **чл. 8** anonymization clause is read as a **contractual control flowed down to the operator (ИО)** — not a publishing constraint on Sigma's *output* beyond what GDPR / Bulgarian law demand. This supersedes the compliance audit's premise that чл. 8 is "the controlling legal basis … full anonymization before any use or publication" binding Sigma's published surfaces.

> Open dependency for the whole of Tier C: confirm against the **signed** АОП–МИДТ agreement (the audit cites only the v3 *draft*) that чл. 8 imposes no stricter obligation directly on МИДТ. If it does, parts of C1 reopen.

---

## Tier C — functionality / data exposure

### C1 — Publish ЕТ / individual-winner names (lawful); no redaction

**Supersedes audit finding A4** ("no in-pipeline anonymization enforcement") and the Round-2 "redact `bidders.name`" recommendation. We **reject** the blanket-redaction approach on the basis below.

**Legal basis**
- **Companies / legal persons** — out of GDPR scope entirely (Recital 14: the name and form of a legal person are not protected). Publish freely.
- **ЕТ (sole traders) / individual winners** — legally *natural persons*, so the name **is** personal data; but it is **already lawfully public** in two state registers and we have a lawful basis to republish:
  - The ЕТ's фирма **must** contain the owner's personal name (**ТЗ чл. 59**) and is recorded in the public **Търговски регистър** (ЗТРРЮЛНЦ — публичност).
  - The award itself is **already published by АОП in РОП / ЦАИС ЕОП** under ЗОП, free and open to "any natural or legal person."
  - Sigma republishes it under **GDPR Art 6(1)(e)** (public-interest task — anti-corruption transparency) / **6(1)(f)** (legitimate interest).

**Action items**
1. **No code change** to bidder-name handling. Do **not** build the A4 classify-redact pipeline stage or the "no natural-person name reaches any published field" guard. _(file: none — explicit non-action)_
2. **[team/legal]** Record the Art 6 lawful basis + a short **LIA** (legitimate-interest assessment) for republishing ЕТ/individual names.
3. **[verify]** Confirm Sigma ingests **only already-public РОП/ТР data** — no non-public source that would re-expose data АОП withheld. _(ingest sources: `packages/ingest/*`, `scripts/load-*.mjs`)_
4. **[team/legal]** Keep a real **Art 21 objection / Art 17 erasure** path for a named natural person who objects.
5. **[verify]** Confirm the signed чл. 8 (see open dependency above) imposes no stricter МИДТ obligation.

**Caveat to honour (manner of publication, not whether):** lawful public data can still shift proportionality when **aggregated, ranked, bulk-exported, and search-indexed** — the amplification the CJEU flagged in *Sovim*. The public interest in procurement is strong, but: don't make ЕТ data *more* exposed than РОП itself. Concretely — keep single-natural-person profile pages `noindex`, and keep the objection path real (item 4). _(surfaces: `company.tsx`, `search_index`, companies CSV, company sitemap, `/contracts/:id.json`.)_

### C2 — Remove the unserved ownership tables (`company_owners`, `beneficial_owners`)

**Why (hygiene first):** both domain tables are **written by the TR ETL and read by nothing** — verified zero `SELECT`/`JOIN` across `apps/` and `packages/` (only DDL + the loader/normalizer writers). They are incomplete, unserved dead weight that also holds natural-person **names** at rest (no EGN was ever stored — the feed hashes personal IDs and the loader drops the identifier column).

**What each actually is (verified):**
- `company_owners` ← TR `Partners` / `SoleCapitalOwner` / `Managers` / `Representatives` (direct owners + governance roles), via `raw_tr_owners`. _(`load-tr.mjs:139-145`, `normalize-egov.sql:319-323`, `0000_init.sql:166-176`)_
- `beneficial_owners` ← a **genuinely separate** stream: TR `ActualOwners.ActualOwner` = **чл. 63 ЗМИП действителни собственици** declarations, via `raw_tr_actual_owners` — real UBO data, not direct ownership relabeled. _(`load-tr.mjs:147-153`, `normalize-egov.sql:325-329`, `0000_init.sql:178-187`)_

**Action items**
1. **Drop** `company_owners` and `beneficial_owners` domain tables (migration). _(`packages/db/migrations/*`, `0000_init.sql:166-187`, indexes `:653-658`)_
2. **Stop staging/normalizing** them: remove the `ActualOwners` extraction + `raw_tr_owners` / `raw_tr_actual_owners` staging and the rebuild SELECTs. _(`scripts/load-tr.mjs:139-153,241-243`, `scripts/normalize-egov.sql:319-329`)_
3. **Optional:** retain company→company `owner_eik` **edges only** (legal persons, no PII) if the ownership-graph idea is wanted later; drop every `owner_name` column / natural-person row.

**Future-publishing note (the split matters):**
- **Direct ownership** (`company_owners` — съдружници / capital owners): may be republished later on the **same basis as C1** — normal public TR registration data + Art 6.
- **Beneficial ownership** (`beneficial_owners` — чл. 63 ЗМИП): **do not** republish to the general public. *Sovim* (C-601/20) + Bulgaria's **4 Jun 2025 legitimate-interest decree** and the **2026 AML package** gate UBO data to *legitimate-interest* access; a general-public bulk/searchable re-publication is the exact disproportionate profiling the CJEU struck down — and the public TR source itself is being gated. Revisit only as legitimate-interest-gated, or company-edge-only (no PII).

### C3 — Trade-secret data: no Sigma-side redaction

**Resolves the trade-secret limb of АОП чл. 8.** The agreement's requirement for full anonymization of *both* personal data *and* trade-secret-protected data is, per `io-letter-aop-opendata.md` (request #4), to be built **programmatically and deterministically into ИО's export pipeline at ЦАИС ЕОП**, applied automatically before publication to data.egov.bg. Sigma is a **downstream consumer** of that already-anonymized open-data feed (org № 502) — not the anonymizer. This mirrors C1: the чл. 8 control lives upstream, by МИДТ's own design.

**Action items**
1. **No code stage.** Do not build a trade-secret redaction step in Sigma. _(file: none — explicit non-action)_
2. **[verify]** Ingest **only** the official data.egov.bg feed (org № 502); no side-channel / non-public source. _(ingest: `scripts/load-*.mjs`, `packages/ingest/*`)_
3. **[process]** Treat any unredacted trade secret (or personal data) found in the feed as an **upstream defect to report to ИО** — not a downstream patch. The obligation and the control both sit at the source pipeline.

---

## Tier D — architectural / future cost

### D1 — Hosting: keep Cloudflare; fix the data freeze via a BG proxy

**Supersedes audit finding H1** ("Cloudflare vs. Държавен облак data-residency gap"). H1 misread the operating model.

**Basis (МИДТ's own policy letters)**
- Cloudflare is the **ministerially-sanctioned host** for Sigma + future open-source projects: `io-letter-sigma.md` formally requests ИО to create/maintain a Cloudflare account in МИДТ's name and delegate `sigma.midt.bg` to it.
- The systems are documented as **outside critical infrastructure, open data + open code only** (`роли-и-отговорности-МИДТ-ИО-съветник.md`: _"извън критичната инфраструктура, само с отворени и анонимизирани данни"_). So the **ЗЕУ / ДХЧО** state-cloud mandate and **NIS2 essential-entity** obligations — calibrated to administrative information systems / e-administrative services handling protected data — do not bite. The Наредба за общите изисквания's open-data provisions actually *support* what Sigma does.

**Action items**
1. **Keep Cloudflare.** No re-platforming as a compliance item. _(deploy: `apps/*/wrangler.*`)_
2. **Pursue the already-requested BG-located proxy** for `data.egov.bg` (`io-letter-sigma.md` #5) — a BG IP that transparently forwards the fetch, fixing the 2026-05-24 foreign-IP-403 freeze **without leaving Cloudflare**. _(ETL fetch: `apps/etl/src/index.ts:42-69`)_
3. **Future (not a remediation item):** state-cloud hosting under ИО's SOC is the *sustainable-phase* model — applies *if/when ИО assumes the maintainer/production role* (`роли…` phase table). Track as an operating-model evolution, not a code/deploy fix.

### D2 — Algorithmic transparency for the (parked) risk layer

**Audit finding Al1**, reframed under "comply with the law only."

- The public risk-score per procurement is a **stated goal** (`роли…`) but is currently **parked** (`sigma/core-scope.md`).
- The наредба за алгоритмичен одит requirements (public algorithm, per-score explainability, appeal/challenge path, logged decisions) **bind only once enacted** — not yet law (pending "20 amendments + 2 наредби").
- **Open-source already satisfies the "public algorithm" limb by design** — the code is public.

**Action items**
1. **No build now.** _(file: none)_
2. **Bank the design constraints** for when the layer resumes: per-score explainability, an appeal/challenge path, logged algorithmic decisions. _(record in the risk-layer spec / `sigma/core-scope.md` when revived.)_
3. **Fix the feeder bugs as Tier A regardless** — a shared API shouldn't ship wrong-but-plausible output even while parked: price-anomaly "no reference = parity", `clamp(NaN)`, `round2` float edge. _(`packages/analysis/src/price-anomaly.ts:18-24`, `packages/shared/src/index.ts:16-22`)_

---

## Tier E — accepted shape-changes (side-effects of Tier-A fixes)

No standalone work — each item is the minor side-effect of a Tier-A security/a11y fix. Documented so they aren't surprises, with one pre-check.

1. **CSV formula-guard** adds a leading `'` to cells starting with `= + - @ \t \r`. Excel/Sheets strip it on display; a *programmatic* CSV consumer sees it. → **Accept** (note for downstream consumers). _(`packages/db/src/queries/{contracts,companies,authorities}.ts` cell helpers)_
2. **Edge-cache fix:** use **nonce-less CSP (hashes / `strict-dynamic`) on cacheable routes** so cache effectiveness is preserved with no per-response rewrite. → **Accept** (choose the nonce-less approach). _(`apps/web/workers/app.ts:40-58`, `apps/web/app/lib/security.ts`)_
3. **`xlsx@0.18.5` replacement — pre-check required (not purely cosmetic until confirmed).** A minimal RFC-4180 splitter only works if the АОП export is text/CSV. **First verify the real input format** in `load-admin.mjs`; if it's binary `.xlsx`, switch to the patched build instead of a splitter. _(`scripts/load-admin.mjs:24,315-321`)_
4. **Ac2 touch targets ≥24px + mobile reflow** — slightly larger header controls, fixed `/methodology` + company-detail horizontal overflow. Minor visual change, a11y gain. → **Accept.**
