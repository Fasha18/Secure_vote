/**
 * Vote Controller - THE MOST CRITICAL CONTROLLER
 */
const voteService = require('../services/vote.service');
const ApiResponse = require('../utils/response');

class VoteController {
    /**
     * POST /api/elections/:electionId/request-vote-token
     * Request a unique vote token
     */
    async requestVoteToken(req, res, next) {
        try {
            const result = await voteService.requestVoteToken(
                req.user.id,
                req.params.electionId,
                req.body,
                req.ip
            );
            return ApiResponse.success(res, result, 'Token de vote généré');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/votes/submit
     * Submit an encrypted vote
     */
    async submitVote(req, res, next) {
        try {
            const voteToken = req.headers['x-vote-token'];

            if (!voteToken) {
                return ApiResponse.error(res, 'Token de vote manquant (header X-Vote-Token)', 401);
            }

            const deviceType = req.headers['x-device-type'] || 'web';
            const { candidateId } = req.body;

            const result = await voteService.submitVote(
                voteToken,
                candidateId,
                deviceType,
                null // IP region - could be derived from IP
            );

            return ApiResponse.success(res, result, 'Vote enregistré avec succès');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/votes/verify/:receiptCode
     * Verify a vote was recorded
     */
    async verifyVote(req, res, next) {
        try {
            const result = await voteService.verifyVote(req.params.receiptCode);
            return ApiResponse.success(res, result, 'Vote vérifié');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/elections/:electionId/results
     * Get election results
     */
    async getResults(req, res, next) {
        try {
            const results = await voteService.getElectionResults(
                req.params.electionId,
                req.user?.id
            );
            return ApiResponse.success(res, results, 'Résultats récupérés');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new VoteController();
