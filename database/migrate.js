#!/usr/bin/env node

/**
 * Database Migration Script for Agent Management System
 * Usage: node migrate.js [up|down|status]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

// Migration tracking table
const MIGRATION_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version VARCHAR(50) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version (version)
);
`;

class MigrationRunner {
    constructor() {
        this.connection = null;
        this.migrationsDir = path.join(__dirname, 'migrations');
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(dbConfig);
            console.log('✅ Connected to MySQL database');
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('✅ Disconnected from database');
        }
    }

    async initMigrationTable() {
        try {
            await this.connection.execute(MIGRATION_TABLE);
            console.log('✅ Migration tracking table initialized');
        } catch (error) {
            console.error('❌ Failed to initialize migration table:', error.message);
            throw error;
        }
    }

    async getExecutedMigrations() {
        try {
            const [rows] = await this.connection.execute(
                'SELECT version FROM schema_migrations ORDER BY version'
            );
            return rows.map(row => row.version);
        } catch (error) {
            console.error('❌ Failed to get executed migrations:', error.message);
            return [];
        }
    }

    async getMigrationFiles() {
        try {
            const files = fs.readdirSync(this.migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort();
            
            return files.map(file => ({
                version: file.replace('.sql', ''),
                filename: file,
                path: path.join(this.migrationsDir, file)
            }));
        } catch (error) {
            console.error('❌ Failed to read migration files:', error.message);
            return [];
        }
    }

    async executeMigration(migration) {
        try {
            console.log(`🔄 Executing migration: ${migration.filename}`);
            
            const sql = fs.readFileSync(migration.path, 'utf8');
            await this.connection.execute(sql);
            
            // Record migration as executed
            await this.connection.execute(
                'INSERT INTO schema_migrations (version, filename) VALUES (?, ?)',
                [migration.version, migration.filename]
            );
            
            console.log(`✅ Migration completed: ${migration.filename}`);
        } catch (error) {
            console.error(`❌ Migration failed: ${migration.filename}`, error.message);
            throw error;
        }
    }

    async rollbackMigration(migration) {
        try {
            console.log(`🔄 Rolling back migration: ${migration.filename}`);
            
            // Remove migration record
            await this.connection.execute(
                'DELETE FROM schema_migrations WHERE version = ?',
                [migration.version]
            );
            
            console.log(`✅ Migration rolled back: ${migration.filename}`);
            console.log('⚠️  Note: Automatic rollback SQL not implemented. Manual cleanup may be required.');
        } catch (error) {
            console.error(`❌ Rollback failed: ${migration.filename}`, error.message);
            throw error;
        }
    }

    async migrateUp() {
        console.log('🚀 Starting database migration...');
        
        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();
        
        const pendingMigrations = migrationFiles.filter(
            migration => !executedMigrations.includes(migration.version)
        );
        
        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations found. Database is up to date.');
            return;
        }
        
        console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
        pendingMigrations.forEach(migration => {
            console.log(`   - ${migration.filename}`);
        });
        
        for (const migration of pendingMigrations) {
            await this.executeMigration(migration);
        }
        
        console.log('🎉 All migrations completed successfully!');
    }

    async migrateDown() {
        console.log('🔄 Starting database rollback...');
        
        const executedMigrations = await this.getExecutedMigrations();
        
        if (executedMigrations.length === 0) {
            console.log('✅ No migrations to rollback.');
            return;
        }
        
        // Get the last executed migration
        const lastMigration = executedMigrations[executedMigrations.length - 1];
        const migrationFiles = await this.getMigrationFiles();
        const migration = migrationFiles.find(m => m.version === lastMigration);
        
        if (!migration) {
            console.error(`❌ Migration file not found for version: ${lastMigration}`);
            return;
        }
        
        await this.rollbackMigration(migration);
        console.log('✅ Rollback completed!');
    }

    async showStatus() {
        console.log('📊 Migration Status:');
        console.log('==================');
        
        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();
        
        if (migrationFiles.length === 0) {
            console.log('No migration files found.');
            return;
        }
        
        migrationFiles.forEach(migration => {
            const status = executedMigrations.includes(migration.version) ? '✅ Executed' : '⏳ Pending';
            console.log(`${status} - ${migration.filename}`);
        });
        
        console.log('==================');
        console.log(`Total migrations: ${migrationFiles.length}`);
        console.log(`Executed: ${executedMigrations.length}`);
        console.log(`Pending: ${migrationFiles.length - executedMigrations.length}`);
    }
}

async function main() {
    const command = process.argv[2] || 'up';
    const runner = new MigrationRunner();
    
    try {
        await runner.connect();
        await runner.initMigrationTable();
        
        switch (command) {
            case 'up':
                await runner.migrateUp();
                break;
            case 'down':
                await runner.migrateDown();
                break;
            case 'status':
                await runner.showStatus();
                break;
            default:
                console.log('Usage: node migrate.js [up|down|status]');
                console.log('  up     - Run pending migrations');
                console.log('  down   - Rollback last migration');
                console.log('  status - Show migration status');
        }
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await runner.disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = MigrationRunner;