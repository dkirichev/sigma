/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const schemaPath = resolve(root, 'packages/db/migrations/0000_init.sql');
const amendmentsMigrationPath = resolve(root, 'packages/db/migrations/0001_amendments.sql');
const refreshSlicePath = resolve(root, 'scripts/refresh-slice.sql');
const workStagingSchemaPath = resolve(root, 'scripts/work-staging-schema.sql');

function sqlite(dbPath: string, sql: string): string {
  return execFileSync('sqlite3', [dbPath], { input: sql, encoding: 'utf8' });
}

function sqliteJson<T>(dbPath: string, sql: string): T[] {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' }).trim();
  return out ? (JSON.parse(out) as T[]) : [];
}

function readScript(dbPath: string, path: string): void {
  execFileSync('sqlite3', [dbPath], {
    input: `PRAGMA foreign_keys=ON;\n.read ${path}\n`,
    stdio: 'pipe',
  });
}

function resetRawStaging(dbPath: string): void {
  const rows = sqliteJson<{ name: string }>(
    dbPath,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'raw_%' ORDER BY name DESC",
  );
  for (const row of rows) sqlite(dbPath, `DROP TABLE IF EXISTS "${row.name}";`);
  readScript(dbPath, workStagingSchemaPath);
}

function seedEopBaseDay(dbPath: string): void {
  sqlite(
    dbPath,
    `PRAGMA foreign_keys=ON;
INSERT INTO raw_egov_tenders
  (source, dataset_year, fetched_at, unp, tender_id, procedure_type, procurement_subject,
   cpv_code, cpv_description, contract_kind, estimated_value, currency, legal_basis,
   award_criteria, authority_name, authority_eik, authority_type, main_activity, deadline,
   notice_type, lot_id, lot_name, num_lots, eu_funded, published_at)
VALUES
  ('eop:tenders:2026-06-01', 2026, '2026-06-07T00:00:00Z', 'UNP-CE-1', 'TENDER-CE-1',
   'open', 'Base tender', '45000000', 'Construction', 'works', 2000, 'BGN', 'basis',
   'lowest', 'Authority CE', '123456789', 'public', 'activity', '2026-06-10', 'notice',
   NULL, NULL, 1, 0, '2026-06-01'),
  ('eop:tenders:2026-06-01', 2026, '2026-06-07T00:00:00Z', 'UNP-CE-1', 'TENDER-CE-1',
   'open', 'Base tender', '45000000', 'Construction', 'works', 2000, 'BGN', 'basis',
   'lowest', 'Authority CE', '123456789', 'public', 'activity', '2026-06-10', 'notice',
   '1', 'Lot 1', 1, 0, '2026-06-01');

INSERT INTO raw_egov_contracts
  (source, dataset_year, dataset_variant, fetched_at, needs_enrichment, document_number,
   published_at, unp, tender_ext_id, procedure_type, procurement_subject, cpv_code,
   cpv_description, contract_kind, estimated_value, procurement_currency, legal_basis,
   award_criteria, authority_name, authority_eik, authority_type, main_activity, notice_type,
   lot_id, contract_number, contract_date, signing_value, currency, contract_subject,
   awarded_to_group, contractor_eik, contractor_name, contractor_country, winner_size,
   eu_funded, bids_received, bids_sme, bids_rejected, bids_non_eea, duration_days)
VALUES
  ('eop:contracts:2026-06-01', 2026, 'eop', '2026-06-07T00:00:00Z', 0, 'DOC-CE-1',
   '2026-06-01', 'UNP-CE-1', 'TENDER-CE-1', 'open', 'Base tender', '45000000',
   'Construction', 'works', 2000, 'BGN', 'basis', 'lowest', 'Authority CE', '123456789',
   'public', 'activity', 'notice', '1', 'CONTRACT-CE-1', '2026-06-02', 1000, 'BGN',
   'Base contract', 0, '987654321', 'Bidder CE', 'BG', 'small', 0, 3, 1, 0, 0, 30),
  ('ocds:2026-06-01', 2026, 'ocds', '2026-06-07T00:00:00Z', 0, 'DOC-CO-1',
   '2026-06-01', 'OCDS-CO-1', 'TENDER-CO-1', 'open', 'OCDS tender', '45000000',
   'Construction', 'works', 5000, 'BGN', 'basis', 'lowest', 'Authority CE', '123456789',
   'public', 'activity', 'notice', NULL, 'CONTRACT-CO-1', '2026-06-02', 1000, 'BGN',
   'OCDS contract', 0, '987654322', 'Bidder CO', 'BG', 'small', 0, 3, 1, 0, 0, 30);

INSERT INTO raw_egov_amendments
  (source, dataset_year, dataset_variant, fetched_at, seq_no, document_number,
   contract_number, contract_date, published_at, unp, authority_eik, authority_name,
   procurement_subject, contract_kind, value_before, value_after, value_delta,
   currency, description)
VALUES
  ('eop:annexes:2026-06-01', 2026, 'eop', '2026-06-07T00:00:00Z', '1', 'AMD-CE-1',
   'CONTRACT-CE-1', '2026-06-02', '2026-06-03', 'UNP-CE-1', '123456789', 'Authority CE',
   'Base tender', 'works', 1000, 1200, 200, 'BGN', 'Increase'),
  ('ocds:2026-06-01', 2026, 'ocds', '2026-06-07T00:00:00Z', '1', 'AMD-CO-1',
   'CONTRACT-CO-1', '2026-06-02', '2026-06-03', 'OCDS-CO-1', '123456789', 'Authority CE',
   'OCDS tender', 'works', 1000, 1300, 300, 'BGN', 'OCDS increase');
`,
  );
}

function seedRepeatedAnnexOnly(dbPath: string): void {
  sqlite(
    dbPath,
    `INSERT INTO raw_egov_amendments
      (source, dataset_year, dataset_variant, fetched_at, seq_no, document_number,
       contract_number, contract_date, published_at, unp, authority_eik, authority_name,
       procurement_subject, contract_kind, value_before, value_after, value_delta,
       currency, description)
    VALUES
      ('eop:annexes:2026-06-02', 2026, 'eop', '2026-06-08T00:00:00Z', '1', 'AMD-CE-1',
       'CONTRACT-CE-1', '2026-06-02', '2026-06-03', 'UNP-CE-1', '123456789', 'Authority CE',
       'Base tender', 'works', 1000, 1200, 200, 'BGN', 'Increase');`,
  );
}

function seedEopOnlySharedNumber(dbPath: string): void {
  sqlite(
    dbPath,
    `INSERT INTO raw_egov_tenders
      (source, dataset_year, fetched_at, unp, tender_id, procedure_type, procurement_subject,
       cpv_code, cpv_description, contract_kind, estimated_value, currency, legal_basis,
       award_criteria, authority_name, authority_eik, authority_type, main_activity, deadline,
       notice_type, lot_id, lot_name, num_lots, eu_funded, published_at)
    VALUES
      ('eop:tenders:2026-06-01', 2026, '2026-06-07T00:00:00Z', 'UNP-SHARED', 'TENDER-SHARED',
       'open', 'Shared tender', '45000000', 'Construction', 'works', 5000, 'BGN', 'basis',
       'lowest', 'Authority Shared', '223456789', 'public', 'activity', '2026-06-10', 'notice',
       NULL, NULL, 1, 0, '2026-06-01');

    INSERT INTO raw_egov_contracts
      (source, dataset_year, dataset_variant, fetched_at, needs_enrichment, document_number,
       published_at, unp, tender_ext_id, procedure_type, procurement_subject, cpv_code,
       cpv_description, contract_kind, estimated_value, procurement_currency, legal_basis,
       award_criteria, authority_name, authority_eik, authority_type, main_activity, notice_type,
       lot_id, contract_number, contract_date, signing_value, currency, contract_subject,
       awarded_to_group, contractor_eik, contractor_name, contractor_country, winner_size,
       eu_funded, bids_received, bids_sme, bids_rejected, bids_non_eea, duration_days)
    VALUES
      ('eop:contracts:2026-06-01', 2026, 'eop', '2026-06-07T00:00:00Z', 0, 'DOC-SHARED',
       '2026-06-01', 'UNP-SHARED', 'TENDER-SHARED', 'open', 'Shared tender', '45000000',
       'Construction', 'works', 5000, 'BGN', 'basis', 'lowest', 'Authority Shared', '223456789',
       'public', 'activity', 'notice', NULL, 'CONTRACT-SHARED', '2026-06-02', 1000, 'BGN',
       'Shared contract', 0, '887654321', 'Bidder Shared', 'BG', 'small', 0, 3, 1, 0, 0, 30);`,
  );
}

function seedOcdsOnlySharedNumber(dbPath: string): void {
  sqlite(
    dbPath,
    `INSERT INTO raw_egov_contracts
      (source, dataset_year, dataset_variant, fetched_at, needs_enrichment, document_number,
       published_at, unp, tender_ext_id, procedure_type, procurement_subject, cpv_code,
       cpv_description, contract_kind, estimated_value, procurement_currency, legal_basis,
       award_criteria, authority_name, authority_eik, authority_type, main_activity, notice_type,
       lot_id, contract_number, contract_date, signing_value, currency, contract_subject,
       awarded_to_group, contractor_eik, contractor_name, contractor_country, winner_size,
       eu_funded, bids_received, bids_sme, bids_rejected, bids_non_eea, duration_days)
    VALUES
      ('ocds:2026-06-02', 2026, 'ocds', '2026-06-08T00:00:00Z', 0, 'DOC-SHARED-O',
       '2026-06-02', 'OCDS-SHARED', 'TENDER-SHARED-O', 'open', 'Shared tender ocds', '45000000',
       'Construction', 'works', 5000, 'BGN', 'basis', 'lowest', 'Authority Shared', '223456789',
       'public', 'activity', 'notice', NULL, 'CONTRACT-SHARED', '2026-06-02', 1000, 'BGN',
       'Shared contract ocds', 0, '887654321', 'Bidder Shared', 'BG', 'small', 0, 3, 1, 0, 0, 30);`,
  );
}

describe('refresh-slice EOP base derivation', () => {
  it('derives new eop base rows as c:e contracts and is idempotent', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'sigma-refresh-slice-'));
    const dbPath = resolve(dir, 'test.sqlite');
    try {
      readScript(dbPath, schemaPath);
      readScript(dbPath, amendmentsMigrationPath);
      readScript(dbPath, workStagingSchemaPath);
      seedEopBaseDay(dbPath);

      readScript(dbPath, refreshSlicePath);

      const firstContracts = sqliteJson<{ id: string; amount_eur: number }>(
        dbPath,
        "SELECT id, amount_eur FROM contracts WHERE id GLOB 'c:e:*' ORDER BY id",
      );
      expect(firstContracts.length).toBeGreaterThan(0);
      expect(firstContracts[0]?.amount_eur).toBeCloseTo(1200 / 1.95583, 6);
      expect(
        sqliteJson<{ n: number }>(dbPath, 'SELECT COUNT(*) AS n FROM amendments')[0]?.n,
      ).toBe(2);
      expect(
        sqliteJson<{ annex_count: number; current_value: number }>(
          dbPath,
          "SELECT annex_count, current_value FROM contracts WHERE id GLOB 'c:e:*'",
        )[0],
      ).toEqual({ annex_count: 1, current_value: 1200 });
      const ocdsContract = sqliteJson<{
        annex_count: number;
        current_value: number;
        amount_eur: number;
      }>(
        dbPath,
        "SELECT annex_count, current_value, amount_eur FROM contracts WHERE id GLOB 'c:o:*'",
      )[0];
      expect(ocdsContract?.annex_count).toBe(1);
      expect(ocdsContract?.current_value).toBe(1300);
      expect(ocdsContract?.amount_eur).toBeCloseTo(1300 / 1.95583, 6);

      expect(
        sqliteJson<{ n: number }>(dbPath, 'SELECT COUNT(*) AS n FROM company_totals')[0]?.n,
      ).toBe(2);
      expect(
        sqliteJson<{ n: number }>(dbPath, 'SELECT COUNT(*) AS n FROM authority_totals')[0]?.n,
      ).toBe(1);
      expect(
        sqliteJson<{ n: number }>(
          dbPath,
          "SELECT COUNT(*) AS n FROM search_index WHERE kind = 'contract' AND ref GLOB 'c:[eo]:*'",
        )[0]?.n,
      ).toBe(firstContracts.length + 1);
      expect(sqlite(dbPath, 'PRAGMA foreign_key_check;').trim()).toBe('');

      readScript(dbPath, refreshSlicePath);

      const secondContracts = sqliteJson<{ id: string; amount_eur: number }>(
        dbPath,
        "SELECT id, amount_eur FROM contracts WHERE id GLOB 'c:e:*' ORDER BY id",
      );
      expect(secondContracts).toEqual(firstContracts);
      resetRawStaging(dbPath);
      seedRepeatedAnnexOnly(dbPath);
      readScript(dbPath, refreshSlicePath);
      expect(
        sqliteJson<{ n: number }>(
          dbPath,
          "SELECT COUNT(*) AS n FROM amendments WHERE contract_number = 'CONTRACT-CE-1'",
        )[0]?.n,
      ).toBe(1);
      expect(
        sqliteJson<{ annex_count: number; current_value: number }>(
          dbPath,
          "SELECT annex_count, current_value FROM contracts WHERE contract_number = 'CONTRACT-CE-1'",
        )[0],
      ).toEqual({ annex_count: 1, current_value: 1200 });
      expect(sqlite(dbPath, 'PRAGMA foreign_key_check;').trim()).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not insert an OCDS duplicate after an existing EOP contract', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'sigma-refresh-slice-'));
    const dbPath = resolve(dir, 'test.sqlite');
    try {
      readScript(dbPath, schemaPath);
      readScript(dbPath, amendmentsMigrationPath);
      readScript(dbPath, workStagingSchemaPath);
      seedEopOnlySharedNumber(dbPath);
      readScript(dbPath, refreshSlicePath);

      resetRawStaging(dbPath);
      seedOcdsOnlySharedNumber(dbPath);
      readScript(dbPath, refreshSlicePath);

      expect(
        sqliteJson<{ n: number }>(
          dbPath,
          "SELECT COUNT(*) AS n FROM contracts WHERE contract_number = 'CONTRACT-SHARED'",
        )[0]?.n,
      ).toBe(1);
      expect(
        sqliteJson<{ n: number }>(
          dbPath,
          "SELECT COUNT(*) AS n FROM contracts WHERE contract_number = 'CONTRACT-SHARED' AND id GLOB 'c:o:*'",
        )[0]?.n,
      ).toBe(0);
      expect(
        sqliteJson<{ n: number }>(
          dbPath,
          `SELECT COUNT(*) AS n
           FROM (
             SELECT contract_number
             FROM contracts
             GROUP BY contract_number
             HAVING SUM(id GLOB 'c:e:*') > 0 AND SUM(id GLOB 'c:o:*') > 0
           )`,
        )[0]?.n,
      ).toBe(0);
      expect(
        sqliteJson<{ total: number }>(
          dbPath,
          "SELECT ROUND(SUM(amount_eur), 2) AS total FROM contracts WHERE contract_number = 'CONTRACT-SHARED'",
        )[0]?.total,
      ).toBeCloseTo(1000 / 1.95583, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recomputes value_flag from amendment rollup instead of keeping stale flags', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'sigma-refresh-slice-'));
    const dbPath = resolve(dir, 'test.sqlite');
    try {
      readScript(dbPath, schemaPath);
      readScript(dbPath, amendmentsMigrationPath);
      readScript(dbPath, workStagingSchemaPath);
      sqlite(
        dbPath,
        `INSERT INTO authorities (id, name, bulstat, type) VALUES ('auth:323456789', 'Authority Flag', '323456789', 'public');
         INSERT INTO bidders (id, name, bulstat, eik_normalized, eik_valid, kind) VALUES ('eik:777777777', 'Bidder Flag', '777777777', '777777777', 1, 'company');
         INSERT INTO tenders (id, source_id, title, authority_id, estimated_value, currency, procedure_type, status)
           VALUES ('t:UNP-FLAG', 'UNP-FLAG', 'Flag tender', 'auth:323456789', 1000, 'BGN', 'open', 'awarded');
         INSERT INTO contracts
           (id, tender_id, bidder_id, amount, currency, signed_at, contract_number, signing_value,
            current_value, annex_count, value_flag, amount_eur, signing_value_eur)
           VALUES
           ('c:e:flag', 't:UNP-FLAG', 'eik:777777777', 100, 'BGN', '2026-06-02',
            'CONTRACT-FLAG', 100, 10000, 1, 'annex_suspect', NULL, 100 / 1.95583);
         INSERT INTO raw_egov_amendments
           (source, dataset_year, dataset_variant, fetched_at, seq_no, document_number,
            contract_number, contract_date, published_at, unp, authority_eik, authority_name,
            procurement_subject, contract_kind, value_before, value_after, value_delta,
            currency, description)
         VALUES
           ('eop:annexes:2026-06-02', 2026, 'eop', '2026-06-08T00:00:00Z', '2', 'AMD-FLAG-2',
            'CONTRACT-FLAG', '2026-06-02', '2026-06-03', 'UNP-FLAG', '323456789', 'Authority Flag',
            'Flag tender', 'works', 10000, 120, -9880, 'BGN', 'Normalize');`,
      );

      readScript(dbPath, refreshSlicePath);
      const row = sqliteJson<{
        value_flag: string;
        amount: number;
        amount_eur: number;
        signing_value_eur: number;
      }>(
        dbPath,
        "SELECT value_flag, amount, amount_eur, signing_value_eur FROM contracts WHERE id = 'c:e:flag'",
      )[0];
      expect(row?.value_flag).toBe('ok');
      expect(row?.amount).toBe(120);
      expect(row?.amount_eur).toBeCloseTo(120 / 1.95583, 6);
      expect(row?.signing_value_eur).toBeCloseTo(100 / 1.95583, 6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('classifies amendment rollups from the contract-row estimated value', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'sigma-refresh-slice-'));
    const dbPath = resolve(dir, 'test.sqlite');
    try {
      readScript(dbPath, schemaPath);
      readScript(dbPath, amendmentsMigrationPath);
      readScript(dbPath, workStagingSchemaPath);
      sqlite(
        dbPath,
        `INSERT INTO raw_egov_tenders
          (source, dataset_year, fetched_at, unp, tender_id, procedure_type, procurement_subject,
           cpv_code, cpv_description, contract_kind, estimated_value, currency, legal_basis,
           award_criteria, authority_name, authority_eik, authority_type, main_activity, deadline,
           notice_type, lot_id, lot_name, num_lots, eu_funded, published_at)
        VALUES
          ('eop:tenders:2026-06-01', 2026, '2026-06-07T00:00:00Z', 'UNP-MISMATCH', 'TENDER-MISMATCH',
           'open', 'Mismatch tender', '45000000', 'Construction', 'works', 500000, 'BGN', 'basis',
           'lowest', 'Authority Mismatch', '423456789', 'public', 'activity', '2026-06-10', 'notice',
           NULL, NULL, 1, 0, '2026-06-01');

        INSERT INTO raw_egov_contracts
          (source, dataset_year, dataset_variant, fetched_at, needs_enrichment, document_number,
           published_at, unp, tender_ext_id, procedure_type, procurement_subject, cpv_code,
           cpv_description, contract_kind, estimated_value, procurement_currency, legal_basis,
           award_criteria, authority_name, authority_eik, authority_type, main_activity, notice_type,
           lot_id, contract_number, contract_date, signing_value, currency, contract_subject,
           awarded_to_group, contractor_eik, contractor_name, contractor_country, winner_size,
           eu_funded, bids_received, bids_sme, bids_rejected, bids_non_eea, duration_days)
        VALUES
          ('eop:contracts:2026-06-01', 2026, 'eop', '2026-06-07T00:00:00Z', 0, 'DOC-MISMATCH',
           '2026-06-01', 'UNP-MISMATCH', 'TENDER-MISMATCH', 'open', 'Mismatch tender', '45000000',
           'Construction', 'works', 1000, 'BGN', 'basis', 'lowest', 'Authority Mismatch', '423456789',
           'public', 'activity', 'notice', NULL, 'CONTRACT-MISMATCH', '2026-06-02', 1000, 'BGN',
           'Mismatch contract', 0, '677777777', 'Bidder Mismatch', 'BG', 'small', 0, 3, 1, 0, 0, 30);

        INSERT INTO raw_egov_amendments
          (source, dataset_year, dataset_variant, fetched_at, seq_no, document_number,
           contract_number, contract_date, published_at, unp, authority_eik, authority_name,
           procurement_subject, contract_kind, value_before, value_after, value_delta,
           currency, description)
        VALUES
          ('eop:annexes:2026-06-01', 2026, 'eop', '2026-06-07T00:00:00Z', '1', 'AMD-MISMATCH',
           'CONTRACT-MISMATCH', '2026-06-02', '2026-06-03', 'UNP-MISMATCH', '423456789', 'Authority Mismatch',
           'Mismatch tender', 'works', 1000, 500000, 499000, 'BGN', 'Huge increase');`,
      );

      readScript(dbPath, refreshSlicePath);
      const row = sqliteJson<{
        value_flag: string;
        amount: number;
        amount_eur: number | null;
        signing_value_eur: number | null;
      }>(
        dbPath,
        "SELECT value_flag, amount, amount_eur, signing_value_eur FROM contracts WHERE contract_number = 'CONTRACT-MISMATCH'",
      )[0];
      expect(row?.value_flag).toBe('annex_suspect');
      expect(row?.amount).toBe(1000);
      expect(row?.amount_eur).toBeCloseTo(1000 / 1.95583, 6);
      expect(row?.signing_value_eur).toBeCloseTo(1000 / 1.95583, 6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
