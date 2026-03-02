/**
 * Custom Error Classes
 * Standardized error handling across the application
 */

class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400);
        this.details = details;
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Non autorisé') {
        super(message, 401);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Accès interdit') {
        super(message, 403);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Ressource non trouvée') {
        super(message, 404);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflit de données') {
        super(message, 409);
    }
}

class UnprocessableError extends AppError {
    constructor(message = 'Requête non traitable') {
        super(message, 422);
    }
}

class TooManyRequestsError extends AppError {
    constructor(message = 'Trop de requêtes, veuillez réessayer plus tard') {
        super(message, 429);
    }
}

module.exports = {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableError,
    TooManyRequestsError,
};
