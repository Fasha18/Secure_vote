/**
 * Vote Validators
 */
const Joi = require('joi');

const requestVoteTokenSchema = Joi.object({
    nationalId: Joi.number().integer().positive().optional(),
    studentCard: Joi.number().integer().positive().optional(),
    twoFactorCode: Joi.string().length(6).pattern(/^\d+$/).optional(),
});

const submitVoteSchema = Joi.object({
    candidateId: Joi.string().uuid().required().messages({
        'string.guid': 'ID de candidat invalide',
        'any.required': 'L\'ID du candidat est obligatoire',
    }),
    confirmVote: Joi.boolean().valid(true).required().messages({
        'any.only': 'Vous devez confirmer votre vote',
        'any.required': 'La confirmation du vote est obligatoire',
    }),
});

const verifyVoteSchema = Joi.object({
    receiptCode: Joi.string().pattern(/^VOTE-[A-Z0-9]+-[A-Z0-9]+$/).required().messages({
        'string.pattern.base': 'Format de code de reçu invalide',
        'any.required': 'Le code de reçu est obligatoire',
    }),
});

module.exports = {
    requestVoteTokenSchema,
    submitVoteSchema,
    verifyVoteSchema,
};
