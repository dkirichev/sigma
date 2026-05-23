# Mock v1 — data coverage against the current D1

> What of the rendered mockups in [`mocks/v1/`](../mocks/v1/) can be built from the **data we
> actually hold** in the domain today, and what cannot. Companion to
> [core-scope.md](core-scope.md) (the intended scope) — this is the **as-built check** of the
> HTML mocks against the populated tables.
>
> Design prose in English; user-facing copy in **Bulgarian**.

**Assessed 2026-05-24.** Verdict: the eight core explorer pages are **largely buildable** — all
the analytics (leaderboards, breakdowns, flows, value timelines, search) and ~90 % of the visible
fields map to populated columns. The misses cluster into **seven categories**, and five of the
seven are already declared out-of-scope-for-v1 in the mock's own
[methodology.html](../mocks/v1/methodology.html).

## Basis & caveats

- **Checked against** the schema ([0000_init.sql](../packages/db/migrations/0000_init.sql)), the
  transform ([normalize-egov.sql](../scripts/normalize-egov.sql)) and the documented row counts in
  [etl-pipeline.md](etl-pipeline.md) (admin ЦАИС ЕОП import, May 2026) — **not** a live query (no
  materialized local D1 is present in this checkout; `data/` and `.wrangler` state are gitignored).
- **Figures differ from the mocks, in our favour.** The mocks use placeholder numbers from a
  narrower slice — 2 sectors (строителство/храни), 2020–2024, 129,134 contracts, 47.8 bn лв. The
  live domain is the **full corpus**: all sectors, 2020–2026, **190,427 contracts · 4,868
  authorities · 17,354 companies · ≈50.8 bn EUR**. Every count/total KPI is coverable; the real
  numbers are simply larger and broader.

## Coverable now — per page

| Page | Coverable as drawn | Gaps on this page (see tables below) |
| --- | --- | --- |
| [index.html](../mocks/v1/index.html) | KPI cards, Top-10 companies, freshness date | "ministries vs municipalities" split needs `type` bucketing |
| [search.html](../mocks/v1/search.html) | Institutions, companies (name+ЕИК), contracts (предмет+УНП), lots | city/location matching |
| [companies.html](../mocks/v1/companies.html) | Leaderboard; sort by spend/count/#authorities/name; total won (BGN+EUR); contract & authority counts | city column; entity-type filter (only обединение vs дружество); **"3 участника"** member count |
| [company.html](../mocks/v1/company.html) | "Откъде печели", "Как печели" (procedure mix), non-competitive %, EU share, amendment %, recent contracts, CPV mix | location; bid metrics (`bids_received` ~86 % filled); "обособени позиции" sub-count |
| [authorities.html](../mocks/v1/authorities.html) | Leaderboard; sort by spend/count/avg/name; totals; avg contract value | region/city column; clean `type` bucketing |
| [authority.html](../mocks/v1/authority.html) | "Топ изпълнители", "Какво купува" (CPV), "Как купува" (procedure), EU share, distinct suppliers, recent contracts | location; lot sub-count |
| [contracts.html](../mocks/v1/contracts.html) | Filter by year/sector/procedure/value-band/CPV/EU/authority/company; sort date/value; CSV export | none material (sector = derived) |
| [contract.html](../mocks/v1/contract.html) | Value timeline (прогнозна→при сключване→текуща + deltas), party panels with totals + cross-pair links, contract №, УНП, предмет, обект, primary CPV, procedure, bid count, EU flag, signing date, offer deadline | programme name; "Срок за изпълнение"/"Очакван край"; secondary CPV; "Лот 6 от 6" + per-lot table |
| [flows.html](../mocks/v1/flows.html) | Sankey authority→contractor weighted by Σ value + count, node totals, all filters (sector/year/financing/top-N), top-10 table, click-through | none — this is `GROUP BY authority_id, bidder_id` |

## Cannot cover — data absent from D1

| # | Functionality (where it appears) | Why | Note |
| --- | --- | --- | --- |
| 1 | **Geographic location** — authority region/city, company HQ city (lists, detail headers, search, party panels, the omitted map view) | `authorities.region` is never populated (only in demo [seed.sql](../scripts/seed.sql)); `bidders` has **no** location column; the admin export carries no address | Most pervasive gap. Municipality region is partly guessable from the name ("Община Пловдив") — a heuristic, not held data |
| 2 | **Consortium member breakdown & "N участника"** (companies list; persons layer) | `bidder_members` is **empty** — needs the Търговски регистър joined on ЕИК | We can still *label* обединение/ДЗЗД via `is_consortium`/`kind`; we can't list or count members |
| 3 | **Beneficial owners / persons layer** | Not modeled; parked pending Trade Registry | Declared omitted in v1 (methodology.html, core-scope.md → Parked) |
| 4 | **EU-funding programme name** ("ОП Транспортна свързаност 2021–2027" on contract detail) | Only a 0/1 `eu_funded` flag; no programme-name column | The EU-funded share / badge / filter all work — just not the name |
| 5 | **Execution timeline** — "Срок за изпълнение" (duration) & "Очакван край" (expected completion) | No start/end/duration fields in staging or domain | Offer deadline (`deadline_at`) and signing date (`signed_at`) **are** available |
| 6 | **Price-anomaly / signals layer** — concentration index, price-anomaly markers, stored single-bid flags | `risk_scores` empty; the old `price_benchmark` view was retired | Declared omitted in v1. Single-bidder %, non-competitive % and supplier concentration are still computable live — only peer *price* benchmarking is truly absent |
| 7 | **Individual / losing bids & bid amounts** ("who else bid") | `bids` table is **empty by design** — the АОП source gives only a bid *count*, never per-offer rows | The bid *count* (`bids_received`) is available |

## Partially coverable — derivation or schema work, no new data

- **Sector (строителство/храни)** — no `sector` column; derive from the **CPV prefix** (`45*` →
  строителство, `15*` → храни). Trivial; just remember the live DB spans all CPV, so most rows fall
  outside those two buckets. (Already flagged pending in core-scope.md.)
- **Lot ↔ contract link** — "обособена позиция Лот 6 от 6", the per-lot contractor/value table, and
  the "N обособени позиции" sub-counts. `lot_id` **exists in staging** (`raw_egov_contracts.lot_id`)
  but [normalize-egov.sql](../scripts/normalize-egov.sql) drops it — the domain `contracts` table has
  no `lot_id`. Listing a tender's lots (titles, estimated values) works; mapping each lot to its
  winning contract does not. This is a **normalize/schema change, not missing data**.
- **Bid-count metrics** (avg/median bids, single-bidder share, distribution) — derivable from
  `bids_received`, but that field is **~86 % populated**, so these carry a coverage caveat.
- **Entity-type filter on companies** — `kind`/`is_consortium` give обединение vs дружество cleanly;
  **ЕТ** and **чуждестранно** only via name/ЕИК heuristics.
- **Authority `type` buckets** (министерство/община/агенция/болница/училище/друго) — `authorities.type`
  is filled for 4,867/4,868, but mapping the raw "Вид на възложителя" text into clean buckets is a
  classification step (methodology.html flags it as manual/partial).

## Reconciliation with declared scope

The gaps and the design agree closely. Of the seven hard misses, the **map (1)**, **persons layer
(2,3)**, **signals/price-anomaly (6)** and **per-offer bids (7)** are explicitly parked in both
[core-scope.md → Parked](core-scope.md#parked) and methodology.html's "not in v1" / "в подготовка"
lists. The genuinely *new* findings this check adds are narrow: **no location data at all** (region
is NULL in production, not merely unbucketed), the **dropped `lot_id`** (data exists in staging but
not in the domain), and a few **contract-detail fields** (programme name, execution dates, secondary
CPV) that have no home column today.

## Cross-references

- Intended scope & data mapping: [core-scope.md](core-scope.md).
- Pipeline feeding the domain: [etl-pipeline.md](etl-pipeline.md).
- Schema (domain + staging + parked hooks, one file): [0000_init.sql](../packages/db/migrations/0000_init.sql).
- Transform that decides what is populated: [normalize-egov.sql](../scripts/normalize-egov.sql).
- The mocks assessed: [`mocks/v1/`](../mocks/v1/).
