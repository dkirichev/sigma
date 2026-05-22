-- Sigma — open-data amendments (изменения / анекси).
--
-- One row per contract amendment, from the АОП "Договори и изменения" annexes CSVs
-- (2016–2023, loaded by scripts/load-annexes.mjs) and the OCDS contractAmendment
-- releases (2026+, loaded by scripts/load-ocds.mjs). Linked to raw_egov_contracts by
-- (unp, contract_number). scripts/derive-amendments.sql then rolls these up onto each
-- contract: current_value (latest after-value) + annex_count.
--
-- This is the value-growth / frequent-annex evidence base — current_value is core
-- (the estimated→signing→current history); annex_count + reason/delta feed the parked
-- red-flag signals (#3 ръст на стойността, #4 чести анекси). See docs/etl-pipeline.md.

CREATE TABLE IF NOT EXISTS raw_egov_amendments (
  id               INTEGER PRIMARY KEY,
  source           TEXT NOT NULL,        -- 'egov:annexes:2023:CE' | 'ocds:2026:…'
  dataset_uri      TEXT,
  resource_uri     TEXT,
  dataset_year     INTEGER,
  dataset_variant  TEXT,                 -- 'CE' | 'ROP' | 'OCDS'
  fetched_at       TEXT NOT NULL,

  seq_no               TEXT,
  document_number      TEXT,
  contract_number      TEXT,             -- ← link to raw_egov_contracts
  contract_date        TEXT,             -- original contract date
  published_at         TEXT,             -- amendment publication date (ordering key)
  unp                  TEXT,             -- ← link to raw_egov_contracts
  authority_eik        TEXT,
  authority_name       TEXT,
  procurement_subject  TEXT,
  contract_kind        TEXT,
  eu_funded            INTEGER,
  contract_subject     TEXT,
  contractor_eik       TEXT,
  contractor_name      TEXT,

  value_before     REAL,                 -- Стойност преди изменението
  value_after      REAL,                 -- Стойност след изменението  → current_value
  value_delta      REAL,                 -- Изменение на стойността
  currency         TEXT,
  description      TEXT,                  -- Описание на измененията
  reason           TEXT,                  -- Причини за изменение (ЗОП основание)
  circumstances    TEXT,                  -- Обстоятелства
  sme              TEXT
);
CREATE INDEX IF NOT EXISTS idx_egov_amend_contract ON raw_egov_amendments(unp, contract_number);
CREATE INDEX IF NOT EXISTS idx_egov_amend_source ON raw_egov_amendments(source);

-- Rolled up onto each contract by derive-amendments.sql (0 = no amendments).
ALTER TABLE raw_egov_contracts ADD COLUMN annex_count INTEGER DEFAULT 0;
