/**
 * OTP Service
 * Generates, stores, verifies OTP codes and sends them via email
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { query } = require('../config/database');
const logger = require('../utils/logger');

class OTPService {
    constructor() {
        this.otpLength = 6;
        this.otpExpiryMinutes = 10; // OTP valid for 10 minutes
        this.maxAttempts = 5; // Max verification attempts

        // Configure email transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    /**
     * Generate a random numeric OTP code
     * @returns {string} 6-digit OTP
     */
    generateOTP() {
        // Generate cryptographically secure random number
        const min = Math.pow(10, this.otpLength - 1);
        const max = Math.pow(10, this.otpLength) - 1;
        const otp = crypto.randomInt(min, max + 1);
        return otp.toString();
    }

    /**
     * Create and store an OTP for a user
     * @param {string} userId
     * @param {string} purpose - 'login' | 'register' | 'password_reset'
     * @returns {string} The generated OTP code
     */
    async createOTP(userId, purpose = 'login') {
        const code = this.generateOTP();
        const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

        // Hash the OTP before storing (security)
        const hashedCode = crypto
            .createHash('sha256')
            .update(code)
            .digest('hex');

        // Invalidate any existing OTP for this user + purpose
        await query(
            `UPDATE otp_codes SET is_used = TRUE 
             WHERE user_id = $1 AND purpose = $2 AND is_used = FALSE`,
            [userId, purpose]
        );

        // Store the new OTP
        await query(
            `INSERT INTO otp_codes (user_id, code_hash, purpose, expires_at, attempts)
             VALUES ($1, $2, $3, $4, 0)`,
            [userId, hashedCode, purpose, expiresAt]
        );

        logger.info('OTP created', { userId, purpose, expiresAt });
        return code;
    }

    /**
     * Verify an OTP code
     * @param {string} userId
     * @param {string} code - The OTP entered by the user
     * @param {string} purpose
     * @returns {{ valid: boolean, message: string }}
     */
    async verifyOTP(userId, code, purpose = 'login') {
        const hashedCode = crypto
            .createHash('sha256')
            .update(code)
            .digest('hex');

        // Find matching OTP
        const result = await query(
            `SELECT id, code_hash, expires_at, attempts, is_used
             FROM otp_codes
             WHERE user_id = $1 AND purpose = $2 AND is_used = FALSE
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId, purpose]
        );

        if (result.rows.length === 0) {
            return { valid: false, message: 'Aucun code OTP en attente. Demandez un nouveau code.' };
        }

        const otp = result.rows[0];

        // Check if expired
        if (new Date() > new Date(otp.expires_at)) {
            await query(
                `UPDATE otp_codes SET is_used = TRUE WHERE id = $1`,
                [otp.id]
            );
            return { valid: false, message: 'Code OTP expiré. Demandez un nouveau code.' };
        }

        // Check max attempts
        if (otp.attempts >= this.maxAttempts) {
            await query(
                `UPDATE otp_codes SET is_used = TRUE WHERE id = $1`,
                [otp.id]
            );
            return { valid: false, message: 'Trop de tentatives. Demandez un nouveau code.' };
        }

        // Increment attempts
        await query(
            `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`,
            [otp.id]
        );

        // Compare hashes
        if (otp.code_hash !== hashedCode) {
            const remaining = this.maxAttempts - otp.attempts - 1;
            return {
                valid: false,
                message: `Code OTP incorrect. ${remaining} tentative(s) restante(s).`
            };
        }

        // Mark as used
        await query(
            `UPDATE otp_codes SET is_used = TRUE, used_at = NOW() WHERE id = $1`,
            [otp.id]
        );

        logger.info('OTP verified successfully', { userId, purpose });
        return { valid: true, message: 'Code OTP vérifié avec succès.' };
    }

    /**
     * Send OTP via email
     * @param {string} email
     * @param {string} code
     * @param {string} purpose
     * @param {string} userName
     */
    async sendOTPEmail(email, code, purpose, userName = '') {
        const purposeLabels = {
            login: 'Connexion',
            register: 'Inscription',
            password_reset: 'Réinitialisation de mot de passe',
        };

        const purposeLabel = purposeLabels[purpose] || purpose;

        const mailOptions = {
            from: `"🗳️ Vote Électronique" <${process.env.SMTP_USER || 'noreply@votingapp.com'}>`,
            to: email,
            subject: `🔐 Code de vérification - ${purposeLabel}`,
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px;">
                    <div style="background: white; border-radius: 12px; padding: 40px; text-align: center;">
                        <h1 style="color: #1a1a2e; margin: 0 0 10px;">🗳️ Vote Électronique</h1>
                        <p style="color: #666; font-size: 14px; margin: 0 0 30px;">Système de vote sécurisé</p>
                        
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                            <p style="color: #333; margin: 0 0 5px; font-size: 14px;">
                                ${userName ? `Bonjour <strong>${userName}</strong>,` : 'Bonjour,'}
                            </p>
                            <p style="color: #666; font-size: 13px; margin: 0;">
                                Votre code de vérification pour <strong>${purposeLabel}</strong> :
                            </p>
                        </div>

                        <div style="background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; padding: 25px; margin: 25px 0;">
                            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: white; font-family: 'Courier New', monospace;">
                                ${code}
                            </span>
                        </div>

                        <p style="color: #e74c3c; font-size: 13px; margin: 15px 0;">
                            ⏰ Ce code expire dans <strong>${this.otpExpiryMinutes} minutes</strong>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                        
                        <p style="color: #999; font-size: 11px; margin: 0;">
                            🔒 Si vous n'avez pas demandé ce code, ignorez cet email.<br>
                            Ne partagez jamais votre code avec personne.
                        </p>
                    </div>
                </div>
            `,
            text: `Votre code de vérification pour ${purposeLabel} est : ${code}. Ce code expire dans ${this.otpExpiryMinutes} minutes.`,
        };

        try {
            await this.transporter.sendMail(mailOptions);
            logger.info('OTP email sent', { email, purpose });
            return true;
        } catch (error) {
            logger.error('Failed to send OTP email', {
                email,
                purpose,
                error: error.message
            });
            // Don't throw - log the OTP for development fallback
            if (process.env.NODE_ENV === 'development') {
                logger.warn(`📧 DEV MODE - OTP code for ${email}: ${code}`);
            }
            return false;
        }
    }
}

module.exports = new OTPService();
