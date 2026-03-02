/**
 * Unit Tests - JWT Service
 */
process.env.JWT_ACCESS_SECRET = 'test_access_secret_long_enough_for_jwt_signing_1234567890';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_long_enough_for_jwt_signing_1234567890';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.HASH_SALT = 'test_salt';
process.env.VOTE_PROOF_SECRET = 'test_vote_proof_secret';

const jwtService = require('../../src/services/jwt.service');

describe('JWTService', () => {
    const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        role: 'voter',
    };

    describe('generateAccessToken', () => {
        it('should generate a valid JWT access token', () => {
            const token = jwtService.generateAccessToken(mockUser);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid JWT refresh token', () => {
            const token = jwtService.generateRefreshToken(mockUser);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.').length).toBe(3);
        });
    });

    describe('generateTokenPair', () => {
        it('should generate both access and refresh tokens', () => {
            const pair = jwtService.generateTokenPair(mockUser);
            expect(pair.accessToken).toBeDefined();
            expect(pair.refreshToken).toBeDefined();
            expect(pair.accessToken).not.toBe(pair.refreshToken);
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify and decode a valid access token', () => {
            const token = jwtService.generateAccessToken(mockUser);
            const decoded = jwtService.verifyAccessToken(token);

            expect(decoded.userId).toBe(mockUser.id);
            expect(decoded.email).toBe(mockUser.email);
            expect(decoded.role).toBe(mockUser.role);
            expect(decoded.type).toBe('access');
        });

        it('should throw on invalid token', () => {
            expect(() => {
                jwtService.verifyAccessToken('invalid.token.here');
            }).toThrow();
        });

        it('should throw on refresh token used as access token', () => {
            const refreshToken = jwtService.generateRefreshToken(mockUser);
            expect(() => {
                jwtService.verifyAccessToken(refreshToken);
            }).toThrow();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify and decode a valid refresh token', () => {
            const token = jwtService.generateRefreshToken(mockUser);
            const decoded = jwtService.verifyRefreshToken(token);

            expect(decoded.userId).toBe(mockUser.id);
            expect(decoded.type).toBe('refresh');
        });

        it('should throw on access token used as refresh token', () => {
            const accessToken = jwtService.generateAccessToken(mockUser);
            expect(() => {
                jwtService.verifyRefreshToken(accessToken);
            }).toThrow();
        });
    });

    describe('decode', () => {
        it('should decode without verification', () => {
            const token = jwtService.generateAccessToken(mockUser);
            const decoded = jwtService.decode(token);

            expect(decoded.userId).toBe(mockUser.id);
        });

        it('should return null for invalid token', () => {
            const decoded = jwtService.decode('not-a-jwt');
            expect(decoded).toBeNull();
        });
    });
});
