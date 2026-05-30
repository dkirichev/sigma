#!/usr/bin/env node
// Create the Cloudflare resources Sigma needs (one-time per CF account).
// Dry-run by default; pass --apply to actually create them.
import { execFileSync } from 'node:child_process';

const apply = process.argv.includes('--apply');

const resources = [
  { kind: 'D1', cmd: ['d1', 'create', 'sigma'] },
  { kind: 'KV', cmd: ['kv', 'namespace', 'create', 'CACHE'] },
  { kind: 'R2', cmd: ['r2', 'bucket', 'create', 'sigma-raw'] },
];

console.log(apply ? '==> Creating Cloudflare resources' : '==> Dry run (pass --apply to create)');

for (const r of resources) {
  const line = `wrangler ${r.cmd.join(' ')}`;
  if (apply) {
    console.log(`==> ${line}`);
    try {
      execFileSync('wrangler', r.cmd, { stdio: 'inherit' });
    } catch {
      console.error(`!! ${r.kind} creation failed (it may already exist) — continuing`);
    }
  } else {
    console.log(`  ${line}`);
  }
}

if (!apply) {
  console.log(
    '\nAfter creating, capture the printed IDs and set them as env vars (NOT in the committed' +
      '\nwrangler files, which keep zero-UUID dummies for local dev):' +
      '\n  SIGMA_D1_ID=<d1 database_id>' +
      '\n  SIGMA_KV_CACHE_ID=<kv namespace id>' +
      '\nFor local deploy, put them in .env.local; for CI, set them as repo secrets. See docs/deploy.md.',
  );
}
