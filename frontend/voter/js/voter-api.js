/**
 * SecureVote — Voter API Client
 * Lightweight API service for the voter interface
 */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

class VoterApi {
    constructor() {
        this.accessToken = sessionStorage.getItem('sv_access');
        this.refreshToken = sessionStorage.getItem('sv_refresh');
        this.tempToken = sessionStorage.getItem('sv_temp');
    }

    _headers(useTempToken = false) {
        const token = useTempToken ? this.tempToken : this.accessToken;
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    async _request(method, endpoint, body = null, extraHeaders = {}, useTempToken = false) {
        const options = {
            method,
            headers: { ...this._headers(useTempToken), ...extraHeaders },
        };
        if (body) options.body = JSON.stringify(body);

        try {
            let res = await fetch(`${API_BASE}${endpoint}`, options);

            // Auto-refresh on 401
            if (res.status === 401 && !useTempToken && this.refreshToken) {
                try {
                    await this._refreshAccessToken();
                    options.headers = { ...this._headers(), ...extraHeaders };
                    res = await fetch(`${API_BASE}${endpoint}`, options);
                } catch {
                    this.logout();
                    throw { status: 401, message: 'Session expired' };
                }
            }

            const data = await res.json();
            if (!res.ok) throw { status: res.status, ...data };
            return data;
        } catch (err) {
            if (err.status) throw err;
            throw { message: 'Connection error' };
        }
    }

    // ========== AUTH ==========

    async login(email, password) {
        const data = await this._request('POST', '/api/auth/login', { email, password });
        const result = data.data;

        if (result.requiresOTP === false && result.tokens) {
            this._storeTokens(result.tokens);
            if (result.user) sessionStorage.setItem('sv_user', JSON.stringify(result.user));
            return { ...data, otpRequired: false };
        }

        this.tempToken = result.tempToken;
        sessionStorage.setItem('sv_temp', this.tempToken);
        return { ...data, otpRequired: true };
    }

    async verifyOTP(otpCode) {
        const data = await this._request('POST', '/api/auth/verify-otp', { otpCode }, {}, true);
        this._storeTokens(data.data.tokens);
        sessionStorage.removeItem('sv_temp');
        if (data.data.user) sessionStorage.setItem('sv_user', JSON.stringify(data.data.user));
        return data;
    }

    async resendOTP() {
        return this._request('POST', '/api/auth/resend-otp', null, {}, true);
    }

    async register(userData) {
        return this._request('POST', '/api/auth/register', userData);
    }

    async _refreshAccessToken() {
        const data = await this._request('POST', '/api/auth/refresh', { refreshToken: this.refreshToken });
        this.accessToken = data.data.accessToken;
        sessionStorage.setItem('sv_access', this.accessToken);
    }

    _storeTokens(tokens) {
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        sessionStorage.setItem('sv_access', this.accessToken);
        sessionStorage.setItem('sv_refresh', this.refreshToken);
        this.tempToken = null;
        sessionStorage.removeItem('sv_temp');
    }

    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tempToken = null;
        sessionStorage.removeItem('sv_access');
        sessionStorage.removeItem('sv_refresh');
        sessionStorage.removeItem('sv_temp');
        sessionStorage.removeItem('sv_user');
    }

    isLoggedIn() {
        return !!this.accessToken;
    }

    // ========== ELECTIONS ==========

    async getActiveElections() {
        return this._request('GET', '/api/elections?status=active');
    }

    async getElection(id) {
        return this._request('GET', `/api/elections/${id}`);
    }

    // ========== CANDIDATES ==========

    async getCandidates(electionId) {
        return this._request('GET', `/api/elections/${electionId}/candidates`);
    }

    // ========== VOTING ==========

    async requestVoteToken(electionId) {
        return this._request('POST', `/api/elections/${electionId}/request-vote-token`);
    }

    async submitVote(voteToken, candidateId) {
        return this._request('POST', '/api/votes/submit', {
            candidateId,
            confirmVote: true,
        }, {
            'X-Vote-Token': voteToken,
            'X-Device-Type': 'web',
        });
    }

    // ========== RESULTS ==========

    async getResults(electionId) {
        return this._request('GET', `/api/elections/${electionId}/results`);
    }
}

const voterApi = new VoterApi();
