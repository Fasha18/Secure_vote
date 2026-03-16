/**
 * Database Migration - Add Eligibility Fields
 * Adds specialized fields for National, University, and Corporate elections
 */
require('dotenv').config();
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

const migrationSQL = `
-- Add eligibility fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active_member BOOLEAN DEFAULT TRUE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_nationality ON users(nationality);
`;

async function runMigration() {
    const client = await pool.connect();
    try {
        logger.info('Starting eligibility fields migration...');
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        logger.info('Eligibility fields migration completed successfully');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration failed', { error: error.message });
        throw error;
    } finally {
        client.release();
    }
}

// Run if executed directly
if (require.main === module) {
    require('dotenv').config();
    runMigration()
        .then(() => {
            logger.info('Migration complete');
            process.exit(0);
        })
        .catch((err) => {
            logger.error('Migration failed', { error: err.message });
            process.exit(1);
        });
}

module.exports = { runMigration };
