/**
 * Authentication Service
 * Handles registration, login, 2FA, OTP, and token management
 */
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { query, getClient } = require('../config/database');
const { cache } = require('../config/redis');
const jwtService = require('./jwt.service');
const encryptionService = require('./encryption.service');
const otpService = require('./otp.service');
const config = require('../config/app');
const logger = require('../utils/logger');
const {
    ValidationError,
    UnauthorizedError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} = require('../utils/errors');

class AuthService {
    /**
     * Register a new user
     */
    async register(userData, ipAddress = null, userAgent = null) {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Check if email already exists
            const existingEmail = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [userData.email.toLowerCase()]
            );
            if (existingEmail.rows.length > 0) {
                throw new ConflictError('Cet email est déjà utilisé');
            }

            // Check if phone already exists
            if (userData.phone) {
                const existingPhone = await client.query(
                    'SELECT id FROM users WHERE phone = $1',
                    [userData.phone]
                );
                if (existingPhone.rows.length > 0) {
                    throw new ConflictError('Ce numéro de téléphone est déjà utilisé');
                }
            }

            // Hash password
            const passwordHash = await bcrypt.hash(userData.password, config.security.bcryptRounds);

            // Hash national ID if provided (never store in plain text)
            let nationalIdHash = null;
            if (userData.nationalId) {
                nationalIdHash = encryptionService.hash(userData.nationalId);
            }

            // Hash student card if provided
            let studentCardHash = null;
            if (userData.studentCard) {
                studentCardHash = encryptionService.hash(userData.studentCard);
            }

            // Insert user
            logger.info('📝 Attempting to insert user into DB', { email: userData.email.toLowerCase() });

            const result = await client.query(
                `INSERT INTO users (email, phone, password_hash, first_name, last_name, national_id_hash, student_card_hash, role,
                                   nationality, student_id, employee_id, organization_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'voter', $8, $9, $10, $11)
         RETURNING id, email, phone, first_name, last_name, role, created_at,
                   nationality, student_id, employee_id, organization_name`,
                [
                    userData.email.toLowerCase(),
                    userData.phone,
                    passwordHash,
                    userData.firstName,
                    userData.lastName,
                    nationalIdHash,
                    studentCardHash,
                    userData.nationality || null,
                    userData.studentId || null,
                    userData.employeeId || null,
                    userData.organizationName || null,
                ]
            );

            const user = result.rows[0];
            logger.info('✅ User record created in DB', { userId: user.id });

            // Create user profile
            await client.query(
                `INSERT INTO user_profiles (user_id) VALUES ($1)`,
                [user.id]
            );
            logger.info('👤 User profile created in DB', { userId: user.id });

            // Generate tokens
            const tokens = jwtService.generateTokenPair({
                id: user.id,
                email: user.email,
                role: user.role,
            });

            // Audit log
            await client.query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
         VALUES ($1, 'register', 'user', $1, $2, $3, $4)`,
                [
                    user.id,
                    ipAddress,
                    userAgent,
                    JSON.stringify({ email: user.email }),
                ]
            );

            await client.query('COMMIT');

            logger.info('User registered successfully', { userId: user.id, email: user.email });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                },
                tokens,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Login user
     */
    async login(email, password, ipAddress = null, userAgent = null) {
        const normalizedEmail = email.trim().toLowerCase();

        logger.info('🔑 Login attempt started', { email: normalizedEmail });

        // Fetch user
        const result = await query(
            `SELECT id, email, password_hash, role, is_active, failed_login_attempts, locked_until, first_name, last_name
       FROM users WHERE email = $1`,
            [normalizedEmail]
        );

        logger.info('📊 Database lookup result', {
            found: result.rows.length > 0,
            email: normalizedEmail
        });

        if (result.rows.length === 0) {
            logger.warn('❌ User not found in database', { email: normalizedEmail });
            throw new UnauthorizedError('Email ou mot de passe incorrect');
        }

        const user = result.rows[0];

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMs = new Date(user.locked_until) - new Date();
            const remainingMin = Math.ceil(remainingMs / 60000);
            throw new ForbiddenError(
                `Compte temporairement verrouillé. Réessayez dans ${remainingMin} minute(s)`
            );
        }

        // Check if account is active
        if (!user.is_active) {
            throw new ForbiddenError('Compte désactivé. Contactez l\'administrateur');
        }

        // Verify password
        logger.info('🔍 Verifying password', {
            email: normalizedEmail,
            hasPasswordHash: !!user.password_hash,
            passwordLength: password?.length
        });

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        logger.info('🔐 Password verification result', {
            email: normalizedEmail,
            isValid: isPasswordValid
        });

        if (!isPasswordValid) {
            // Increment failed attempts
            const newAttempts = (user.failed_login_attempts || 0) + 1;
            let lockUntil = null;

            if (newAttempts >= config.security.maxLoginAttempts) {
                lockUntil = new Date(Date.now() + config.security.lockoutDuration);
                logger.warn('Account locked due to failed login attempts', {
                    userId: user.id,
                    attempts: newAttempts,
                });
            }

            await query(
                `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
                [newAttempts, lockUntil, user.id]
            );

            // Audit log
            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, details)
         VALUES ($1, 'login_failed', 'user', $1, $2, $3, $4)`,
                [user.id, ipAddress, userAgent, JSON.stringify({ attempts: newAttempts })]
            );

            throw new UnauthorizedError('Email ou mot de passe incorrect');
        }

        // Reset failed attempts on successful login
        await query(
            `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1`,
            [user.id]
        );

        // Check if 2FA is enabled
        const twoFAResult = await query(
            `SELECT enabled FROM two_factor_auth WHERE user_id = $1`,
            [user.id]
        );
        const requires2FA = twoFAResult.rows.length > 0 && twoFAResult.rows[0].enabled;

        // ── Bypass OTP pour les admins si SKIP_OTP_FOR_ADMIN=true ──────────────
        const skipOTP = process.env.SKIP_OTP_FOR_ADMIN === 'true' &&
            ['admin', 'super_admin'].includes(user.role);

        if (skipOTP) {
            // Connexion directe sans OTP pour les admins
            logger.warn('⚡ OTP bypassed for admin (SKIP_OTP_FOR_ADMIN=true)', {
                userId: user.id, email: user.email
            });

            const tokens = jwtService.generateTokenPair({
                id: user.id,
                email: user.email,
                role: user.role,
            });

            await query(
                `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
                 VALUES ($1, 'login_direct_admin', 'user', $1, $2, $3)`,
                [user.id, ipAddress, userAgent]
            );

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                },
                tokens,
                requiresOTP: false,
                message: 'Connexion admin réussie',
            };
        }

        // ── Envoi OTP par email ───────────────────────────────────────────────
        const otpCode = await otpService.createOTP(user.id, 'login');
        const emailSent = await otpService.sendOTPEmail(
            user.email,
            otpCode,
            'login',
            user.first_name
        );

        // Si l'email échoue et que c'est un admin → connexion directe
        if (!emailSent && ['admin', 'super_admin'].includes(user.role)) {
            logger.warn('📧 Email OTP failed for admin — granting direct access', {
                userId: user.id, email: user.email
            });

            const tokens = jwtService.generateTokenPair({
                id: user.id,
                email: user.email,
                role: user.role,
            });

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                },
                tokens,
                requiresOTP: false,
                message: 'Connexion admin réussie (email OTP non disponible)',
            };
        }

        // Generate a temporary token (short-lived, for OTP verification only)
        const tempToken = jwtService.generateAccessToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
             VALUES ($1, 'login_otp_sent', 'user', $1, $2, $3)`,
            [user.id, ipAddress, userAgent]
        );

        logger.info('Login OTP sent', { userId: user.id, email: user.email });

        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
            tempToken,
            requiresOTP: true,
            requires2FA,
            message: `Un code OTP a été envoyé à ${user.email}`,
        };
    }

    /**
     * Verify login OTP and return final JWT tokens
     */
    async verifyLoginOTP(userId, otpCode, ipAddress = null, userAgent = null) {
        // Verify OTP
        const result = await otpService.verifyOTP(userId, otpCode, 'login');

        if (!result.valid) {
            throw new UnauthorizedError(result.message);
        }

        // Get user info
        const userResult = await query(
            `SELECT id, email, role, first_name, last_name FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new UnauthorizedError('Utilisateur non trouvé');
        }

        const user = userResult.rows[0];

        // Generate final JWT tokens
        const tokens = jwtService.generateTokenPair({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        // Audit log
        await query(
            `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, 'login_otp_verified', 'user', $1, $2, $3)`,
            [user.id, ipAddress, userAgent]
        );

        logger.info('Login OTP verified, tokens issued', { userId: user.id });

        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
            },
            tokens,
        };
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        const decoded = jwtService.verifyRefreshToken(refreshToken);

        // Verify user still exists and is active
        const result = await query(
            `SELECT id, email, role, is_active FROM users WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            throw new UnauthorizedError('Utilisateur non trouvé');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            throw new ForbiddenError('Compte désactivé');
        }

        // Generate new tokens (token rotation)
        const tokens = jwtService.generateTokenPair({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return tokens;
    }

    /**
     * Setup 2FA for user
     */
    async setup2FA(userId) {
        // Generate TOTP secret
        const secret = speakeasy.generateSecret({
            name: `VotingApp (${userId})`,
            issuer: 'VotingApp',
            length: 20,
        });

        // Store secret (not yet enabled)
        await query(
            `INSERT INTO two_factor_auth (user_id, secret, enabled)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET secret = $2, enabled = FALSE`,
            [userId, secret.base32]
        );

        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        return {
            secret: secret.base32,
            qrCode: qrCodeUrl,
        };
    }

    /**
     * Verify and enable 2FA
     */
    async verify2FA(userId, code) {
        const result = await query(
            `SELECT secret FROM two_factor_auth WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('2FA non configuré. Veuillez d\'abord configurer la 2FA');
        }

        const { secret } = result.rows[0];

        const isValid = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 1, // Allow ±30 seconds
        });

        if (!isValid) {
            throw new UnauthorizedError('Code 2FA invalide');
        }

        // Enable 2FA
        await query(
            `UPDATE two_factor_auth SET enabled = TRUE WHERE user_id = $1`,
            [userId]
        );

        // Generate backup codes
        const backupCodes = Array.from({ length: 8 }, () =>
            encryptionService.generateToken(4).toUpperCase()
        );
        const hashedBackupCodes = backupCodes.map((code) => encryptionService.hash(code));

        await query(
            `UPDATE two_factor_auth SET backup_codes = $1 WHERE user_id = $2`,
            [JSON.stringify(hashedBackupCodes), userId]
        );

        logger.info('2FA enabled for user', { userId });

        return {
            enabled: true,
            backupCodes, // Show once only
        };
    }

    /**
     * Validate 2FA code (for login flow)
     */
    async validate2FA(userId, code) {
        const result = await query(
            `SELECT secret, enabled FROM two_factor_auth WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0 || !result.rows[0].enabled) {
            throw new NotFoundError('2FA non activé');
        }

        const { secret } = result.rows[0];

        const isValid = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: 1,
        });

        if (!isValid) {
            throw new UnauthorizedError('Code 2FA invalide');
        }

        return { verified: true };
    }

    /**
     * Get user profile
     */
    async getProfile(userId) {
        const result = await query(
            `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role,
              u.email_verified, u.phone_verified, u.created_at, u.last_login_at,
              u.nationality, u.student_id, u.employee_id, u.organization_name, u.is_active_member,
              p.avatar_url, p.bio, p.date_of_birth, p.gender, p.city, p.country,
              p.language_preference, p.notification_preferences,
              COALESCE(t.enabled, FALSE) as two_factor_enabled
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN two_factor_auth t ON t.user_id = u.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw new NotFoundError('Utilisateur non trouvé');
        }

        const user = result.rows[0];

        return {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            emailVerified: user.email_verified,
            phoneVerified: user.phone_verified,
            twoFactorEnabled: user.two_factor_enabled,
            nationality: user.nationality,
            studentId: user.student_id,
            employeeId: user.employee_id,
            organizationName: user.organization_name,
            isActiveMember: user.is_active_member,
            profile: {
                avatarUrl: user.avatar_url,
                bio: user.bio,
                dateOfBirth: user.date_of_birth,
                gender: user.gender,
                city: user.city,
                country: user.country,
                languagePreference: user.language_preference,
                notificationPreferences: user.notification_preferences,
            },
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at,
        };
    }

    async updateProfile(userId, profileData) {
        if (!profileData) {
            throw new ValidationError('Données de profil manquantes');
        }

        const client = await getClient();
        try {
            await client.query('BEGIN');

            const usersFields = [
                'firstName', 'lastName', 'phone', 'nationality',
                'studentId', 'employeeId', 'organizationName'
            ];
            const profilesFields = [
                'bio', 'dateOfBirth', 'gender', 'city', 'country', 'languagePreference'
            ];

            // 1. Update users table
            const userUpdates = [];
            const userValues = [];
            let uIdx = 1;

            for (const field of usersFields) {
                if (profileData[field] !== undefined) {
                    const snakeCase = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    userUpdates.push(`${snakeCase} = $${uIdx}`);
                    userValues.push(profileData[field]);
                    uIdx++;
                }
            }

            if (userUpdates.length > 0) {
                userValues.push(userId);
                await client.query(
                    `UPDATE users SET ${userUpdates.join(', ')}, updated_at = NOW() WHERE id = $${uIdx}`,
                    userValues
                );
            }

            // 2. Update user_profiles table
            const profileUpdates = [];
            const profileValues = [];
            let pIdx = 1;

            for (const field of profilesFields) {
                if (profileData[field] !== undefined) {
                    const snakeCase = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                    profileUpdates.push(`${snakeCase} = $${pIdx}`);
                    profileValues.push(profileData[field]);
                    pIdx++;
                }
            }

            if (profileUpdates.length > 0) {
                profileValues.push(userId);
                await client.query(
                    `UPDATE user_profiles SET ${profileUpdates.join(', ')}, updated_at = NOW() WHERE user_id = $${pIdx}`,
                    profileValues
                );
            }

            if (userUpdates.length === 0 && profileUpdates.length === 0) {
                throw new ValidationError('Aucun champ à mettre à jour');
            }

            await client.query('COMMIT');
            return this.getProfile(userId);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new AuthService();
