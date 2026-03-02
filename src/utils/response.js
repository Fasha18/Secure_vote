/**
 * Standardized API Response Helper
 */
class ApiResponse {
    /**
     * Success response
     */
    static success(res, data, message = 'Succès', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }

    /**
     * Created response (201)
     */
    static created(res, data, message = 'Ressource créée avec succès') {
        return res.status(201).json({
            success: true,
            message,
            data,
        });
    }

    /**
     * Error response
     */
    static error(res, message = 'Erreur serveur', statusCode = 500, errors = null) {
        const response = {
            success: false,
            message,
        };
        if (errors) {
            response.errors = errors;
        }
        return res.status(statusCode).json(response);
    }

    /**
     * Paginated response
     */
    static paginated(res, data, pagination, message = 'Succès') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination: {
                currentPage: pagination.page,
                totalPages: Math.ceil(pagination.total / pagination.limit),
                totalItems: pagination.total,
                itemsPerPage: pagination.limit,
            },
        });
    }

    /**
     * No content response (204)
     */
    static noContent(res) {
        return res.status(204).send();
    }
}

module.exports = ApiResponse;
