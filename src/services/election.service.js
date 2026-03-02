/**
 * Election Service
 * CRUD operations and election lifecycle management
 */
const { query, getClient } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
} = require('../utils/errors');

class ElectionService {
    /**
     * Create a new election
     */
    async createElection(electionData, organizerId) {
        const result = await query(
            `INSERT INTO elections (
        title, description, type, status, visibility,
        start_date, end_date, results_release_date,
        requires_national_id, requires_student_card, requires_2fa,
        allow_abstention, max_votes_per_user,
        organizer_id, organization_name,
        eligibility_criteria,
        show_results_realtime, allow_vote_verification,
        results_settings
      ) VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
            [
                electionData.title,
                electionData.description,
                electionData.type,
                electionData.visibility || 'public',
                electionData.startDate,
                electionData.endDate,
                electionData.resultsReleaseDate || null,
                electionData.requiresNationalId || false,
                electionData.requiresStudentCard || false,
                electionData.requires2FA || false,
                electionData.allowAbstention !== false,
                electionData.maxVotesPerUser || 1,
                organizerId,
                electionData.organizationName || null,
                JSON.stringify(electionData.eligibilityCriteria || {}),
                electionData.showResultsRealtime !== false,
                electionData.allowVoteVerification !== false,
                JSON.stringify(electionData.resultsSettings || {
                    showDuringVoting: true,
                    showOnlyAfterClosing: false,
                    showByRegion: true,
                    showNationalOnly: false,
                    showPercentages: true
                }),
            ]
        );

        const election = result.rows[0];

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'election_created', 'election', $2, $3)`,
            [organizerId, election.id, JSON.stringify({ title: election.title })]
        );

        logger.info('Election created', { electionId: election.id, title: election.title });

        return this._formatElection(election);
    }

    /**
     * Get all elections with filtering, pagination, and sorting
     */
    async getElections(filters = {}, userId = null) {
        const { type, status, page = 1, limit = 20, sort = '-created_at', search } = filters;

        let whereConditions = ['1=1'];
        const params = [];
        let paramIndex = 1;

        // Filter by type
        if (type) {
            whereConditions.push(`e.type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        // Filter by status
        if (status) {
            whereConditions.push(`e.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Search
        if (search) {
            whereConditions.push(`(e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Only show public elections to non-admins
        if (!userId) {
            whereConditions.push(`e.visibility = 'public'`);
        }

        const whereClause = whereConditions.join(' AND ');

        // Sorting
        let orderClause = 'e.created_at DESC';
        const sortMap = {
            'start_date': 'e.start_date ASC',
            '-start_date': 'e.start_date DESC',
            'title': 'e.title ASC',
            '-title': 'e.title DESC',
            'created_at': 'e.created_at ASC',
            '-created_at': 'e.created_at DESC',
        };
        if (sortMap[sort]) {
            orderClause = sortMap[sort];
        }

        // Count total
        const countResult = await query(
            `SELECT COUNT(*) FROM elections e WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Fetch page
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);

        let electionsQuery = `
      SELECT e.*,
             u.first_name as organizer_first_name,
             u.last_name as organizer_last_name
      FROM elections e
      LEFT JOIN users u ON u.id = e.organizer_id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        const electionsResult = await query(electionsQuery, params);

        let elections = electionsResult.rows.map((e) => this._formatElection(e));

        // If user is authenticated, add their participation info
        if (userId) {
            const participationResult = await query(
                `SELECT election_id, has_voted FROM user_participation WHERE user_id = $1`,
                [userId]
            );
            const participationMap = {};
            participationResult.rows.forEach((p) => {
                participationMap[p.election_id] = p.has_voted;
            });

            elections = elections.map((e) => ({
                ...e,
                hasVoted: participationMap[e.id] || false,
                canVote: e.status === 'active' && !participationMap[e.id],
            }));
        }

        return {
            elections,
            pagination: { page, limit, total },
        };
    }

    /**
     * Get a single election by ID with full details
     */
    async getElectionById(electionId, userId = null) {
        // Try cache
        const cacheKey = `election:${electionId}`;
        const cached = await cache.get(cacheKey);
        if (cached && !userId) {
            return cached;
        }

        const result = await query(
            `SELECT e.*,
              u.first_name as organizer_first_name,
              u.last_name as organizer_last_name
       FROM elections e
       LEFT JOIN users u ON u.id = e.organizer_id
       WHERE e.id = $1`,
            [electionId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = this._formatElection(result.rows[0]);

        // Fetch candidates
        const candidatesResult = await query(
            `SELECT * FROM candidates 
       WHERE election_id = $1 AND status = 'approved'
       ORDER BY display_order ASC, full_name ASC`,
            [electionId]
        );

        election.candidates = candidatesResult.rows.map((c) => this._formatCandidate(c, election));

        // Calculate remaining time
        const now = new Date();
        const endDate = new Date(election.endDate);
        election.stats = {
            totalRegisteredVoters: election.totalRegisteredVoters,
            totalVotesCast: election.totalVotesCast,
            participationRate: election.participationRate,
            remainingTime: Math.max(0, Math.floor((endDate - now) / 1000)),
        };

        // User-specific info
        if (userId) {
            const participation = await query(
                `SELECT has_voted, voted_at, receipt_code FROM user_participation
         WHERE user_id = $1 AND election_id = $2`,
                [userId, electionId]
            );

            election.userInfo = {
                canVote: election.status === 'active' && (!participation.rows[0] || !participation.rows[0].has_voted),
                hasVoted: participation.rows[0]?.has_voted || false,
                votedAt: participation.rows[0]?.voted_at || null,
                receiptCode: participation.rows[0]?.receipt_code || null,
            };
        }

        // Cache (no user-specific data)
        if (!userId) {
            await cache.set(cacheKey, election, election.status === 'active' ? 60 : 300);
        }

        return election;
    }

    /**
     * Update an election
     */
    async updateElection(electionId, updateData, userId) {
        // Verify election exists and user has permission
        const existing = await query(
            `SELECT * FROM elections WHERE id = $1`,
            [electionId]
        );

        if (existing.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = existing.rows[0];

        // Check permissions
        const userResult = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
        const userRole = userResult.rows[0]?.role;

        if (election.organizer_id !== userId && !['admin', 'super_admin'].includes(userRole)) {
            throw new ForbiddenError('Vous n\'avez pas la permission de modifier cette élection');
        }

        // Can only modify draft or scheduled elections
        if (!['draft', 'scheduled'].includes(election.status)) {
            throw new ConflictError('Impossible de modifier une élection active ou terminée');
        }

        // Build update query dynamically
        const fieldMap = {
            title: 'title',
            description: 'description',
            type: 'type',
            visibility: 'visibility',
            startDate: 'start_date',
            endDate: 'end_date',
            resultsReleaseDate: 'results_release_date',
            requiresNationalId: 'requires_national_id',
            requiresStudentCard: 'requires_student_card',
            requires2FA: 'requires_2fa',
            allowAbstention: 'allow_abstention',
            maxVotesPerUser: 'max_votes_per_user',
            organizationName: 'organization_name',
            showResultsRealtime: 'show_results_realtime',
            allowVoteVerification: 'allow_vote_verification',
            resultsSettings: 'results_settings',
        };

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
            if (updateData[jsKey] !== undefined) {
                updates.push(`${dbKey} = $${paramIndex}`);
                let val = updateData[jsKey];
                if (jsKey === 'resultsSettings') val = JSON.stringify(val);
                values.push(val);
                paramIndex++;
            }
        }

        if (updateData.eligibilityCriteria !== undefined) {
            updates.push(`eligibility_criteria = $${paramIndex}`);
            values.push(JSON.stringify(updateData.eligibilityCriteria));
            paramIndex++;
        }

        if (updates.length === 0) {
            throw new ValidationError('Aucun champ à mettre à jour');
        }

        values.push(electionId);
        const result = await query(
            `UPDATE elections SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        // Invalidate cache
        await cache.del(`election:${electionId}`);

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'election_updated', 'election', $2, $3)`,
            [userId, electionId, JSON.stringify({ updatedFields: Object.keys(updateData) })]
        );

        logger.info('Election updated', { electionId, updatedBy: userId });

        return this._formatElection(result.rows[0]);
    }

    /**
     * Delete an election
     */
    async deleteElection(electionId, userId) {
        const existing = await query(`SELECT * FROM elections WHERE id = $1`, [electionId]);

        if (existing.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = existing.rows[0];

        // Only draft or cancelled elections can be deleted
        if (!['draft', 'cancelled'].includes(election.status)) {
            throw new ConflictError('Seules les élections en brouillon ou annulées peuvent être supprimées');
        }

        await query(`DELETE FROM elections WHERE id = $1`, [electionId]);

        // Invalidate cache
        await cache.del(`election:${electionId}`);

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'election_deleted', 'election', $2, $3)`,
            [userId, electionId, JSON.stringify({ title: election.title })]
        );

        logger.info('Election deleted', { electionId, deletedBy: userId });

        return { message: 'Élection supprimée avec succès' };
    }

    /**
     * Change election status
     */
    async changeElectionStatus(electionId, newStatus, userId) {
        const validTransitions = {
            'draft': ['scheduled', 'cancelled'],
            'scheduled': ['active', 'cancelled'],
            'active': ['closed', 'cancelled'],
            'closed': [],
            'cancelled': [],
        };

        const existing = await query(`SELECT * FROM elections WHERE id = $1`, [electionId]);
        if (existing.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = existing.rows[0];

        if (!validTransitions[election.status]?.includes(newStatus)) {
            throw new ConflictError(
                `Transition de statut invalide: ${election.status} → ${newStatus}`
            );
        }

        await query(
            `UPDATE elections SET status = $1 WHERE id = $2`,
            [newStatus, electionId]
        );

        // Invalidate cache
        await cache.del(`election:${electionId}`);
        await cache.del(`election:${electionId}:results`);

        // System event
        await query(
            `INSERT INTO system_events (event_type, severity, message, details)
       VALUES ($1, 'info', $2, $3)`,
            [
                `election_${newStatus}`,
                `Élection "${election.title}" est maintenant ${newStatus}`,
                JSON.stringify({ electionId, previousStatus: election.status, newStatus }),
            ]
        );

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'election_status_changed', 'election', $2, $3)`,
            [userId, electionId, JSON.stringify({ from: election.status, to: newStatus })]
        );

        logger.info('Election status changed', { electionId, from: election.status, to: newStatus });

        return { status: newStatus, message: `Statut changé en ${newStatus}` };
    }

    /**
     * Format election from DB row to API response
     */
    _formatElection(row) {
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            type: row.type,
            status: row.status,
            visibility: row.visibility,
            startDate: row.start_date,
            endDate: row.end_date,
            resultsReleaseDate: row.results_release_date,
            requiresNationalId: row.requires_national_id,
            requiresStudentCard: row.requires_student_card,
            requires2FA: row.requires_2fa,
            allowAbstention: row.allow_abstention,
            maxVotesPerUser: row.max_votes_per_user,
            organizerId: row.organizer_id,
            organizerName: row.organizer_first_name
                ? `${row.organizer_first_name} ${row.organizer_last_name}`
                : row.organization_name,
            organizationName: row.organization_name,
            eligibilityCriteria: row.eligibility_criteria,
            showResultsRealtime: row.show_results_realtime,
            allowVoteVerification: row.allow_vote_verification,
            resultsSettings: row.results_settings || {},
            totalRegisteredVoters: row.total_registered_voters,
            totalVotesCast: row.total_votes_cast,
            participationRate: parseFloat(row.participation_rate) || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Format candidate from DB row
     */
    _formatCandidate(row, election = null) {
        const candidate = {
            id: row.id,
            fullName: row.full_name,
            politicalParty: row.political_party,
            slogan: row.slogan,
            biography: row.biography,
            photoUrl: row.photo_url,
            videoUrl: row.video_url,
            websiteUrl: row.website_url,
            socialMedia: row.social_media,
            programSummary: row.program_summary,
            programDetails: row.program_details,
            programPdfUrl: row.program_pdf_url,
            status: row.status,
            displayOrder: row.display_order,
            createdAt: row.created_at,
        };

        // Only include vote stats if appropriate
        if (election && (election.showResultsRealtime || election.status === 'closed')) {
            candidate.voteCount = row.vote_count;
            candidate.votePercentage = parseFloat(row.vote_percentage) || 0;
        }

        return candidate;
    }
}

module.exports = new ElectionService();
