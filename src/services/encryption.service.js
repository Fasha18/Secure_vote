/**
 * Encryption Service
 * AES-256-GCM for data encryption, SHA-256 for hashing, HMAC for vote proofs
 * CRITICAL: This service handles all cryptographic operations
 */
const crypto = require('crypto');
const config = require('../config/app');
const logger = require('../utils/logger');

class EncryptionService {
    constructor() {
        this.algorithm = config.encryption.algorithm;
        this.secretKey = Buffer.from(config.encryption.key, 'hex');
        this.hashSalt = config.encryption.hashSalt;
        this.voteProofSecret = config.encryption.voteProofSecret;
    }

    /**
     * Encrypt sensitive data using AES-256-GCM
     * @param {string} text - Plaintext to encrypt
     * @returns {string} Encrypted data as iv:authTag:ciphertext (hex)
     */
    encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag();

            // Format: iv:authTag:ciphertext
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error) {
            logger.error('Encryption failed', { error: error.message });
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt data encrypted with AES-256-GCM
     * @param {string} encryptedData - iv:authTag:ciphertext (hex)
     * @returns {string} Decrypted plaintext
     */
    decrypt(encryptedData) {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];

            const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            logger.error('Decryption failed', { error: error.message });
            throw new Error('Decryption failed');
        }
    }

    /**
     * One-way hash for sensitive identifiers (nationalId, etc.)
     * @param {string} data - Data to hash
     * @param {string} salt - Additional salt (optional)
     * @returns {string} SHA-256 hex digest
     */
    hash(data, salt = '') {
        return crypto
            .createHash('sha256')
            .update(String(data) + salt + this.hashSalt)
            .digest('hex');
    }

    /**
     * Generate a cryptographic vote proof
     * @param {string} electionId
     * @param {string} candidateId
     * @param {string} timestamp
     * @returns {string} HMAC-SHA256 hex digest
     */
    generateVoteProof(electionId, candidateId, timestamp) {
        const randomSalt = crypto.randomBytes(32).toString('hex');
        const data = `${electionId}:${candidateId}:${timestamp}:${randomSalt}`;

        return crypto
            .createHmac('sha256', this.voteProofSecret)
            .update(data)
            .digest('hex');
    }

    /**
     * Generate a digital signature for vote verification
     * @param {string} voteProof
     * @param {string} timestamp
     * @returns {string} HMAC-SHA256 hex digest
     */
    generateVoteSignature(voteProof, timestamp) {
        return crypto
            .createHmac('sha256', this.voteProofSecret)
            .update(`${voteProof}:${timestamp}`)
            .digest('hex');
    }

    /**
     * Verify a vote signature
     * @param {string} voteProof
     * @param {string} timestamp
     * @param {string} signature
     * @returns {boolean}
     */
    verifyVoteSignature(voteProof, timestamp, signature) {
        const expectedSignature = this.generateVoteSignature(voteProof, timestamp);
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    /**
     * Generate a unique receipt code
     * @param {string} electionId
     * @returns {string} Human-readable receipt code
     */
    generateReceiptCode(electionId) {
        const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
        const prefix = electionId.substring(0, 8).toUpperCase();
        return `VOTE-${prefix}-${randomPart}`;
    }

    /**
     * Generate a cryptographically secure random token
     * @param {number} bytes
     * @returns {string} Hex token
     */
    generateToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }

    /**
     * Generate user ID hash for vote token (one-way mapping)
     * @param {string} userId
     * @param {string} electionId
     * @returns {string} SHA-256 hex digest
     */
    generateUserElectionHash(userId, electionId) {
        const secretSalt = crypto.randomBytes(16).toString('hex');
        return crypto
            .createHash('sha256')
            .update(`${userId}:${electionId}:${secretSalt}:${this.hashSalt}`)
            .digest('hex');
    }
}

module.exports = new EncryptionService();
