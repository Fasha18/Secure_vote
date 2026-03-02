/**
 * Candidate Service
 * CRUD operations for election candidates
 */
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
} = require('../utils/errors');

class CandidateService {
    /**
     * Add a candidate to an election
     */
    async createCandidate(electionId, candidateData, userId) {
        // Verify election exists
        const electionResult = await query(
            `SELECT id, status, organizer_id FROM elections WHERE id = $1`,
            [electionId]
        );

        if (electionResult.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = electionResult.rows[0];

        // Check permissions
        const userResult = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
        const userRole = userResult.rows[0]?.role;

        if (election.organizer_id !== userId && !['admin', 'super_admin'].includes(userRole)) {
            throw new ForbiddenError('Vous n\'avez pas la permission d\'ajouter un candidat');
        }

        // Can only add candidates to draft or scheduled elections
        if (!['draft', 'scheduled'].includes(election.status)) {
            throw new ConflictError('Impossible d\'ajouter un candidat à une élection active ou terminée');
        }

        const result = await query(
            `INSERT INTO candidates (
        election_id, full_name, political_party, slogan, biography,
        photo_url, video_url, website_url, social_media,
        program_summary, program_details, program_pdf_url,
        status, approved_by, approved_at, display_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'approved',$13,NOW(),$14)
      RETURNING *`,
            [
                electionId,
                candidateData.fullName,
                candidateData.politicalParty || null,
                candidateData.slogan || null,
                candidateData.biography,
                candidateData.photoUrl || null,
                candidateData.videoUrl || null,
                candidateData.websiteUrl || null,
                candidateData.socialMedia ? JSON.stringify(candidateData.socialMedia) : null,
                candidateData.programSummary || null,
                candidateData.programDetails || null,
                candidateData.programPdfUrl || null,
                userId,
                candidateData.displayOrder || 0,
            ]
        );

        // Invalidate cache
        await cache.del(`election:${electionId}`);
        await cache.del(`election:${electionId}:candidates`);

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
       VALUES ($1, 'candidate_created', 'candidate', $2, $3)`,
            [userId, result.rows[0].id, JSON.stringify({ fullName: candidateData.fullName, electionId })]
        );

        logger.info('Candidate created', { candidateId: result.rows[0].id, electionId });

        return this._formatCandidate(result.rows[0]);
    }

    /**
     * Get all candidates for an election
     */
    async getCandidatesByElection(electionId) {
        // Try cache
        const cacheKey = `election:${electionId}:candidates`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const electionResult = await query(
            `SELECT id, status, show_results_realtime FROM elections WHERE id = $1`,
            [electionId]
        );

        if (electionResult.rows.length === 0) {
            throw new NotFoundError('Élection non trouvée');
        }

        const election = electionResult.rows[0];

        const result = await query(
            `SELECT * FROM candidates
       WHERE election_id = $1 AND status = 'approved'
       ORDER BY display_order ASC, full_name ASC`,
            [electionId]
        );

        const showVotes = election.show_results_realtime || election.status === 'closed';

        const candidates = result.rows.map((c) => {
            const formatted = this._formatCandidate(c);
            if (!showVotes) {
                delete formatted.voteCount;
                delete formatted.votePercentage;
            }
            return formatted;
        });

        const response = { candidates, total: candidates.length };

        // Cache for 10 minutes
        await cache.set(cacheKey, response, 600);

        return response;
    }

    /**
     * Update a candidate
     */
    async updateCandidate(candidateId, updateData, userId) {
        const existing = await query(
            `SELECT c.*, e.organizer_id, e.status as election_status
       FROM candidates c
       JOIN elections e ON e.id = c.election_id
       WHERE c.id = $1`,
            [candidateId]
        );

        if (existing.rows.length === 0) {
            throw new NotFoundError('Candidat non trouvé');
        }

        const candidate = existing.rows[0];

        // Check permissions
        const userResult = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
        const userRole = userResult.rows[0]?.role;

        if (candidate.organizer_id !== userId && !['admin', 'super_admin'].includes(userRole)) {
            throw new ForbiddenError('Vous n\'avez pas la permission de modifier ce candidat');
        }

        if (candidate.election_status === 'closed') {
            throw new ConflictError('Impossible de modifier un candidat d\'une élection terminée');
        }

        // Build update
        const fieldMap = {
            fullName: 'full_name',
            politicalParty: 'political_party',
            slogan: 'slogan',
            biography: 'biography',
            photoUrl: 'photo_url',
            videoUrl: 'video_url',
            websiteUrl: 'website_url',
            programSummary: 'program_summary',
            programDetails: 'program_details',
            programPdfUrl: 'program_pdf_url',
            displayOrder: 'display_order',
        };

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
            if (updateData[jsKey] !== undefined) {
                updates.push(`${dbKey} = $${paramIndex}`);
                values.push(updateData[jsKey]);
                paramIndex++;
            }
        }

        if (updateData.socialMedia !== undefined) {
            updates.push(`social_media = $${paramIndex}`);
            values.push(JSON.stringify(updateData.socialMedia));
            paramIndex++;
        }

        if (updates.length === 0) {
            throw new ValidationError('Aucun champ à mettre à jour');
        }

        values.push(candidateId);
        const result = await query(
            `UPDATE candidates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        // Invalidate cache
        await cache.del(`election:${candidate.election_id}`);
        await cache.del(`election:${candidate.election_id}:candidates`);

        logger.info('Candidate updated', { candidateId, updatedBy: userId });

        return this._formatCandidate(result.rows[0]);
    }

    /**
     * Delete a candidate
     */
    async deleteCandidate(candidateId, userId) {
        const existing = await query(
            `SELECT c.*, e.organizer_id, e.status as election_status
       FROM candidates c
       JOIN elections e ON e.id = c.election_id
       WHERE c.id = $1`,
            [candidateId]
        );

        if (existing.rows.length === 0) {
            throw new NotFoundError('Candidat non trouvé');
        }

        const candidate = existing.rows[0];

        if (candidate.election_status !== 'draft') {
            throw new ConflictError('Impossible de supprimer un candidat sauf en brouillon');
        }

        // Check permissions
        const userResult = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
        const userRole = userResult.rows[0]?.role;

        if (candidate.organizer_id !== userId && !['admin', 'super_admin'].includes(userRole)) {
            throw new ForbiddenError('Permission refusée');
        }

        await query(`DELETE FROM candidates WHERE id = $1`, [candidateId]);

        // Invalidate cache
        await cache.del(`election:${candidate.election_id}`);
        await cache.del(`election:${candidate.election_id}:candidates`);

        logger.info('Candidate deleted', { candidateId, deletedBy: userId });

        return { message: 'Candidat supprimé avec succès' };
    }

    _formatCandidate(row) {
        return {
            id: row.id,
            electionId: row.election_id,
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
            voteCount: row.vote_count,
            votePercentage: parseFloat(row.vote_percentage) || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}

module.exports = new CandidateService();
