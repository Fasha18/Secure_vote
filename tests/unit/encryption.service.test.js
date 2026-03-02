/**
 * Unit Tests - Encryption Service
 */
const crypto = require('crypto');

// Mock environment before requiring the service
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.HASH_SALT = 'test_salt';
process.env.VOTE_PROOF_SECRET = 'test_vote_proof_secret';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const encryptionService = require('../../src/services/encryption.service');

describe('EncryptionService', () => {
    describe('encrypt / decrypt', () => {
        it('should encrypt and decrypt a string correctly', () => {
            const plaintext = 'Hello, this is sensitive vote data!';
            const encrypted = encryptionService.encrypt(plaintext);

            expect(encrypted).toBeDefined();
            expect(encrypted).not.toBe(plaintext);
            expect(encrypted.split(':').length).toBe(3);

            const decrypted = encryptionService.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertexts for same plaintext (random IV)', () => {
            const plaintext = 'Same data';
            const encrypted1 = encryptionService.encrypt(plaintext);
            const encrypted2 = encryptionService.encrypt(plaintext);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should fail to decrypt invalid data', () => {
            expect(() => {
                encryptionService.decrypt('invalid:data');
            }).toThrow();
        });

        it('should fail to decrypt tampered data', () => {
            const encrypted = encryptionService.encrypt('test data');
            const parts = encrypted.split(':');
            // Tamper with the ciphertext
            parts[2] = parts[2].replace(/[0-9a-f]/, 'x');
            expect(() => {
                encryptionService.decrypt(parts.join(':'));
            }).toThrow();
        });
    });

    describe('hash', () => {
        it('should produce consistent hashes for same input', () => {
            const hash1 = encryptionService.hash('test_data');
            const hash2 = encryptionService.hash('test_data');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', () => {
            const hash1 = encryptionService.hash('data1');
            const hash2 = encryptionService.hash('data2');
            expect(hash1).not.toBe(hash2);
        });

        it('should produce a 64-char hex string (SHA-256)', () => {
            const hash = encryptionService.hash('test');
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('generateVoteProof', () => {
        it('should generate a unique vote proof', () => {
            const proof1 = encryptionService.generateVoteProof('election1', 'candidate1', '2024-01-01');
            const proof2 = encryptionService.generateVoteProof('election1', 'candidate1', '2024-01-01');

            expect(proof1).toBeDefined();
            expect(proof2).toBeDefined();
            // Should be different due to random salt
            expect(proof1).not.toBe(proof2);
        });

        it('should return a 64-char hex string (HMAC-SHA256)', () => {
            const proof = encryptionService.generateVoteProof('e1', 'c1', '2024-01-01');
            expect(proof).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('generateVoteSignature / verifyVoteSignature', () => {
        it('should generate and verify a signature', () => {
            const voteProof = 'test_proof_hash';
            const timestamp = '2024-01-01T00:00:00Z';

            const signature = encryptionService.generateVoteSignature(voteProof, timestamp);
            expect(signature).toBeDefined();

            const isValid = encryptionService.verifyVoteSignature(voteProof, timestamp, signature);
            expect(isValid).toBe(true);
        });

        it('should reject an invalid signature', () => {
            const voteProof = 'test_proof_hash';
            const timestamp = '2024-01-01T00:00:00Z';

            const signature = encryptionService.generateVoteSignature(voteProof, timestamp);
            // Tamper with signature
            const badSignature = signature.replace(/[0-9a-f]/, '0');

            // If the tampered char was already '0', this might still pass
            // Use a definitely different signature
            const fakeSig = crypto.randomBytes(32).toString('hex');

            expect(() => {
                encryptionService.verifyVoteSignature(voteProof, timestamp, fakeSig);
            }).not.toThrow(); // It returns false, doesn't throw

            // Actually check the return value
            const isValid = encryptionService.verifyVoteSignature(voteProof, 'wrong_timestamp', signature);
            expect(isValid).toBe(false);
        });
    });

    describe('generateReceiptCode', () => {
        it('should generate a receipt code with VOTE- prefix', () => {
            const receipt = encryptionService.generateReceiptCode('12345678-abcd-1234-efgh-123456789012');
            expect(receipt).toMatch(/^VOTE-[A-Z0-9]+-[A-Z0-9]+$/);
        });

        it('should generate unique receipts', () => {
            const receipt1 = encryptionService.generateReceiptCode('election1');
            const receipt2 = encryptionService.generateReceiptCode('election1');
            expect(receipt1).not.toBe(receipt2);
        });
    });

    describe('generateToken', () => {
        it('should generate a hex token of correct length', () => {
            const token = encryptionService.generateToken(32);
            expect(token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should generate unique tokens', () => {
            const token1 = encryptionService.generateToken();
            const token2 = encryptionService.generateToken();
            expect(token1).not.toBe(token2);
        });
    });
});
