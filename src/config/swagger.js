/**
 * Swagger/OpenAPI Configuration
 */
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: '🗳️ Voting App API',
            version: '1.0.0',
            description: `
## API de Vote Électronique Sécurisé

Cette API fournit un système de vote électronique complet avec :
- **Authentification multi-niveaux** (JWT + 2FA)
- **Chiffrement bout-en-bout** des votes (AES-256 + RSA)
- **Anonymat garanti** - aucun lien entre utilisateur et vote
- **Vérifiabilité** - chaque vote peut être vérifié via un reçu
- **Audit complet** sans compromettre l'anonymat

### Flow de Vote
1. \`POST /api/auth/login\` → Obtenir un JWT
2. \`POST /api/elections/{id}/request-vote-token\` → Obtenir un token de vote
3. \`POST /api/votes/submit\` → Soumettre le vote (avec X-Vote-Token header)
4. \`GET /api/votes/verify/{receiptCode}\` → Vérifier le vote
      `,
            contact: {
                name: 'API Support',
                email: 'support@votingapp.com',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT access token',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        errors: { type: 'array', items: { type: 'object' } },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: { type: 'object' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        currentPage: { type: 'integer' },
                        totalPages: { type: 'integer' },
                        totalItems: { type: 'integer' },
                        itemsPerPage: { type: 'integer' },
                    },
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Authentication & user management' },
            { name: 'Elections', description: 'Election management' },
            { name: 'Candidates', description: 'Candidate management' },
            { name: 'Voting', description: 'Vote submission & verification' },
        ],
    },
    apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = { swaggerUi, swaggerDocs };
