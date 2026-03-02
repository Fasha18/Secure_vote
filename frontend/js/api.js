/**
 * SecureVote API Service
 * Handles all communication with the backend
 */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;

class ApiService {
    constructor() {
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
        this.tempToken = localStorage.getItem('tempToken');
    }

    getAuthHeaders(useTempToken = false) {
        const token = useTempToken ? this.tempToken : this.accessToken;
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
    }

    async request(method, endpoint, body = null, useTempToken = false) {
        const options = {
            method,
            headers: this.getAuthHeaders(useTempToken),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            let response = await fetch(`${API_BASE}${endpoint}`, options);

            // Handle token expiration
            if (response.status === 401 && !useTempToken && this.refreshToken) {
                try {
                    await this.refreshAccessToken();
                    options.headers = this.getAuthHeaders(); // Get fresh headers
                    response = await fetch(`${API_BASE}${endpoint}`, options);
                } catch (refreshErr) {
                    this.logout();
                    window.location.reload();
                    return;
                }
            }

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (err) {
            if (err.status) throw err;
            throw { message: "Erreur de connexion au serveur" };
        }
    }

    // ---------- AUTH ----------
    async login(email, password) {
        const data = await this.request('POST', '/api/auth/login', { email, password });
        const result = data.data;

        if (result.requiresOTP === false && result.tokens) {
            // Connexion directe (admin sans OTP ou SMTP en echec)
            this.accessToken = result.tokens.accessToken;
            this.refreshToken = result.tokens.refreshToken;
            localStorage.setItem('accessToken', this.accessToken);
            localStorage.setItem('refreshToken', this.refreshToken);
            localStorage.removeItem('tempToken');
            if (result.user) localStorage.setItem('user', JSON.stringify(result.user));
        } else {
            // Flux normal : stocker le tempToken pour verification OTP
            this.tempToken = result.tempToken;
            localStorage.setItem('tempToken', this.tempToken);
        }

        return data;
    }

    async verifyOTP(otpCode) {
        const data = await this.request('POST', '/api/auth/verify-otp', { otpCode }, true);
        this.accessToken = data.data.tokens.accessToken;
        this.refreshToken = data.data.tokens.refreshToken;
        localStorage.setItem('accessToken', this.accessToken);
        localStorage.setItem('refreshToken', this.refreshToken);
        localStorage.removeItem('tempToken');
        return data;
    }

    async resendOTP() {
        return this.request('POST', '/api/auth/resend-otp', null, true);
    }

    async register(userData) {
        return this.request('POST', '/api/auth/register', userData);
    }

    async getProfile() {
        return this.request('GET', '/api/auth/profile');
    }

    async updateProfile(data) {
        return this.request('PUT', '/api/auth/profile', data);
    }

    async refreshAccessToken() {
        const data = await this.request('POST', '/api/auth/refresh', { refreshToken: this.refreshToken });
        this.accessToken = data.data.accessToken;
        localStorage.setItem('accessToken', this.accessToken);
        return data;
    }

    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tempToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tempToken');
        localStorage.removeItem('user');
    }

    isLoggedIn() {
        return !!this.accessToken;
    }

    // ---------- USERS ----------
    async getUsers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/api/users${query ? '?' + query : ''}`);
    }

    async getUser(userId) {
        return this.request('GET', `/api/users/${userId}`);
    }

    async getStats() {
        return this.request('GET', '/api/users/stats');
    }

    async updateUserRole(userId, role) {
        return this.request('PATCH', `/api/users/${userId}/role`, { role });
    }

    async toggleUserActive(userId) {
        return this.request('PATCH', `/api/users/${userId}/toggle-active`);
    }

    async deleteUser(userId) {
        return this.request('DELETE', `/api/users/${userId}`);
    }

    // ---------- ELECTIONS ----------
    async getElections(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/api/elections${query ? '?' + query : ''}`);
    }

    async getElection(id) {
        return this.request('GET', `/api/elections/${id}`);
    }

    async createElection(data) {
        return this.request('POST', '/api/elections', data);
    }

    async updateElection(id, data) {
        return this.request('PUT', `/api/elections/${id}`, data);
    }

    async deleteElection(id) {
        return this.request('DELETE', `/api/elections/${id}`);
    }

    async changeElectionStatus(id, status) {
        return this.request('PATCH', `/api/elections/${id}/status`, { status });
    }

    // ---------- CANDIDATES ----------
    async getCandidates(electionId) {
        return this.request('GET', `/api/elections/${electionId}/candidates`);
    }

    async createCandidate(electionId, data) {
        return this.request('POST', `/api/elections/${electionId}/candidates`, data);
    }

    async updateCandidate(candidateId, data) {
        return this.request('PUT', `/api/candidates/${candidateId}`, data);
    }

    async deleteCandidate(candidateId) {
        return this.request('DELETE', `/api/candidates/${candidateId}`);
    }

    // ---------- RESULTS ----------
    async getResults(electionId) {
        return this.request('GET', `/api/elections/${electionId}/results`);
    }

    // ---------- HEALTH ----------
    async getHealth() {
        return this.request('GET', '/health');
    }
}

const api = new ApiService();
