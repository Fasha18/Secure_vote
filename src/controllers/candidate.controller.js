/**
 * Candidate Controller
 */
const candidateService = require('../services/candidate.service');
const ApiResponse = require('../utils/response');

class CandidateController {
    /**
     * GET /api/elections/:electionId/candidates
     */
    async getCandidates(req, res, next) {
        try {
            const result = await candidateService.getCandidatesByElection(req.params.electionId);
            return ApiResponse.success(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/elections/:electionId/candidates
     */
    async createCandidate(req, res, next) {
        try {
            const candidate = await candidateService.createCandidate(
                req.params.electionId,
                req.body,
                req.user.id
            );
            return ApiResponse.created(res, candidate, 'Candidat ajouté avec succès');
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/candidates/:candidateId
     */
    async updateCandidate(req, res, next) {
        try {
            const candidate = await candidateService.updateCandidate(
                req.params.candidateId,
                req.body,
                req.user.id
            );
            return ApiResponse.success(res, candidate, 'Candidat mis à jour');
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/candidates/:candidateId
     */
    async deleteCandidate(req, res, next) {
        try {
            const result = await candidateService.deleteCandidate(
                req.params.candidateId,
                req.user.id
            );
            return ApiResponse.success(res, result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CandidateController();
