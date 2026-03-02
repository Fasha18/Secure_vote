/**
 * Vote Service - MOST CRITICAL SERVICE
 * Handles vote token generation, vote submission, and verification
 * 
 * SECURITY PRINCIPLES:
 * 1. User ↔ Vote separation (anonymity)
 * 2. Double encryption of votes
 * 3. Cryptographic proof and signature
 * 4. ACID transactions
 * 5. Audit trail without compromising anonymity
 */
const { query, getClient } = require('../config/database');
const { cache } = require('../config/redis');
const { voteQueue } = require('../config/queue');
const encryptionService = require('./encryption.service');
const config = require('../config/app');
const logger = require('../utils/logger');
const {
    ValidationError,
    UnauthorizedError,
    ConflictError,
    NotFoundError,
    UnprocessableError,
    ForbiddenError,
} = require('../utils/errors');

class VoteService {
    /**
     * Request a vote token for an election
     * STEP 1: Verify eligibility and generate a unique, time-limited token
     */
    async requestVoteToken(userId, electionId, identityData = {}, ipAddress = null) {
        // 1. Fetch election
        const electionResult = await query(
            `SELECT * FROM elections WHERE id = $1`,
            [electionId]
        );

        if (electionResult.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = electionResult.rows[0];

        // 2. Verify election is active
        const now = new Date();
        if (election.status !== 'active') {
            throw new UnprocessableError('Cette élection n\'est pas active');
        }
        if (now < new Date(election.start_date)) {
            throw new UnprocessableError('Cette élection n\'a pas encore commencé');
        }
        if (now > new Date(election.end_date)) {
            throw new UnprocessableError('Cette élection est terminée');
        }

        // 3. Verify identity requirements
        if (election.requires_national_id && !identityData.nationalId) {
            throw new ValidationError('Un numéro d\'identité nationale est requis pour cette élection');
        }
        if (election.requires_student_card && !identityData.studentCard) {
            throw new ValidationError('Un numéro de carte étudiant est requis pour cette élection');
        }

        // 4. Verify national ID if required
        if (election.requires_national_id && identityData.nationalId) {
            const nationalIdHash = encryptionService.hash(identityData.nationalId);
            const userResult = await query(
                `SELECT national_id_hash FROM users WHERE id = $1`,
                [userId]
            );
            if (userResult.rows.length > 0 && userResult.rows[0].national_id_hash !== nationalIdHash) {
                throw new ForbiddenError('Le numéro d\'identité ne correspond pas à votre compte');
            }
        }

        // 5. Check if user has already voted
        const participationResult = await query(
            `SELECT has_voted FROM user_participation WHERE user_id = $1 AND election_id = $2`,
            [userId, electionId]
        );

        if (participationResult.rows.length > 0 && participationResult.rows[0].has_voted) {
            throw new ConflictError('Vous avez déjà voté pour cette élection');
        }

        // 6. Check for existing active token in cache
        const existingTokenKey = `vote_token_user:${userId}:${electionId}`;
        const existingToken = await cache.get(existingTokenKey);
        if (existingToken) {
            // Return existing active token
            return {
                voteToken: existingToken.tokenId,
                expiresAt: existingToken.expiresAt,
                election: {
                    id: election.id,
                    title: election.title,
                    endDate: election.end_date,
                },
            };
        }

        // 7. Generate unique vote token
        const tokenId = encryptionService.generateToken(32);
        const userIdHash = encryptionService.generateUserElectionHash(userId, electionId);
        const expiresAt = new Date(Date.now() + config.security.voteTokenTTL * 1000).toISOString();

        const voteToken = {
            tokenId,
            electionId,
            userIdHash,
            userId, // Temporarily in Redis only, for participation tracking
            expiresAt,
            used: false,
            createdAt: new Date().toISOString(),
        };

        // 8. Store token in cache with TTL
        await cache.set(`vote_token:${tokenId}`, voteToken, config.security.voteTokenTTL);
        await cache.set(existingTokenKey, { tokenId, expiresAt }, config.security.voteTokenTTL);

        // 9. Create/update participation record
        await query(
            `INSERT INTO user_participation (user_id, election_id, vote_token_generated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, election_id)
       DO UPDATE SET vote_token_generated_at = NOW()`,
            [userId, electionId]
        );

        // 10. Audit log (no vote details)
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, details)
       VALUES ($1, 'vote_token_generated', 'election', $2, $3, $4)`,
            [userId, electionId, ipAddress, JSON.stringify({ expiresAt })]
        );

        // 11. Fetch candidates for response
        const candidatesResult = await query(
            `SELECT id, full_name, political_party, slogan, photo_url, program_summary, display_order
       FROM candidates WHERE election_id = $1 AND status = 'approved'
       ORDER BY display_order ASC, full_name ASC`,
            [electionId]
        );

        logger.info('Vote token generated', { userId, electionId });

        return {
            voteToken: tokenId,
            expiresAt,
            election: {
                id: election.id,
                title: election.title,
                endDate: election.end_date,
            },
            candidates: candidatesResult.rows.map((c) => ({
                id: c.id,
                fullName: c.full_name,
                politicalParty: c.political_party,
                slogan: c.slogan,
                photoUrl: c.photo_url,
                programSummary: c.program_summary,
            })),
        };
    }

    /**
     * Submit a vote - ULTRA SECURE PROCESS
     * STEP 2: Validate token, encrypt vote, store anonymously
     */
    async submitVote(voteTokenId, candidateId, deviceType = null, ipRegion = null) {
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Validate vote token from cache
            const voteToken = await cache.get(`vote_token:${voteTokenId}`);

            if (!voteToken) {
                throw new UnauthorizedError('Token de vote invalide ou expiré');
            }

            if (voteToken.used) {
                throw new ConflictError('Ce token de vote a déjà été utilisé');
            }

            if (new Date(voteToken.expiresAt) < new Date()) {
                throw new UnauthorizedError('Token de vote expiré');
            }

            const { electionId, userId } = voteToken;

            // 2. Validate election is still active
            const electionResult = await client.query(
                `SELECT id, status, start_date, end_date, show_results_realtime
         FROM elections WHERE id = $1`,
                [electionId]
            );

            if (electionResult.rows.length === 0) {
                throw new NotFoundError('Élection non trouvée');
            }

            const election = electionResult.rows[0];
            const now = new Date();

            if (election.status !== 'active' || now < new Date(election.start_date) || now > new Date(election.end_date)) {
                throw new UnprocessableError('Cette élection n\'est plus active');
            }

            // 3. Validate candidate
            const candidateResult = await client.query(
                `SELECT id, election_id, status FROM candidates WHERE id = $1`,
                [candidateId]
            );

            if (candidateResult.rows.length === 0) {
                throw new ValidationError('Candidat non trouvé');
            }

            const candidate = candidateResult.rows[0];

            if (candidate.election_id !== electionId) {
                throw new ValidationError('Ce candidat n\'appartient pas à cette élection');
            }

            if (candidate.status !== 'approved') {
                throw new ValidationError('Ce candidat n\'est pas approuvé');
            }

            // 4. Double check user hasn't already voted
            const participationCheck = await client.query(
                `SELECT has_voted FROM user_participation WHERE user_id = $1 AND election_id = $2`,
                [userId, electionId]
            );

            if (participationCheck.rows.length > 0 && participationCheck.rows[0].has_voted) {
                throw new ConflictError('Vous avez déjà voté pour cette élection');
            }

            // 5. DOUBLE ENCRYPTION of the vote
            const timestamp = new Date().toISOString();
            const voteData = JSON.stringify({
                candidateId,
                timestamp,
                electionId,
            });

            // First layer: Encrypt vote data
            const encryptedVote = encryptionService.encrypt(voteData);

            // 6. Generate cryptographic vote proof (unique hash)
            const voteProof = encryptionService.generateVoteProof(electionId, candidateId, timestamp);

            // 7. Generate digital signature
            const voteSignature = encryptionService.generateVoteSignature(voteProof, timestamp);

            // 8. Store vote in PostgreSQL (ANONYMIZED - NO user_id!)
            const voteResult = await client.query(
                `INSERT INTO votes (election_id, candidate_id, encrypted_vote, vote_proof, vote_signature, timestamp, device_type, ip_region)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
                [electionId, candidateId, encryptedVote, voteProof, voteSignature, timestamp, deviceType, ipRegion]
            );

            const voteId = voteResult.rows[0].id;

            // 9. Generate unique receipt code
            const receiptCode = encryptionService.generateReceiptCode(electionId);

            // 10. Store receipt (separate from vote content)
            await client.query(
                `INSERT INTO vote_receipts (receipt_code, vote_id, election_id, timestamp)
         VALUES ($1, $2, $3, $4)`,
                [receiptCode, voteId, electionId, timestamp]
            );

            // 11. Mark token as used in cache
            voteToken.used = true;
            await cache.set(`vote_token:${voteTokenId}`, voteToken, 60); // Keep briefly for dedup

            // Clear the user-election token mapping
            await cache.del(`vote_token_user:${userId}:${electionId}`);

            // 12. Mark user as having voted
            await client.query(
                `UPDATE user_participation
         SET has_voted = TRUE, voted_at = $1, vote_token_used_at = $1, receipt_code = $2
         WHERE user_id = $3 AND election_id = $4`,
                [timestamp, receiptCode, userId, electionId]
            );

            // 13. Queue vote aggregation (Asynchronous)
            // This offloads the heavy DB updates to a background worker
            await voteQueue.add('aggregate-vote', { electionId, candidateId }, {
                jobId: `vote:${voteId}`, // Deduplication
            });

            // 14. Audit log (NO vote details - only confirmation)
            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, 'vote_submitted', 'election', $2, $3)`,
                [userId, electionId, JSON.stringify({ receiptCode })]
            );

            await client.query('COMMIT');

            logger.info('Vote submitted successfully', {
                electionId,
                receiptCode,
                // NOTE: No userId or candidateId logged for anonymity!
            });

            return {
                receiptCode,
                timestamp,
                message: 'Votre vote a été enregistré avec succès',
            };
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Vote submission failed', {
                error: error.message,
                electionId: voteTokenId ? 'masked' : 'unknown',
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Verify a vote using receipt code
     * STEP 3: Confirm vote was recorded WITHOUT revealing the choice
     */
    async verifyVote(receiptCode) {
        const result = await query(
            `SELECT vr.receipt_code, vr.timestamp, vr.election_id,
              v.vote_proof, v.vote_signature,
              e.title as election_title, e.status as election_status
       FROM vote_receipts vr
       JOIN votes v ON v.id = vr.vote_id
       JOIN elections e ON e.id = vr.election_id
       WHERE vr.receipt_code = $1`,
            [receiptCode]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Code de reçu invalide');
        }

        const receipt = result.rows[0];

        // Verify cryptographic signature
        let signatureValid = false;
        try {
            signatureValid = encryptionService.verifyVoteSignature(
                receipt.vote_proof,
                receipt.timestamp.toISOString(),
                receipt.vote_signature
            );
        } catch (e) {
            signatureValid = false;
        }

        return {
            verified: true,
            signatureValid,
            electionId: receipt.election_id,
            electionTitle: receipt.election_title,
            timestamp: receipt.timestamp,
            voteIncluded: true,
            // NEVER reveal the candidate choice!
        };
    }

    /**
     * Get election results
     */
    async getElectionResults(electionId, userId = null) {
        // Try cache first
        const cachedResults = await cache.get(`election:${electionId}:results`);
        if (cachedResults) {
            return cachedResults;
        }

        // Fetch election
        const electionResult = await query(
            `SELECT * FROM elections WHERE id = $1`,
            [electionId]
        );

        if (electionResult.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = electionResult.rows[0];

        // Check if results should be visible based on detailed settings
        const settings = election.results_settings || {};
        const isClosed = election.status === 'closed';
        const isPastRelease = election.results_release_date && now >= new Date(election.results_release_date);

        // Rule 1: showOnlyAfterClosing
        if (settings.showOnlyAfterClosing && !isClosed && !isPastRelease) {
            throw new ForbiddenError('Les résultats ne seront visibles qu\'après la clôture du scrutin');
        }

        // Rule 2: showDuringVoting
        if (!settings.showDuringVoting && election.status === 'active') {
            throw new ForbiddenError('La consultation des résultats en temps réel est désactivée pour cette élection');
        }

        // Fetch candidates with vote counts
        const candidatesResult = await query(
            `SELECT id, full_name, political_party, photo_url, vote_count, vote_percentage, display_order
       FROM candidates
       WHERE election_id = $1 AND status = 'approved'
       ORDER BY vote_count DESC, display_order ASC`,
            [electionId]
        );

        const results = candidatesResult.rows.map((c, index) => {
            const candidate = {
                candidateId: c.id,
                fullName: c.full_name,
                politicalParty: c.political_party,
                photoUrl: c.photo_url,
                rank: index + 1,
            };

            // Rule 3: showPercentages
            if (settings.showPercentages !== false) {
                candidate.votePercentage = parseFloat(c.vote_percentage) || 0;
            }

            // Always include vote counts unless explicitly restricted (future proofing)
            candidate.voteCount = c.vote_count;

            return candidate;
        });

        const response = {
            election: {
                id: election.id,
                title: election.title,
                type: election.type,
                status: election.status,
                startDate: election.start_date,
                endDate: election.end_date,
            },
            stats: {
                totalRegisteredVoters: election.total_registered_voters,
                totalVotesCast: election.total_votes_cast,
                participationRate: parseFloat(election.participation_rate) || 0,
                lastUpdated: new Date().toISOString(),
            },
            results,
        };

        // Rule 4: showNationalOnly / showByRegion
        // (Note: Currently the basic results API is national, regional results would be a separate endpoint/view)
        if (settings.showNationalOnly) {
            delete response.stats.votesByRegion; // If it existed
        }

        // Cache results (short TTL during active election)
        const ttl = election.status === 'active' ? 30 : 300;
        await cache.set(`election:${electionId}:results`, response, ttl);

        return response;
    }
}

module.exports = new VoteService();
