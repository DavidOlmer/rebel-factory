#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * REBAA-28: Multi-Tenant Architecture
 * 
 * Usage:
 *   npx ts-node src/db/migrate.ts up        # Run all pending migrations
 *   npx ts-node src/db/migrate.ts down      # Rollback last migration
 *   npx ts-node src/db/migrate.ts status    # Show migration status
 */
import { pool } from './client';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  name: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query('SELECT name FROM _migrations ORDER BY name');
  return result.rows.map(row => row.name);
}

async function loadMigrations(): Promise<Migration[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();
  
  const migrations: Migration[] = [];
  
  for (const file of files) {
    const migrationPath = path.join(MIGRATIONS_DIR, file);
    const migration = await import(migrationPath);
    migrations.push({
      name: migration.name,
      description: migration.description,
      up: migration.up,
      down: migration.down,
    });
  }
  
  return migrations;
}

async function runUp(): Promise<void> {
  await ensureMigrationsTable();
  
  const executed = await getExecutedMigrations();
  const migrations = await loadMigrations();
  
  const pending = migrations.filter(m => !executed.includes(m.name));
  
  if (pending.length === 0) {
    console.log('✓ No pending migrations');
    return;
  }
  
  console.log(`Running ${pending.length} migration(s)...\n`);
  
  for (const migration of pending) {
    console.log(`→ ${migration.name}: ${migration.description}`);
    await migration.up();
    console.log(`✓ ${migration.name} completed\n`);
  }
  
  console.log('All migrations completed successfully');
}

async function runDown(): Promise<void> {
  await ensureMigrationsTable();
  
  const executed = await getExecutedMigrations();
  const migrations = await loadMigrations();
  
  if (executed.length === 0) {
    console.log('No migrations to rollback');
    return;
  }
  
  const lastExecuted = executed[executed.length - 1];
  const migration = migrations.find(m => m.name === lastExecuted);
  
  if (!migration) {
    console.error(`Migration ${lastExecuted} not found in migrations directory`);
    return;
  }
  
  console.log(`Rolling back: ${migration.name}`);
  await migration.down();
  console.log(`✓ ${migration.name} rolled back`);
}

async function showStatus(): Promise<void> {
  await ensureMigrationsTable();
  
  const executed = await getExecutedMigrations();
  const migrations = await loadMigrations();
  
  console.log('Migration Status\n================\n');
  
  for (const migration of migrations) {
    const status = executed.includes(migration.name) ? '✓' : '○';
    console.log(`${status} ${migration.name}: ${migration.description}`);
  }
  
  const pending = migrations.filter(m => !executed.includes(m.name));
  console.log(`\n${executed.length} executed, ${pending.length} pending`);
}

// Main
const action = process.argv[2];

async function main() {
  try {
    switch (action) {
      case 'up':
        await runUp();
        break;
      case 'down':
        await runDown();
        break;
      case 'status':
        await showStatus();
        break;
      default:
        console.log('Usage: migrate.ts [up|down|status]');
        process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
