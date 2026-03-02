/**
 * User Management Controller
 */
const userService = require('../services/user.service');
const ApiResponse = require('../utils/response');

class UserController {
    /**
     * GET /api/users
     */
    async getUsers(req, res, next) {
        try {
            const result = await userService.getUsers(req.query);
            return ApiResponse.paginated(res, result.users, result.pagination, 'Utilisateurs récupérés');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/users/stats
     */
    async getStats(req, res, next) {
        try {
            const stats = await userService.getStats();
            return ApiResponse.success(res, stats, 'Statistiques récupérées');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/users/:userId
     */
    async getUser(req, res, next) {
        try {
            const user = await userService.getUserById(req.params.userId);
            return ApiResponse.success(res, user);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/users/:userId/role
     */
    async updateRole(req, res, next) {
        try {
            const { role } = req.body;
            const result = await userService.updateRole(req.params.userId, role, req.user.id);
            return ApiResponse.success(res, result, 'Rôle mis à jour');
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/users/:userId/toggle-active
     */
    async toggleActive(req, res, next) {
        try {
            const result = await userService.toggleActive(req.params.userId, req.user.id);
            return ApiResponse.success(res, result, `Utilisateur ${result.isActive ? 'activé' : 'désactivé'}`);
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/users/:userId
     */
    async deleteUser(req, res, next) {
        try {
            const result = await userService.deleteUser(req.params.userId, req.user.id);
            return ApiResponse.success(res, result, 'Utilisateur supprimé');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
