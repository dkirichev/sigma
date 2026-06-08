# Cleanup plan — single-source EOP, remove stale apps & dead code

**Status:** proposed — nothing executed. A descriptive task list (no line numbers on purpose — the
working tree is volatile, so anchor on symbol/file names and re-ground at execution time).

**Scope rules (per decisions):**
- `mocks/` and `docs/` are **left as-is** — out of scope for this cleanup.
- The `raw_egov_*` rename is its own separate refactor (§3), not bundled with the deletions.
- Execute **after** the in-flight `etl-work-db-split` refactor settles (the tree currently carries that
  session's uncommitted WIP).

**Provenance:** the orphan/dead-code findings come from a symbol-level grep audit (authoritative).
`graphify` (installed locally for Claude + Codex) was used to map module-level dependencies — it
corroborated that the three stale apps are low-connectivity modules, but its AST symbol extraction is
incomplete for this TS workspace, so it is not the source of the symbol-level orphan list.

---

## 1. Remove the three non-deployed apps

The v1 deploy set is only `@sigma/web` + `@sigma/etl`. Remove:
- **`apps/assistant`** — stub; replaced by `apps/web/app/lib/assistant/` on `feat/ai-assistant`.
- **`apps/admin`** — parked ops UI, never deployed.
- **`apps/api`** — never deployed; the explorer reads D1 directly via `@sigma/db`.
- **`packages/assistant-tools`** — imported only by `apps/assistant`.

**Relocate the local D1 anchor first (before deleting `apps/api`).** The local miniflare D1 that
`pnpm import` / `pnpm setup` populate and `pnpm dev` reads is currently rooted under `apps/api`. The
import/setup/teardown scripts and `apps/web/vite.config.ts` all point at `apps/api/.wrangler/state`.
Repoint them to `apps/web` (which already declares an identical D1 binding), relocate the existing
state, and smoke `setup → import → dev` before removing `apps/api`.

**Other references to update:** the "consumed by apps/api" comment in `@sigma/api-contract`; the
`ADMIN_BASIC_AUTH_*` block in `.dev.vars.example` (keep `AI_GATEWAY_*`); the api/assistant/admin port
forwards in `.devcontainer/devcontainer.json`; and the apps/packages rows in `README.md`.

**Follow-ups:** `pnpm install` (regenerate the lockfile — don't hand-edit), then typecheck/build/test.
The deploy workflow targets only web+etl, so it is unaffected.

---

## 2. Make `storage.eop.bg` the sole import source

**Delete the obsolete-source loaders:** `scripts/load-admin.mjs` (admin/ЦАИС export),
`scripts/load-ocds.mjs` (retired `data.egov.bg` wrapper), `scripts/load-tr.mjs` (Trade Register via
`data.egov.bg`). None is invoked by `import.mjs`.

**Strip the `admin:%` source handling from shared statements (keep the eop/ocds arms):**
- the `admin:%` disjunct in the `normalize-egov.sql` source filter,
- the `admin:%` pricing branch in `load-fx.mjs` (the FX loader otherwise stays whole),
- the unreachable `admin` arm of the id-prefix CASE in `normalize-egov.sql` (live ids are `c:e:%`/`c:o:%`),
- the admin "bare-id rows win" guards in `refresh-slice.sql`.

**Keep — looks admin/egov but the eop path reuses it:** the `raw_egov_*` staging tables (see §3), the
`raw_ocds_*` tables, the OCDS mappers in `@sigma/ingest`, the `idx_egov_*` indexes, and the FX + NUTS
**reference** loaders (`load-fx.mjs` minus its admin branch; `load-nuts.sql`).

---

## 3. Rename `raw_egov_*` → eop-named staging (separate refactor)

The `raw_egov_*` staging tables and `idx_egov_*` indexes are misnamed: they are now fed by `eop:%`
rows, not `data.egov.bg`. The "unified eop+ocds ETL" direction eliminates the `egov` naming.

> **Note:** the `eop-ocds-unified-etl` branch is **not present** in this repo (no local/remote ref;
> every branch here still uses `raw_egov_*`). Reconcile with that branch when it lands, or do the
> rename here from scratch.

This is a **rename, not a deletion** (the tables are live). The change surface a rename must touch:
- **schema:** the `raw_egov_*` table + `idx_egov_*` index definitions in `work-staging-schema.sql`;
- **ingest:** the table maps in `base.ts`/`staging.ts`, and the upsert/delete SQL generation;
- **SQL pipeline:** `normalize-egov.sql`, `refresh-slice.sql`, `derive-amendments.sql`, `promote-amendments.sql`;
- **readers:** the `FROM raw_egov_*` reads in `import.mjs` and `load-fx.mjs`;
- **refresh lifecycle:** the transient-staging name list in `@sigma/ingest`'s `refresh.ts`;
- **tests:** `refresh-slice.test.ts`, `ocds.test.ts`, `eop.test.ts`, `load-eop.test.mjs`, `migrations.test.ts`.
- Consider renaming `normalize-egov.sql` itself in the same pass.

---

## 4. Remove the parked Trade-Register chain

The owner tables are already gone on this branch; what remains is small and self-contained:
- the `raw_tr_companies` staging table + its index in `work-staging-schema.sql`;
- the "Company master from the Trade Register" block in `normalize-egov.sql`;
- in `@sigma/ingest`'s `refresh.ts`, the guard that exists **only** to spare `raw_tr_companies`
  (`isExcludedWorkTable`) — delete it and simplify the staging filter;
- the `raw_tr_companies` fixture/assertion in `ocds.test.ts`;
- the "Trade Register" mentions in `@sigma/db`'s `schema.ts` comments.

**Safety:** no live route reads TR tables. `company.tsx` → `getCompany` reads only
`company_totals` / `bidders` / `contracts` / `tenders` / `authorities`. The `bidders` address &
legal-form columns **stay** (also populated from OCDS parties / NSI); only the TR enrichment stops.

---

## 5. Remove the parked consortium-attribution layer

Confirmed fully dead (no `INSERT/UPDATE INTO bidder_members`; no `FROM/JOIN contract_participants`;
both result-shape interfaces have zero importers):
- the `bidder_members` table + its index, and the `contract_participants` view, in `0000_init.sql`;
- the no-op `DELETE FROM bidder_members` in `normalize-egov.sql`;
- the `BidderMemberRow` and `ContractParticipantRow` interfaces in `@sigma/db`'s `schema.ts`.

**Keep — this is the LIVE path, not the dead layer:** `parseConsortiumMembers` /
`ConsortiumMembership` (`@sigma/shared`) and `ConsortiumParticipant` (`@sigma/api-contract`) parse the
`contractor_name` string for display and are used by `@sigma/db`'s `details.ts` and
`apps/web/.../companies.tsx`. Only their stale "TR backfill parked" comments need updating.

---

## 6. Remove orphan / unused code (symbol audit)

**Standalone orphans — safe to remove now (referenced only in their own file):**
- `getSectorTotals` + `SectorTotalRow` in `@sigma/db`'s `queries/sectors.ts`;
- `CPV_CATEGORY_BY_DIVISION` in `@sigma/config` (used only by `categoryForDivision` in-file).

**Config orphans (zero external refs):** `PRICE_INDEX_CATEGORIES` (with its derived `PriceIndexCategory`
type + comment), `CURATED_SECTORS`, `RISK_BAND_LABELS`. **Keep** `CpvSector`, `RiskBand`, `requireEnv`
(all have live callers).

**Over-exported helpers — drop the `export`, keep them as private (used only in-file + their own test):**
`monthYear` (`@sigma/shared` format), `encodeCursor`/`decodeCursor` (`@sigma/db` keyset),
`searchMoreHref` (`@sigma/db` search), `CONTRACTS_PER_SITEMAP` (`@sigma/db` sitemaps),
`toSecuredFinancing`/`toVariants`/`baseColumnKind` (`@sigma/ingest` base),
`splitSqlStatements`/`transientStagingStatements`/`dropTransientStagingStatements` (`@sigma/ingest`
refresh), and `ISODate`/`Brand`/`isDefined`/`assert` (`@sigma/shared` index).

**Remove together with the dead apps (these go orphan once apps/api + apps/admin are gone — remove
with them, not before, or the build breaks):**
- `@sigma/db` exports used only by api/admin: `getTenderById`, `listRecentTenders`, `sectorBreakdown`,
  `SectorBreakdownRow`;
- the legacy `@sigma/api-contract` DTO surface: `TenderSummary`, `TenderDetail`, `SearchTendersQuery`,
  `SearchTendersResponse`, `SectorsResponse`, `ApiError`, `API_ROUTES`;
- `Money` / `Currency` in `@sigma/shared` — remove once the legacy `estimatedValue` DTO that uses them
  is gone.

---

## 7. Owner-gated (decide intent before removing)

- **`raw_ocds_award_suppliers`** — it is staged (a writer exists) but **never read** (no `FROM`/`JOIN`).
  Looks like wired-but-unused supplier normalization. If supplier normalization is abandoned, remove the
  table together with its writer rows; otherwise keep.

---

## 8. Keep (looks dead, isn't) — guardrails

- `@sigma/analysis` + the `risk_scores` schema + `upsertRiskScore` — parked, but `feat/ai-assistant`
  wires `@sigma/analysis` into the web app.
- `@sigma/db`, `@sigma/config`, `@sigma/shared`, `@sigma/api-contract` (live parts);
  `CpvSector`/`RiskBand`/`requireEnv`.
- FX + NUTS reference data; the `raw_egov_*` / `raw_ocds_*` staging tables and OCDS mappers (live);
  the `bidders` / `authorities` master tables.
- `apps/web`, `apps/etl`.
- `mocks/` and `docs/` — intentionally untouched this pass. (Aside: `docs/deploy.md`'s cron section
  still describes the retired `data.egov.bg` feed and is stale, but it is out of scope here.)

---

## 9. Sequencing & verification (when approved, after the etl-refactor settles)

1. Re-ground against the then-current tree.
2. **Privatizations + standalone orphans first** (§6 in-file helpers, `getSectorTotals`, `CPV_CATEGORY_BY_DIVISION`) — zero cross-package risk.
3. **Apps + their dependents together** (§1, plus the §6 "remove with the apps" exports/DTOs) — including the D1-anchor relocation done and smoke-tested before deleting `apps/api`.
4. **Single-source EOP strip** (§2).
5. **TR chain** (§4) and **consortium layer** (§5), each atomic.
6. **Config orphans** (§6).
7. **`raw_egov_*` rename** (§3) as its own separate change.
8. `pnpm install`; verify `pnpm --filter @sigma/ingest test`, then `pnpm -w typecheck` (gate per-package — `db` `details.test.ts` is pre-existingly red), `pnpm -w build`, `pnpm -w test`; confirm the deploy workflow still resolves `@sigma/web` + `@sigma/etl`.
