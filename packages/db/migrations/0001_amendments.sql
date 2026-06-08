-- Served schema increment: domain amendments and removal of work-only staging tables.

DROP TABLE IF EXISTS raw_ocds_lots;
DROP TABLE IF EXISTS raw_ocds_award_suppliers;
DROP TABLE IF EXISTS raw_ocds_parties;
DROP TABLE IF EXISTS raw_egov_amendments;
DROP TABLE IF EXISTS raw_egov_tenders;
DROP TABLE IF EXISTS raw_egov_contracts;
DROP TABLE IF EXISTS raw_tr_companies;

CREATE TABLE amendments (
  id              TEXT PRIMARY KEY,
  natural_key     TEXT NOT NULL UNIQUE,
  contract_number TEXT,
  unp             TEXT,
  value_before    REAL,
  value_after     REAL,
  value_delta     REAL,
  currency        TEXT,
  published_at    TEXT,
  document_number TEXT,
  description     TEXT,
  source          TEXT NOT NULL
);

CREATE INDEX idx_amendments_contract ON amendments(unp, contract_number);
