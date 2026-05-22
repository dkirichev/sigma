-- Sigma — open-data (data.egov.bg) procurement staging.
--
-- Lossless landing for the АОП "Договори и изменения" CSV register pulled from the
-- national open-data portal (org 502) by scripts/load-egov.mjs. One row = one
-- contract line, mapped by Bulgarian header name (robust to column drift).
--
-- The open CSV is BROADER than the xlsx bootstrap (all sectors, 2016–2023, in BGN)
-- but THINNER per row: it carries NO procedure type, CPV code, estimated value or lot
-- structure. Those procedure-level fields are kept here as NULL "enrichment slots"
-- and filled by a SECOND pass — an admin export from ЦАИС ЕОП, or the OCDS feed —
-- joined on УНП (unp). `needs_enrichment = 1` marks every row still awaiting that fill,
-- so the second run can target exactly the gaps. See docs/etl-pipeline.md.

CREATE TABLE IF NOT EXISTS raw_egov_contracts (
  id               INTEGER PRIMARY KEY,
  source           TEXT NOT NULL,        -- provenance, e.g. 'egov:contracts:2023:CE'
  dataset_uri      TEXT,                 -- portal dataset uri
  resource_uri     TEXT,                 -- portal resource uri
  dataset_year     INTEGER,
  dataset_variant  TEXT,                 -- 'CE' = ЦАИС ЕОП | 'ROP' = РОП
  fetched_at       TEXT NOT NULL,        -- ISO timestamp of the pull

  -- open-data contract register (column = Bulgarian header it maps from)
  seq_no               TEXT,             -- Пореден номер
  document_number      TEXT,             -- Номер на документ
  contract_number      TEXT,             -- Номер на договор
  contract_date        TEXT,             -- Дата на договор (ISO)
  published_at         TEXT,             -- Публикуван на (ISO)
  unp                  TEXT,             -- Уникален номер на поръчката  ← join key
  authority_eik        TEXT,             -- ЕИК на възложителя
  authority_name       TEXT,             -- Възложител
  procurement_subject  TEXT,             -- Предмет на поръчката
  contract_kind        TEXT,             -- Обект на поръчката (Доставки/Услуги/Строителство)
  eu_funded            INTEGER,          -- EU финансиране (0/1)
  bids_received        INTEGER,          -- Брой оферти
  contract_subject     TEXT,             -- Предмет на договора
  contractor_eik       TEXT,             -- ЕИК на изпълнителя (leading zeros kept)
  contractor_name      TEXT,             -- Изпълнител
  signing_value        REAL,             -- Стойност при сключване
  currency             TEXT,             -- Валута (BGN in the open data)
  vat                  TEXT,             -- ДДС
  sme                  TEXT,             -- Малко или средно предприятие (МСП)

  -- enrichment slots — NULL from open data; filled by ЦАИС ЕОП export / OCDS on unp
  procedure_type   TEXT,                 -- Вид на процедурата
  cpv_code         TEXT,                 -- CPV код
  estimated_value  REAL,                 -- Прогнозна стойност
  current_value    REAL,                 -- Текуща стойност (от изменения/анекси)

  -- enrichment tracking
  needs_enrichment   INTEGER NOT NULL DEFAULT 1,  -- 1 = procedure-level fields still missing
  enriched_at        TEXT,
  enrichment_source  TEXT
);
CREATE INDEX IF NOT EXISTS idx_egov_unp ON raw_egov_contracts(unp);
CREATE INDEX IF NOT EXISTS idx_egov_eik ON raw_egov_contracts(contractor_eik);
CREATE INDEX IF NOT EXISTS idx_egov_year ON raw_egov_contracts(dataset_year);
CREATE INDEX IF NOT EXISTS idx_egov_needs_enrichment ON raw_egov_contracts(needs_enrichment);
