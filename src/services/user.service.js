/**
 * User Management Service
 * CRUD operations for users and role management
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

class UserService {
    /**
     * Get all users with pagination and filters
     */
    async getUsers(filters = {}) {
        const { page = 1, limit = 20, role, search, status } = filters;
        const params = [];
        const conditions = ['1=1'];
        let paramIndex = 1;

        if (role) {
            conditions.push(`u.role = $${paramIndex}`);
            params.push(role);
            paramIndex++;
        }

        if (search) {
            conditions.push(`(u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status === 'active') {
            conditions.push(`u.is_active = TRUE`);
        } else if (status === 'inactive') {
            conditions.push(`u.is_active = FALSE`);
        }

        const whereClause = conditions.join(' AND ');

        // Count total
        const countResult = await query(
            `SELECT COUNT(*) FROM users u WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Fetch
        const offset = (page - 1) * limit;
        params.push(limit);
        params.push(offset);

        const result = await query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
                    u.is_active, u.email_verified, u.created_at, u.last_login_at,
                    u.nationality, u.student_id, u.employee_id, u.organization_name, u.is_active_member
             FROM users u
             WHERE ${whereClause}
             ORDER BY u.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            params
        );

        const users = result.rows.map(u => ({
            id: u.id,
            email: u.email,
            firstName: u.first_name,
            lastName: u.last_name,
            phone: u.phone,
            role: u.role,
            isActive: u.is_active,
            emailVerified: u.email_verified,
            createdAt: u.created_at,
            lastLoginAt: u.last_login_at,
            nationality: u.nationality,
            studentId: u.student_id,
            employeeId: u.employee_id,
            organizationName: u.organization_name,
            isActiveMember: u.is_active_member,
        }));

        return {
            users,
            pagination: { page: parseInt(page), limit: parseInt(limit), total },
        };
    }

    /**
     * Get a single user by ID
     */
    async getUserById(userId) {
        const result = await query(
            `SELECT id, email, first_name, last_name, phone, role, is_active,
                    email_verified, created_at, last_login_at,
                    nationality, student_id, employee_id, organization_name, is_active_member
             FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Utilisateur non trouvé');
        }

        const u = result.rows[0];
        return {
            id: u.id,
            email: u.email,
            firstName: u.first_name,
            lastName: u.last_name,
            phone: u.phone,
            role: u.role,
            isActive: u.is_active,
            emailVerified: u.email_verified,
            createdAt: u.created_at,
            lastLoginAt: u.last_login_at,
            nationality: u.nationality,
            studentId: u.student_id,
            employeeId: u.employee_id,
            organizationName: u.organization_name,
            isActiveMember: u.is_active_member,
        };
    }

    /**
     * Update a user's role
     */
    async updateRole(userId, newRole, adminId) {
        const validRoles = ['voter', 'organizer', 'admin', 'super_admin'];
        if (!validRoles.includes(newRole)) {
            throw new ValidationError(`Rôle invalide. Rôles valides: ${validRoles.join(', ')}`);
        }

        // Prevent self-demotion
        if (userId === adminId) {
            throw new ValidationError('Vous ne pouvez pas modifier votre propre rôle');
        }

        const result = await query(
            `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
             RETURNING id, email, first_name, last_name, role`,
            [newRole, userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Utilisateur non trouvé');
        }

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
             VALUES ($1, 'role_changed', 'user', $2, $3)`,
            [adminId, userId, JSON.stringify({ newRole })]
        );

        logger.info('User role updated', { userId, newRole, adminId });

        const u = result.rows[0];
        return {
            id: u.id,
            email: u.email,
            firstName: u.first_name,
            lastName: u.last_name,
            role: u.role,
        };
    }

    /**
     * Toggle user active status (activate/deactivate)
     */
    async toggleActive(userId, adminId) {
        if (userId === adminId) {
            throw new ValidationError('Vous ne pouvez pas désactiver votre propre compte');
        }

        const result = await query(
            `UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1
             RETURNING id, email, first_name, last_name, is_active`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Utilisateur non trouvé');
        }

        const u = result.rows[0];

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
             VALUES ($1, 'user_status_changed', 'user', $2, $3)`,
            [adminId, userId, JSON.stringify({ isActive: u.is_active })]
        );

        logger.info('User status toggled', { userId, isActive: u.is_active, adminId });

        return {
            id: u.id,
            email: u.email,
            firstName: u.first_name,
            lastName: u.last_name,
            isActive: u.is_active,
        };
    }

    /**
     * Delete a user
     */
    async deleteUser(userId, adminId) {
        if (userId === adminId) {
            throw new ValidationError('Vous ne pouvez pas supprimer votre propre compte');
        }

        const result = await query(
            `DELETE FROM users WHERE id = $1 RETURNING id, email`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Utilisateur non trouvé');
        }

        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
             VALUES ($1, 'user_deleted', 'user', $2, $3)`,
            [adminId, userId, JSON.stringify({ deletedEmail: result.rows[0].email })]
        );

        logger.info('User deleted', { userId, adminId });
        return { message: 'Utilisateur supprimé' };
    }

    /**
     * Get statistics for the dashboard
     */
    async getStats() {
        const [usersCount, activeCount, rolesCount, electionsCount, votesCount] = await Promise.all([
            query(`SELECT COUNT(*) as count FROM users`),
            query(`SELECT COUNT(*) as count FROM users WHERE is_active = TRUE`),
            query(`SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC`),
            query(`SELECT 
                     COUNT(*) as total,
                     COUNT(*) FILTER (WHERE status = 'active') as active,
                     COUNT(*) FILTER (WHERE status = 'draft') as draft,
                     COUNT(*) FILTER (WHERE status = 'closed') as closed
                   FROM elections`),
            query(`SELECT COUNT(*) as count FROM votes`),
        ]);

        return {
            totalUsers: parseInt(usersCount.rows[0].count),
            activeUsers: parseInt(activeCount.rows[0].count),
            roleDistribution: rolesCount.rows.map(r => ({ role: r.role, count: parseInt(r.count) })),
            elections: {
                total: parseInt(electionsCount.rows[0].total),
                active: parseInt(electionsCount.rows[0].active),
                draft: parseInt(electionsCount.rows[0].draft),
                closed: parseInt(electionsCount.rows[0].closed),
            },
            totalVotes: parseInt(votesCount.rows[0].count),
        };
    }
}

module.exports = new UserService();
