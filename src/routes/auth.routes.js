/**
 * Authentication Routes
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & user management
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const { loginLimiter, registerLimiter } = require('../middleware/ratelimit.middleware');
const {
    registerSchema,
    loginSchema,
    verify2FASchema,
    refreshTokenSchema,
} = require('../validators/auth.validator');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, password, firstName, lastName, acceptedTerms]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 example: "+221771234567"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "SecureP@ss1"
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               nationalId:
 *                 type: integer
 *                 example: 1234567890
 *               studentCard:
 *                 type: integer
 *                 example: 20240001
 *               acceptedTerms:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or phone already in use
 */
router.post(
    '/register',
    registerLimiter,
    validate(registerSchema),
    authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
router.post(
    '/login',
    loginLimiter,
    validate(loginSchema),
    authController.login
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP code to complete login
 *     description: After login, verify the OTP sent to email to receive JWT tokens
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otpCode]
 *             properties:
 *               otpCode:
 *                 type: string
 *                 example: "123456"
 *                 description: 6-digit OTP code received by email
 *     responses:
 *       200:
 *         description: OTP verified, JWT tokens returned
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', authenticate, authController.verifyLoginOTP);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP code
 *     description: Request a new OTP code via email
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New OTP sent
 */
router.post('/resend-otp', authenticate, authController.resendOTP);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Invalid refresh token
 */
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authController.refreshToken
);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     summary: Setup 2FA (generate QR code)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup initiated
 */
router.post('/2fa/setup', authenticate, authController.setup2FA);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify and enable 2FA
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA enabled
 */
router.post(
    '/2fa/verify',
    authenticate,
    validate(verify2FASchema),
    authController.verify2FA
);

/**
 * @swagger
 * /api/auth/2fa/validate:
 *   post:
 *     summary: Validate 2FA code during login
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA code validated
 */
router.post(
    '/2fa/validate',
    authenticate,
    validate(verify2FASchema),
    authController.validate2FA
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
