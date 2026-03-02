/**
 * Unit Tests - Validators
 */
const { registerSchema, loginSchema, verify2FASchema } = require('../../src/validators/auth.validator');
const { createElectionSchema } = require('../../src/validators/election.validator');
const { submitVoteSchema } = require('../../src/validators/vote.validator');

describe('Auth Validators', () => {
    describe('registerSchema', () => {
        const validData = {
            email: 'user@example.com',
            phone: '+221771234567',
            password: 'SecureP@ss1',
            firstName: 'John',
            lastName: 'Doe',
            acceptedTerms: true,
        };

        it('should validate correct registration data', () => {
            const { error } = registerSchema.validate(validData);
            expect(error).toBeUndefined();
        });

        it('should reject missing email', () => {
            const { error } = registerSchema.validate({ ...validData, email: undefined });
            expect(error).toBeDefined();
        });

        it('should reject invalid email', () => {
            const { error } = registerSchema.validate({ ...validData, email: 'notanemail' });
            expect(error).toBeDefined();
        });

        it('should reject weak password (no special char)', () => {
            const { error } = registerSchema.validate({ ...validData, password: 'Weakpass1' });
            expect(error).toBeDefined();
        });

        it('should reject short password', () => {
            const { error } = registerSchema.validate({ ...validData, password: 'Sh@1' });
            expect(error).toBeDefined();
        });

        it('should reject unaccepted terms', () => {
            const { error } = registerSchema.validate({ ...validData, acceptedTerms: false });
            expect(error).toBeDefined();
        });

        it('should reject invalid phone format', () => {
            const { error } = registerSchema.validate({ ...validData, phone: '123' });
            expect(error).toBeDefined();
        });
    });

    describe('loginSchema', () => {
        it('should validate correct login data', () => {
            const { error } = loginSchema.validate({ email: 'user@example.com', password: 'pass' });
            expect(error).toBeUndefined();
        });

        it('should reject missing password', () => {
            const { error } = loginSchema.validate({ email: 'user@example.com' });
            expect(error).toBeDefined();
        });
    });

    describe('verify2FASchema', () => {
        it('should validate correct 2FA code', () => {
            const { error } = verify2FASchema.validate({ code: '123456' });
            expect(error).toBeUndefined();
        });

        it('should reject non-numeric code', () => {
            const { error } = verify2FASchema.validate({ code: 'abcdef' });
            expect(error).toBeDefined();
        });

        it('should reject wrong length', () => {
            const { error } = verify2FASchema.validate({ code: '12345' });
            expect(error).toBeDefined();
        });
    });
});

describe('Election Validators', () => {
    describe('createElectionSchema', () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const laterDate = new Date(Date.now() + 172800000).toISOString();

        const validElection = {
            title: 'Élection Présidentielle 2024',
            description: 'Élection du président de la République',
            type: 'presidential',
            startDate: futureDate,
            endDate: laterDate,
        };

        it('should validate correct election data', () => {
            const { error } = createElectionSchema.validate(validElection);
            expect(error).toBeUndefined();
        });

        it('should reject missing title', () => {
            const { error } = createElectionSchema.validate({ ...validElection, title: undefined });
            expect(error).toBeDefined();
        });

        it('should reject invalid type', () => {
            const { error } = createElectionSchema.validate({ ...validElection, type: 'invalid' });
            expect(error).toBeDefined();
        });

        it('should reject endDate before startDate', () => {
            const { error } = createElectionSchema.validate({
                ...validElection,
                endDate: validElection.startDate,
                startDate: validElection.endDate,
            });
            // endDate must be greater than startDate
            expect(error).toBeDefined();
        });
    });
});

describe('Vote Validators', () => {
    describe('submitVoteSchema', () => {
        it('should validate correct vote data', () => {
            const { error } = submitVoteSchema.validate({
                candidateId: '550e8400-e29b-41d4-a716-446655440000',
                confirmVote: true,
            });
            expect(error).toBeUndefined();
        });

        it('should reject missing candidateId', () => {
            const { error } = submitVoteSchema.validate({ confirmVote: true });
            expect(error).toBeDefined();
        });

        it('should reject confirmVote = false', () => {
            const { error } = submitVoteSchema.validate({
                candidateId: '550e8400-e29b-41d4-a716-446655440000',
                confirmVote: false,
            });
            expect(error).toBeDefined();
        });

        it('should reject invalid UUID', () => {
            const { error } = submitVoteSchema.validate({
                candidateId: 'not-a-uuid',
                confirmVote: true,
            });
            expect(error).toBeDefined();
        });
    });
});
