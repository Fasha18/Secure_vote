/**
 * Database Migration - Initial Schema
 * Creates all tables for the voting system
 */
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

const migrationSQL = `
-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    national_id_hash VARCHAR(255),
    student_card_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'voter',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    
    CONSTRAINT check_role CHECK (role IN ('voter', 'organizer', 'moderator', 'admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_national_id_hash ON users(national_id_hash);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);


CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar_url VARCHAR(500),
    bio TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    city VARCHAR(100),
    country VARCHAR(100),
    language_preference VARCHAR(10) DEFAULT 'fr',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS two_factor_auth (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- ELECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    visibility VARCHAR(20) DEFAULT 'public',
    
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    results_release_date TIMESTAMP,
    
    requires_national_id BOOLEAN DEFAULT FALSE,
    requires_student_card BOOLEAN DEFAULT FALSE,
    requires_2fa BOOLEAN DEFAULT FALSE,
    allow_abstention BOOLEAN DEFAULT TRUE,
    max_votes_per_user INT DEFAULT 1,
    
    organizer_id UUID REFERENCES users(id),
    organization_name VARCHAR(255),
    
    eligibility_criteria JSONB DEFAULT '{}',
    
    show_results_realtime BOOLEAN DEFAULT TRUE,
    allow_vote_verification BOOLEAN DEFAULT TRUE,
    results_settings JSONB DEFAULT '{
        "showDuringVoting": true,
        "showOnlyAfterClosing": false,
        "showByRegion": true,
        "showNationalOnly": false,
        "showPercentages": true
    }',
    
    total_registered_voters INT DEFAULT 0,
    total_votes_cast INT DEFAULT 0,
    participation_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT check_dates CHECK (end_date > start_date),
    CONSTRAINT check_status CHECK (status IN ('draft', 'scheduled', 'active', 'closed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_elections_type ON elections(type);
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_dates ON elections(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_elections_organizer ON elections(organizer_id);


CREATE TABLE IF NOT EXISTS election_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- CANDIDATES
-- ============================================

CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    
    full_name VARCHAR(255) NOT NULL,
    political_party VARCHAR(255),
    slogan VARCHAR(500),
    biography TEXT,
    
    photo_url VARCHAR(500),
    video_url VARCHAR(500),
    
    website_url VARCHAR(500),
    social_media JSONB,
    
    program_summary TEXT,
    program_details TEXT,
    program_pdf_url VARCHAR(500),
    
    status VARCHAR(20) DEFAULT 'approved',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    
    display_order INT DEFAULT 0,
    
    vote_count INT DEFAULT 0,
    vote_percentage DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT check_candidate_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);


-- ============================================
-- VOTES (ANONYMIZED)
-- ============================================

CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    
    encrypted_vote TEXT NOT NULL,
    vote_proof VARCHAR(255) UNIQUE NOT NULL,
    vote_signature TEXT,
    
    timestamp TIMESTAMP DEFAULT NOW(),
    
    blockchain_hash VARCHAR(255),
    blockchain_block_number BIGINT,
    
    device_type VARCHAR(50),
    ip_region VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_timestamp ON votes(timestamp);
CREATE INDEX IF NOT EXISTS idx_votes_proof ON votes(vote_proof);
CREATE INDEX IF NOT EXISTS idx_votes_election_candidate ON votes(election_id, candidate_id);


CREATE TABLE IF NOT EXISTS vote_receipts (
    receipt_code VARCHAR(50) PRIMARY KEY,
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_vote ON vote_receipts(vote_id);
CREATE INDEX IF NOT EXISTS idx_receipts_election ON vote_receipts(election_id);


-- ============================================
-- PARTICIPATION TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS user_participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    
    has_voted BOOLEAN DEFAULT FALSE,
    voted_at TIMESTAMP,
    receipt_code VARCHAR(50),
    
    vote_token_generated_at TIMESTAMP,
    vote_token_used_at TIMESTAMP,
    
    CONSTRAINT unique_user_election UNIQUE (user_id, election_id)
);

CREATE INDEX IF NOT EXISTS idx_participation_user ON user_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_participation_election ON user_participation(election_id);
CREATE INDEX IF NOT EXISTS idx_participation_status ON user_participation(has_voted);
CREATE INDEX IF NOT EXISTS idx_participation_user_election ON user_participation(user_id, election_id);


-- ============================================
-- AUDIT & LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);


CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    message TEXT,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON system_events(timestamp);


-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) DEFAULT 'push',
    title VARCHAR(255),
    message TEXT,
    data JSONB,
    
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);


-- ============================================
-- ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS election_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
    
    snapshot_time TIMESTAMP DEFAULT NOW(),
    
    total_votes INT DEFAULT 0,
    total_registered INT DEFAULT 0,
    participation_rate DECIMAL(5,2),
    
    candidate_votes JSONB,
    
    votes_by_region JSONB,
    votes_by_device JSONB,
    
    CONSTRAINT unique_election_snapshot UNIQUE (election_id, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_stats_election ON election_stats(election_id);
CREATE INDEX IF NOT EXISTS idx_stats_time ON election_stats(snapshot_time);


-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_elections_updated_at') THEN
        CREATE TRIGGER update_elections_updated_at BEFORE UPDATE ON elections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_candidates_updated_at') THEN
        CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_updated_at') THEN
        CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;


-- ============================================
-- OTP CODES
-- ============================================

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(30) NOT NULL DEFAULT 'login',
    expires_at TIMESTAMP NOT NULL,
    attempts INT DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT check_otp_purpose CHECK (purpose IN ('login', 'register', 'password_reset'))
);

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_purpose ON otp_codes(purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);
`;

async function runMigration() {
    const client = await pool.connect();
    try {
        logger.info('Starting database migration...');
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        logger.info('Database migration completed successfully');
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
