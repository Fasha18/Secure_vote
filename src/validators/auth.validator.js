/**
 * Authentication Validators
 * Input validation schemas using Joi
 */
const Joi = require('joi');

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])/;

const registerSchema = Joi.object({
    email: Joi.string().email().required().max(255).messages({
        'string.email': 'Format email invalide',
        'any.required': 'L\'email est obligatoire',
    }),
    phone: Joi.string().pattern(/^\+?[\d\s-]{8,15}$/).required().messages({
        'string.pattern.base': 'Format de téléphone invalide',
        'any.required': 'Le numéro de téléphone est obligatoire',
    }),
    password: Joi.string().min(8).max(128).pattern(passwordPattern).required().messages({
        'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
        'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
        'any.required': 'Le mot de passe est obligatoire',
    }),
    firstName: Joi.string().min(2).max(100).required().messages({
        'any.required': 'Le prénom est obligatoire',
    }),
    lastName: Joi.string().min(2).max(100).required().messages({
        'any.required': 'Le nom est obligatoire',
    }),
    nationalId: Joi.number().integer().positive().optional().messages({
        'number.base': 'Le numéro d\'identité nationale doit être un nombre',
        'number.integer': 'Le numéro d\'identité nationale doit être un entier',
    }),
    studentCard: Joi.number().integer().positive().optional().messages({
        'number.base': 'Le numéro de carte étudiante doit être un nombre',
        'number.integer': 'Le numéro de carte étudiante doit être un entier',
    }),
    acceptedTerms: Joi.boolean().valid(true).required().messages({
        'any.only': 'Vous devez accepter les conditions d\'utilisation',
        'any.required': 'L\'acceptation des conditions est obligatoire',
    }),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Format email invalide',
        'any.required': 'L\'email est obligatoire',
    }),
    password: Joi.string().required().messages({
        'any.required': 'Le mot de passe est obligatoire',
    }),
    deviceInfo: Joi.object().optional(),
});

const verify2FASchema = Joi.object({
    code: Joi.string().length(6).pattern(/^\d+$/).required().messages({
        'string.length': 'Le code 2FA doit contenir 6 chiffres',
        'string.pattern.base': 'Le code 2FA ne doit contenir que des chiffres',
        'any.required': 'Le code 2FA est obligatoire',
    }),
});

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Le refresh token est obligatoire',
    }),
});

const setup2FASchema = Joi.object({
    // No body required, just needs authenticated user
});

const confirm2FASchema = Joi.object({
    code: Joi.string().length(6).pattern(/^\d+$/).required().messages({
        'string.length': 'Le code 2FA doit contenir 6 chiffres',
        'any.required': 'Le code 2FA est obligatoire',
    }),
});

module.exports = {
    registerSchema,
    loginSchema,
    verify2FASchema,
    refreshTokenSchema,
    setup2FASchema,
    confirm2FASchema,
};
