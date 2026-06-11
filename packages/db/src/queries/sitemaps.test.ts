import { describe, expect, it } from 'vitest';
import { streamAuthoritySitemap } from './sitemaps';

function fakeDb(): D1Database {
  return {
    prepare(sql: string) {
      if (sql.includes('home_totals')) {
        return {
          async first() {
            return { as_of: '2026-06-01' };
          },
        };
      }
      return {
        bind() {
          return {
            async all() {
              return {
                results: [{ authority_id: 'auth:12\u000134<&>', last_date: '2026-05-31' }],
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('sitemap XML escaping', () => {
  it('strips XML-invalid C0 controls and keeps URLs escaped', async () => {
    const xml = await streamAuthoritySitemap(fakeDb(), 'https://example.test').text();

    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(xml).toContain('https://example.test/authorities/1234&lt;&amp;&gt;');
    expect(xml).toContain('<lastmod>2026-05-31</lastmod>');
    expect(xml.endsWith('</urlset>\n')).toBe(true);
  });
});
