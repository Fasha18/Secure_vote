/**
 * Election Controller
 */
const electionService = require('../services/election.service');
const ApiResponse = require('../utils/response');

class ElectionController {
    /**
     * GET /api/elections
     */
    async getElections(req, res, next) {
        try {
            const result = await electionService.getElections(req.query, req.user?.id);
            return ApiResponse.paginated(res, result.elections, result.pagination, 'Élections récupérées');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/elections/:electionId
     */
    async getElectionById(req, res, next) {
        try {
            const election = await electionService.getElectionById(
                req.params.electionId,
                req.user?.id
            );
            return ApiResponse.success(res, election);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/elections
     */
    async createElection(req, res, next) {
        try {
            const election = await electionService.createElection(req.body, req.user.id);
            return ApiResponse.created(res, election, 'Élection créée avec succès');
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/elections/:electionId
     */
    async updateElection(req, res, next) {
        try {
            const election = await electionService.updateElection(
                req.params.electionId,
                req.body,
                req.user.id
            );
            return ApiResponse.success(res, election, 'Élection mise à jour');
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/elections/:electionId
     */
    async deleteElection(req, res, next) {
        try {
            const result = await electionService.deleteElection(
                req.params.electionId,
                req.user.id
            );
            return ApiResponse.success(res, result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/elections/:electionId/status
     */
    async changeStatus(req, res, next) {
        try {
            const { status } = req.body;
            const result = await electionService.changeElectionStatus(
                req.params.electionId,
                status,
                req.user.id
            );
            return ApiResponse.success(res, result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ElectionController();
