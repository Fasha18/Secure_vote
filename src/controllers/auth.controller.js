/**
 * Authentication Controller
 * Handles HTTP layer for auth operations
 */
const authService = require('../services/auth.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class AuthController {
    /**
     * POST /api/auth/register
     */
    async register(req, res, next) {
        try {
            logger.info('📥 Received registration request', { email: req.body.email });
            const result = await authService.register(
                req.body,
                req.ip,
                req.get('User-Agent')
            );
            return ApiResponse.created(res, result, 'Inscription réussie');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/login
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(
                email,
                password,
                req.ip,
                req.get('User-Agent')
            );
            return ApiResponse.success(res, result, result.message || 'Code OTP envoyé par email');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/verify-otp
     * Verify OTP code and get final JWT tokens
     */
    async verifyLoginOTP(req, res, next) {
        try {
            const { otpCode } = req.body;
            const result = await authService.verifyLoginOTP(
                req.user.id,
                otpCode,
                req.ip,
                req.get('User-Agent')
            );
            return ApiResponse.success(res, result, 'Connexion réussie');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/resend-otp
     * Resend OTP code for login
     */
    async resendOTP(req, res, next) {
        try {
            const otpService = require('../services/otp.service');
            const { query } = require('../config/database');

            // Get user email
            const userResult = await query(
                `SELECT email, first_name FROM users WHERE id = $1`,
                [req.user.id]
            );

            if (userResult.rows.length === 0) {
                return ApiResponse.error(res, 'Utilisateur non trouvé', 404);
            }

            const user = userResult.rows[0];

            // Generate and send new OTP
            const otpCode = await otpService.createOTP(req.user.id, 'login');
            await otpService.sendOTPEmail(user.email, otpCode, 'login', user.first_name);

            return ApiResponse.success(res, {
                message: `Nouveau code OTP envoyé à ${user.email}`,
            }, 'Code OTP renvoyé');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/refresh
     */
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const tokens = await authService.refreshToken(refreshToken);
            return ApiResponse.success(res, tokens, 'Token renouvelé');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/2fa/setup
     */
    async setup2FA(req, res, next) {
        try {
            const result = await authService.setup2FA(req.user.id);
            return ApiResponse.success(res, result, 'Configuration 2FA initiée');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/2fa/verify
     */
    async verify2FA(req, res, next) {
        try {
            const { code } = req.body;
            const result = await authService.verify2FA(req.user.id, code);
            return ApiResponse.success(res, result, '2FA activé avec succès');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/2fa/validate
     */
    async validate2FA(req, res, next) {
        try {
            const { code } = req.body;
            const result = await authService.validate2FA(req.user.id, code);
            return ApiResponse.success(res, result, 'Code 2FA vérifié');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/auth/profile
     */
    async getProfile(req, res, next) {
        try {
            const profile = await authService.getProfile(req.user.id);
            return ApiResponse.success(res, profile);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/auth/profile
     */
    async updateProfile(req, res, next) {
        try {
            const profile = await authService.updateProfile(req.user.id, req.body);
            return ApiResponse.success(res, profile, 'Profil mis à jour');
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
