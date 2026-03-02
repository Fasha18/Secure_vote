/**
 * Candidate Validators
 */
const Joi = require('joi');

const createCandidateSchema = Joi.object({
    fullName: Joi.string().min(2).max(255).required().messages({
        'any.required': 'Le nom complet est obligatoire',
    }),
    politicalParty: Joi.string().max(255).optional().allow('', null),
    slogan: Joi.string().max(500).optional().allow('', null),
    biography: Joi.string().max(5000).required().messages({
        'any.required': 'La biographie est obligatoire',
    }),
    programSummary: Joi.string().max(2000).optional().allow('', null),
    programDetails: Joi.string().max(10000).optional().allow('', null),
    websiteUrl: Joi.string().uri().max(500).optional().allow('', null),
    socialMedia: Joi.object({
        twitter: Joi.string().max(100).optional().allow('', null),
        facebook: Joi.string().max(200).optional().allow('', null),
        instagram: Joi.string().max(100).optional().allow('', null),
        linkedin: Joi.string().max(200).optional().allow('', null),
    }).optional(),
    displayOrder: Joi.number().integer().min(0).default(0),
});

const updateCandidateSchema = Joi.object({
    fullName: Joi.string().min(2).max(255).optional(),
    politicalParty: Joi.string().max(255).optional().allow('', null),
    slogan: Joi.string().max(500).optional().allow('', null),
    biography: Joi.string().max(5000).optional(),
    programSummary: Joi.string().max(2000).optional().allow('', null),
    programDetails: Joi.string().max(10000).optional().allow('', null),
    websiteUrl: Joi.string().uri().max(500).optional().allow('', null),
    socialMedia: Joi.object().optional(),
    displayOrder: Joi.number().integer().min(0).optional(),
});

module.exports = {
    createCandidateSchema,
    updateCandidateSchema,
};
