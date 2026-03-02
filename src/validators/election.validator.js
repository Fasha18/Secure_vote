/**
 * Election Validators
 */
const Joi = require('joi');

const electionTypes = ['presidential', 'legislative', 'local', 'referendum', 'amicale', 'university', 'corporate'];
const electionStatuses = ['draft', 'scheduled', 'active', 'closed', 'cancelled'];
const visibilityOptions = ['public', 'private', 'restricted'];

const createElectionSchema = Joi.object({
    title: Joi.string().min(3).max(255).required().messages({
        'any.required': 'Le titre est obligatoire',
        'string.min': 'Le titre doit contenir au moins 3 caractères',
    }),
    description: Joi.string().max(5000).required().messages({
        'any.required': 'La description est obligatoire',
    }),
    // Accepter n'importe quel type d'élection (personnalisé ou prédéfini)
    type: Joi.string().valid(...electionTypes).required().messages({
        'any.only': 'Type d\'élection invalide',
        'any.required': 'Le type est obligatoire',
    }),
    visibility: Joi.string().valid(...visibilityOptions).default('public'),
    startDate: Joi.date().iso().min('now').required().messages({
        'date.min': 'La date de début ne peut pas être dans le passé',
        'any.required': 'La date de début est obligatoire',
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
        'date.min': 'La date de fin doit être après la date de début',
        'any.required': 'La date de fin est obligatoire',
    }),
    resultsReleaseDate: Joi.date().iso().min(Joi.ref('endDate')).optional(),
    requiresNationalId: Joi.boolean().default(false),
    requiresStudentCard: Joi.boolean().default(false),
    requires2FA: Joi.boolean().default(false),
    allowAbstention: Joi.boolean().default(true),
    maxVotesPerUser: Joi.number().integer().min(1).max(10).default(1),
    organizationName: Joi.string().max(255).optional(),
    eligibilityCriteria: Joi.object({
        minAge: Joi.number().integer().min(0).max(150).optional(),
        maxAge: Joi.number().integer().min(0).max(150).optional(),
        nationality: Joi.string().max(10).optional(),
        region: Joi.string().max(100).optional(),
        organization: Joi.string().max(255).optional(),
    }).optional(),
    showResultsRealtime: Joi.boolean().default(true),
    allowVoteVerification: Joi.boolean().default(true),
    resultsSettings: Joi.object({
        showDuringVoting: Joi.boolean().default(true),
        showOnlyAfterClosing: Joi.boolean().default(false),
        showByRegion: Joi.boolean().default(true),
        showNationalOnly: Joi.boolean().default(false),
        showPercentages: Joi.boolean().default(true)
    }).default(),
});

const updateElectionSchema = Joi.object({
    title: Joi.string().min(3).max(255).optional(),
    description: Joi.string().max(5000).optional(),
    type: Joi.string().valid(...electionTypes).optional(),
    visibility: Joi.string().valid(...visibilityOptions).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    resultsReleaseDate: Joi.date().iso().optional(),
    requiresNationalId: Joi.boolean().optional(),
    requiresStudentCard: Joi.boolean().optional(),
    requires2FA: Joi.boolean().optional(),
    allowAbstention: Joi.boolean().optional(),
    maxVotesPerUser: Joi.number().integer().min(1).max(10).optional(),
    organizationName: Joi.string().max(255).optional(),
    eligibilityCriteria: Joi.object().optional(),
    showResultsRealtime: Joi.boolean().optional(),
    allowVoteVerification: Joi.boolean().optional(),
    resultsSettings: Joi.object({
        showDuringVoting: Joi.boolean(),
        showOnlyAfterClosing: Joi.boolean(),
        showByRegion: Joi.boolean(),
        showNationalOnly: Joi.boolean(),
        showPercentages: Joi.boolean()
    }).optional(),
});

const electionQuerySchema = Joi.object({
    type: Joi.string().valid(...electionTypes).optional(),
    status: Joi.string().valid(...electionStatuses).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('start_date', '-start_date', 'title', '-title', 'created_at', '-created_at').default('-created_at'),
    search: Joi.string().max(200).optional(),
});

module.exports = {
    createElectionSchema,
    updateElectionSchema,
    electionQuerySchema,
    electionTypes,
    electionStatuses,
};
