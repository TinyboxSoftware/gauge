/**
 * Comprehensive test suite for GaugeDatabase
 * Tests schema creation, data insertion, and derived metrics calculation
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { GaugeDatabase } from './client';
import { DatabaseError, SchemaError, InsertError } from './errors';
import {
  sampleEarnings,
  sampleEarningsZero,
  sampleEarningsLarge,
} from './test-fixtures/sample-earnings';
import {
  sampleTemplates,
  minimalTemplates,
  highRetentionTemplate,
  lowRetentionTemplate,
  zeroActiveTemplate,
  zeroProjectsTemplate,
  perfectTemplate,
} from './test-fixtures/sample-templates';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/gauge_test';

describe('GaugeDatabase', () => {
  let db: GaugeDatabase;

  beforeAll(async () => {
    // Initialize database connection
    db = new GaugeDatabase({
      connectionString: TEST_DATABASE_URL,
    });

    // Ensure schema exists for all tests
    await db.ensureSchema();
  });

  afterAll(async () => {
    // Clean up
    await db.close();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    const sql = (db as any).sql;
    await sql`TRUNCATE TABLE template_metrics_derived CASCADE`;
    await sql`TRUNCATE TABLE template_snapshots CASCADE`;
    await sql`TRUNCATE TABLE earnings_snapshots CASCADE`;
  });

  describe('Schema Management', () => {
    test('creates schema if missing', async () => {
      // This test assumes schema is already created by beforeAll
      // We're just verifying it doesn't error on re-run
      await db.ensureSchema();

      // Verify tables exist
      const sql = (db as any).sql;
      const result = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('earnings_snapshots', 'template_snapshots', 'template_metrics_derived')
        ORDER BY table_name
      `;

      expect(result.length).toBe(3);
      expect(result.map((r: any) => r.table_name)).toEqual([
        'earnings_snapshots',
        'template_metrics_derived',
        'template_snapshots',
      ]);
    });

    test('skips creation when schema exists', async () => {
      // Run ensureSchema multiple times - should not error
      await db.ensureSchema();
      await db.ensureSchema();
      await db.ensureSchema();

      // Should still have exactly 3 tables
      const sql = (db as any).sql;
      const result = await sql`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('earnings_snapshots', 'template_snapshots', 'template_metrics_derived')
      `;

      expect(result[0].count).toBe("3");
    });
  });

  describe('Earnings Snapshot Insertion', () => {
    test('inserts earnings snapshot correctly', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertEarningsSnapshot(sampleEarnings, collectedAt);

      // Verify insertion
      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM earnings_snapshots
        WHERE collected_at = ${collectedAt}
      `;

      expect(result.length).toBe(1);
      expect(BigInt(result[0].lifetime_earnings)).toBe(BigInt(sampleEarnings.lifetimeEarnings));
      expect(BigInt(result[0].template_earnings_lifetime)).toBe(BigInt(sampleEarnings.templateEarningsLifetime));
      expect(BigInt(result[0].available_balance)).toBe(BigInt(sampleEarnings.availableBalance));
    });

    test('inserts earnings with zero values', async () => {
      const collectedAt = new Date('2024-01-02T00:00:00Z');

      await db.insertEarningsSnapshot(sampleEarningsZero, collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM earnings_snapshots
        WHERE collected_at = ${collectedAt}
      `;

      expect(result.length).toBe(1);
      expect(BigInt(result[0].lifetime_earnings)).toBe(0n);
      expect(BigInt(result[0].template_earnings_lifetime)).toBe(0n);
    });

    test('inserts earnings with large values', async () => {
      const collectedAt = new Date('2024-01-03T00:00:00Z');

      await db.insertEarningsSnapshot(sampleEarningsLarge, collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM earnings_snapshots
        WHERE collected_at = ${collectedAt}
      `;

      expect(result.length).toBe(1);
      expect(BigInt(result[0].lifetime_earnings)).toBe(BigInt(sampleEarningsLarge.lifetimeEarnings));
    });
  });

  describe('Template Snapshots Insertion', () => {
    test('inserts template snapshots with calculated metrics', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      const count = await db.insertTemplateSnapshots(minimalTemplates, collectedAt);

      expect(count).toBe(2);

      // Verify insertion
      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM template_snapshots
        WHERE collected_at = ${collectedAt}
        ORDER BY template_id
      `;

      expect(result.length).toBe(2);
    });

    test('calculates retention_rate correctly for high retention template', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([highRetentionTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT retention_rate, revenue_per_active, growth_momentum
        FROM template_snapshots
        WHERE template_id = ${highRetentionTemplate.id}
      `;

      // High retention: 80/100 * 100 = 80%
      expect(parseFloat(result[0].retention_rate)).toBe(80.00);

      // Revenue per active: 500000 / 80 = 6250
      expect(Number(result[0].revenue_per_active)).toBe(6250);

      // Growth momentum: 20/80 * 100 = 25%
      expect(parseFloat(result[0].growth_momentum)).toBe(25.00);
    });

    test('calculates retention_rate correctly for low retention template', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([lowRetentionTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT retention_rate, revenue_per_active, growth_momentum
        FROM template_snapshots
        WHERE template_id = ${lowRetentionTemplate.id}
      `;

      // Low retention: 60/200 * 100 = 30%
      expect(parseFloat(result[0].retention_rate)).toBe(30.00);

      // Revenue per active: 150000 / 60 = 2500
      expect(Number(result[0].revenue_per_active)).toBe(2500);

      // Growth momentum: 5/60 * 100 = 8.33%
      expect(parseFloat(result[0].growth_momentum)).toBe(8.33);
    });

    test('handles zero active projects (division by zero)', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([zeroActiveTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT retention_rate, revenue_per_active, growth_momentum
        FROM template_snapshots
        WHERE template_id = ${zeroActiveTemplate.id}
      `;

      // Retention: 0/50 * 100 = 0%
      expect(parseFloat(result[0].retention_rate)).toBe(0.00);

      // Revenue per active: 0 (can't divide by zero)
      expect(Number(result[0].revenue_per_active)).toBe(0);

      // Growth momentum: 0 (can't divide by zero)
      expect(parseFloat(result[0].growth_momentum)).toBe(0.00);
    });

    test('handles zero total projects', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([zeroProjectsTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT retention_rate, revenue_per_active, growth_momentum
        FROM template_snapshots
        WHERE template_id = ${zeroProjectsTemplate.id}
      `;

      // All metrics should be 0
      expect(parseFloat(result[0].retention_rate)).toBe(0.00);
      expect(Number(result[0].revenue_per_active)).toBe(0);
      expect(parseFloat(result[0].growth_momentum)).toBe(0.00);
    });

    test('converts health from string to integer', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([highRetentionTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT health FROM template_snapshots
        WHERE template_id = ${highRetentionTemplate.id}
      `;

      // Health should be integer 95 (from string "95")
      expect(result[0].health).toBe(95);
      expect(typeof result[0].health).toBe('number');
    });

    test('handles duplicate insertions with ON CONFLICT', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      // Insert once
      const count1 = await db.insertTemplateSnapshots([highRetentionTemplate], collectedAt);
      expect(count1).toBe(1);

      // Insert again with same collected_at - should be ignored
      const count2 = await db.insertTemplateSnapshots([highRetentionTemplate], collectedAt);
      expect(count2).toBe(1); // Returns count of templates processed, not rows inserted

      // Verify only one row exists
      const sql = (db as any).sql;
      const result = await sql`
        SELECT COUNT(*) as count FROM template_snapshots
        WHERE template_id = ${highRetentionTemplate.id}
          AND collected_at = ${collectedAt}
      `;

      expect(result[0].count).toBe("1");
    });

    test('handles empty template array', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      const count = await db.insertTemplateSnapshots([], collectedAt);

      expect(count).toBe(0);
    });

    test('stores tags and languages as JSON', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      await db.insertTemplateSnapshots([perfectTemplate], collectedAt);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT tags, languages FROM template_snapshots
        WHERE template_id = ${perfectTemplate.id}
      `;

      // Parse JSON back
      const tags = JSON.parse(result[0].tags);
      const languages = JSON.parse(result[0].languages);

      expect(tags).toEqual(perfectTemplate.tags);
      expect(languages).toEqual(perfectTemplate.languages);
    });
  });

  describe('Derived Metrics Calculation', () => {
    test('calculates derived metrics with historical data', async () => {
      // Insert baseline snapshot (7 days ago)
      const baseline = new Date('2024-01-01T00:00:00Z');
      await db.insertTemplateSnapshots(
        [
          {
            ...highRetentionTemplate,
            totalPayout: 400000, // $4,000
            activeProjects: 75,
          },
        ],
        baseline
      );

      // Insert current snapshot
      const current = new Date('2024-01-08T00:00:00Z');
      await db.insertTemplateSnapshots(
        [
          {
            ...highRetentionTemplate,
            totalPayout: 500000, // $5,000
            activeProjects: 80,
          },
        ],
        current
      );

      // Calculate derived metrics
      await db.calculateDerivedMetrics(current);

      // Verify derived metrics
      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM template_metrics_derived
        WHERE template_id = ${highRetentionTemplate.id}
      `;

      expect(result.length).toBe(1);

      // Revenue growth: 500000 - 400000 = 100000
      expect(Number(result[0].revenue_growth_7d)).toBe(100000);

      // Active projects change: 80 - 75 = 5
      expect(result[0].active_projects_change_7d).toBe(5);

      // Average daily revenue: 100000 / 7 = 14285.71...
      expect(Number(result[0].avg_daily_revenue_7d)).toBe(14285);
    });

    test('handles first run with no historical data', async () => {
      // Insert only current snapshot (no previous data)
      const current = new Date('2024-01-01T00:00:00Z');
      await db.insertTemplateSnapshots([highRetentionTemplate], current);

      // Calculate derived metrics - should not throw
      await db.calculateDerivedMetrics(current);

      // Verify metrics exist with zero growth
      const sql = (db as any).sql;
      const result = await sql`
        SELECT * FROM template_metrics_derived
        WHERE template_id = ${highRetentionTemplate.id}
      `;

      expect(result.length).toBe(1);

      // All growth metrics should be 0 (no historical data)
      expect(Number(result[0].revenue_growth_24h)).toBe(0);
      expect(Number(result[0].revenue_growth_7d)).toBe(0);
      expect(Number(result[0].revenue_growth_30d)).toBe(0);
      expect(result[0].active_projects_change_24h).toBe(0);
    });

    test('calculates profitability score', async () => {
      const current = new Date('2024-01-01T00:00:00Z');
      await db.insertTemplateSnapshots([perfectTemplate], current);

      await db.calculateDerivedMetrics(current);

      const sql = (db as any).sql;
      const result = await sql`
        SELECT profitability_score FROM template_metrics_derived
        WHERE template_id = ${perfectTemplate.id}
      `;

      expect(result.length).toBe(1);
      // Profitability score should be calculated (non-null)
      expect(result[0].profitability_score).not.toBeNull();
    });
  });

  describe('Integration Tests', () => {
    test('full flow: schema → earnings → templates → derived metrics', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      // 1. Ensure schema
      await db.ensureSchema();

      // 2. Insert earnings
      await db.insertEarningsSnapshot(sampleEarnings, collectedAt);

      // 3. Insert templates
      const count = await db.insertTemplateSnapshots(sampleTemplates, collectedAt);
      expect(count).toBe(5);

      // 4. Calculate derived metrics
      await db.calculateDerivedMetrics(collectedAt);

      // Verify all data persisted
      const sql = (db as any).sql;

      const earningsCount = await sql`SELECT COUNT(*) as count FROM earnings_snapshots`;
      expect(earningsCount[0].count).toBe("1");

      const templatesCount = await sql`SELECT COUNT(*) as count FROM template_snapshots`;
      expect(templatesCount[0].count).toBe("5");

      const derivedCount = await sql`SELECT COUNT(*) as count FROM template_metrics_derived`;
      expect(derivedCount[0].count).toBe("5");
    });

    test('multiple collection intervals', async () => {
      // Simulate collecting metrics at different times
      const timestamps = [
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-01-02T00:00:00Z'),
        new Date('2024-01-03T00:00:00Z'),
      ];

      for (const ts of timestamps) {
        await db.insertEarningsSnapshot(sampleEarnings, ts);
        await db.insertTemplateSnapshots(minimalTemplates, ts);
        await db.calculateDerivedMetrics(ts);
      }

      // Verify we have 3 snapshots per template
      const sql = (db as any).sql;
      const result = await sql`
        SELECT template_id, COUNT(*) as count
        FROM template_snapshots
        GROUP BY template_id
        ORDER BY template_id
      `;

      expect(result.length).toBe(2);
      expect(result[0].count).toBe("3");
      expect(result[1].count).toBe("3");
    });
  });

  describe('Calculated Metrics Match Python Logic', () => {
    test('retention_rate calculation matches Python', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      // Test various scenarios
      const testCases = [
        { projects: 100, activeProjects: 80, expected: 80.0 },
        { projects: 200, activeProjects: 60, expected: 30.0 },
        { projects: 50, activeProjects: 0, expected: 0.0 },
        { projects: 0, activeProjects: 0, expected: 0.0 },
        { projects: 1000, activeProjects: 950, expected: 95.0 },
        { projects: 3, activeProjects: 1, expected: 33.33 },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const template = {
          ...highRetentionTemplate,
          id: `test-template-retention-${i}`,
          projects: tc.projects,
          activeProjects: tc.activeProjects,
        };

        await db.insertTemplateSnapshots([template], collectedAt);

        const sql = (db as any).sql;
        const result = await sql`
          SELECT retention_rate FROM template_snapshots
          WHERE template_id = ${template.id}
        `;

        expect(parseFloat(result[0].retention_rate)).toBe(tc.expected);
      }
    });

    test('revenue_per_active calculation matches Python', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      const testCases = [
        { totalPayout: 500000, activeProjects: 80, expected: 6250 },
        { totalPayout: 150000, activeProjects: 60, expected: 2500 },
        { totalPayout: 10000, activeProjects: 0, expected: 0 },
        { totalPayout: 0, activeProjects: 0, expected: 0 },
        { totalPayout: 10000000, activeProjects: 950, expected: 10526 },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const template = {
          ...highRetentionTemplate,
          id: `test-template-revenue-${i}`,
          totalPayout: tc.totalPayout,
          activeProjects: tc.activeProjects,
        };

        await db.insertTemplateSnapshots([template], collectedAt);

        const sql = (db as any).sql;
        const result = await sql`
          SELECT revenue_per_active FROM template_snapshots
          WHERE template_id = ${template.id}
        `;

        expect(Number(result[0].revenue_per_active)).toBe(tc.expected);
      }
    });

    test('growth_momentum calculation matches Python', async () => {
      const collectedAt = new Date('2024-01-01T00:00:00Z');

      const testCases = [
        { recentProjects: 20, activeProjects: 80, expected: 25.0 },
        { recentProjects: 5, activeProjects: 60, expected: 8.33 },
        { recentProjects: 0, activeProjects: 0, expected: 0.0 },
        { recentProjects: 100, activeProjects: 950, expected: 10.53 },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const template = {
          ...highRetentionTemplate,
          id: `test-template-growth-${i}`,
          recentProjects: tc.recentProjects,
          activeProjects: tc.activeProjects,
        };

        await db.insertTemplateSnapshots([template], collectedAt);

        const sql = (db as any).sql;
        const result = await sql`
          SELECT growth_momentum FROM template_snapshots
          WHERE template_id = ${template.id}
        `;

        expect(parseFloat(result[0].growth_momentum)).toBe(tc.expected);
      }
    });
  });
});
