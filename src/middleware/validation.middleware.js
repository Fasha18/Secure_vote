/**
 * Validation Middleware Factory
 * Validates request body, query, or params against Joi schemas
 */
const { ValidationError } = require('../utils/errors');

/**
 * Create a validation middleware for a given Joi schema
 * @param {object} schema - Joi validation schema
 * @param {string} source - 'body', 'query', or 'params'
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const data = req[source];

        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false,
        });

        if (error) {
            const details = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message,
            }));

            return next(new ValidationError('Données invalides', details));
        }

        // Replace request data with validated/sanitized values
        req[source] = value;
        next();
    };
};

module.exports = { validate };
