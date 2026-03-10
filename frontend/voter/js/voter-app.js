/**
 * SecureVote — Voter App Controller
 * Screen navigation, i18n, and UI logic
 */

// ============================================
// INTERNATIONALIZATION
// ============================================
const i18n = {
    en: {
        welcome_title: 'Your Vote Matters',
        welcome_subtitle: 'Secure, simple, and transparent digital voting',
        start_voting: 'Start Voting',
        welcome_footer: 'Your vote is anonymous and encrypted',
        login_title: 'Sign In',
        login_desc: 'Enter your credentials to vote',
        email_label: 'Email',
        password_label: 'Password',
        sign_in: 'Sign In',
        no_account: 'No account?',
        register_link: 'Register',
        has_account: 'Already have an account?',
        login_link: 'Sign In',
        register_title: 'Create Account',
        register_desc: 'Register to participate in elections',
        firstname_label: 'First Name',
        lastname_label: 'Last Name',
        phone_label: 'Phone',
        accept_terms: 'I accept the terms of use',
        register_btn: 'Create Account',
        otp_title: 'Verification',
        otp_desc: 'Enter the 6-digit code sent to your email',
        verify_btn: 'Verify Code',
        resend_otp: 'Resend code',
        elections_title: 'Choose an Election',
        elections_desc: 'Select the election you want to vote in',
        no_elections: 'No active elections at the moment',
        loading: 'Loading...',
        candidates_desc: 'Tap a candidate to select',
        continue_btn: 'Continue',
        confirm_title: 'Confirm Your Vote',
        confirm_desc: 'Please review your selection',
        confirm_warning: 'This action cannot be undone',
        confirm_vote_btn: 'Confirm Vote',
        success_title: 'Vote Recorded!',
        success_desc: 'Your vote has been securely recorded',
        receipt_label: 'Receipt Code',
        receipt_hint: 'Save this code to verify your vote later',
        done_btn: 'Done',
        err_connection: 'Connection error. Please try again.',
        err_invalid_creds: 'Invalid email or password',
        err_already_voted: 'You have already voted in this election',
        err_election_not_active: 'This election is not currently active',
        toast_otp_resent: 'A new code has been sent',
        toast_registered: 'Account created! Please sign in.',
    },
    fr: {
        welcome_title: 'Votre Vote Compte',
        welcome_subtitle: 'Vote numérique sécurisé, simple et transparent',
        start_voting: 'Commencer à Voter',
        welcome_footer: 'Votre vote est anonyme et chiffré',
        login_title: 'Connexion',
        login_desc: 'Entrez vos identifiants pour voter',
        email_label: 'Email',
        password_label: 'Mot de passe',
        sign_in: 'Se connecter',
        no_account: 'Pas de compte ?',
        register_link: "S'inscrire",
        has_account: 'Déjà un compte ?',
        login_link: 'Se connecter',
        register_title: 'Créer un compte',
        register_desc: 'Inscrivez-vous pour participer aux élections',
        firstname_label: 'Prénom',
        lastname_label: 'Nom',
        phone_label: 'Téléphone',
        accept_terms: "J'accepte les conditions d'utilisation",
        register_btn: 'Créer un compte',
        otp_title: 'Vérification',
        otp_desc: 'Entrez le code à 6 chiffres envoyé à votre email',
        verify_btn: 'Vérifier le code',
        resend_otp: 'Renvoyer le code',
        elections_title: 'Choisir une Élection',
        elections_desc: "Sélectionnez l'élection dans laquelle vous souhaitez voter",
        no_elections: 'Aucune élection active pour le moment',
        loading: 'Chargement...',
        candidates_desc: 'Appuyez sur un candidat pour le sélectionner',
        continue_btn: 'Continuer',
        confirm_title: 'Confirmez Votre Vote',
        confirm_desc: 'Veuillez vérifier votre choix',
        confirm_warning: 'Cette action est irréversible',
        confirm_vote_btn: 'Confirmer le Vote',
        success_title: 'Vote Enregistré !',
        success_desc: 'Votre vote a été enregistré en toute sécurité',
        receipt_label: 'Code de Reçu',
        receipt_hint: 'Conservez ce code pour vérifier votre vote plus tard',
        done_btn: 'Terminé',
        err_connection: 'Erreur de connexion. Veuillez réessayer.',
        err_invalid_creds: 'Email ou mot de passe invalide',
        err_already_voted: 'Vous avez déjà voté dans cette élection',
        err_election_not_active: "Cette élection n'est pas active actuellement",
        toast_otp_resent: 'Un nouveau code a été envoyé',
        toast_registered: 'Compte créé ! Veuillez vous connecter.',
    },
};

let currentLang = localStorage.getItem('sv_lang') || 'en';

function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || (i18n.en[key]) || key;
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.getElementById('lang-label').textContent = currentLang.toUpperCase();
    document.documentElement.lang = currentLang;
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'fr' : 'en';
    localStorage.setItem('sv_lang', currentLang);
    applyLanguage();
}

// ============================================
// SCREEN NAVIGATION
// ============================================
const screens = [
    'screen-welcome', 'screen-login', 'screen-register',
    'screen-otp', 'screen-elections', 'screen-candidates',
    'screen-confirm', 'screen-success',
];

function showScreen(id) {
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        // Force re-trigger animation
        target.style.animation = 'none';
        target.offsetHeight; // reflow
        target.style.animation = '';
        window.scrollTo(0, 0);
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// HELPERS
// ============================================
function setLoading(btnId, spinnerId, loading) {
    const btn = document.getElementById(btnId);
    const spinner = document.getElementById(spinnerId);
    if (btn) btn.disabled = loading;
    if (spinner) spinner.classList.toggle('hidden', !loading);
}

function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden');
    }
}

function hideError(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.classList.add('hidden');
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2);
}

const electionIcons = {
    presidential: '🏛️',
    legislative: '📜',
    local: '🏘️',
    referendum: '📋',
    amicale: '🤝',
    university: '🎓',
    corporate: '🏢',
};

// ============================================
// STATE
// ============================================
let state = {
    currentElection: null,
    currentCandidates: [],
    selectedCandidate: null,
    voteToken: null,
    userEmail: '',
};

// ============================================
// APP INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    initEventListeners();

    // If already logged in, go to elections
    if (voterApi.isLoggedIn()) {
        showScreen('screen-elections');
        loadElections();
    }
});

function initEventListeners() {
    // Language toggle
    document.getElementById('lang-btn').addEventListener('click', toggleLanguage);

    // Welcome → Login
    document.getElementById('btn-start').addEventListener('click', () => {
        if (voterApi.isLoggedIn()) {
            showScreen('screen-elections');
            loadElections();
        } else {
            showScreen('screen-login');
        }
    });

    // Back buttons
    document.getElementById('btn-back-login').addEventListener('click', () => showScreen('screen-welcome'));
    document.getElementById('btn-back-register').addEventListener('click', () => showScreen('screen-login'));
    document.getElementById('btn-back-candidates').addEventListener('click', () => {
        showScreen('screen-elections');
        state.selectedCandidate = null;
    });
    document.getElementById('btn-back-confirm').addEventListener('click', () => showScreen('screen-candidates'));

    // Login / Register toggle
    document.getElementById('btn-show-register').addEventListener('click', () => showScreen('screen-register'));
    document.getElementById('btn-show-login').addEventListener('click', () => showScreen('screen-login'));

    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // OTP form
    document.getElementById('otp-form').addEventListener('submit', handleOTP);
    document.getElementById('btn-resend-otp').addEventListener('click', handleResendOTP);
    initOTPInputs();

    // Candidate continue
    document.getElementById('btn-continue-vote').addEventListener('click', goToConfirm);

    // Confirm vote
    document.getElementById('btn-confirm-vote').addEventListener('click', handleVoteSubmit);

    // Done
    document.getElementById('btn-done').addEventListener('click', () => {
        state = { currentElection: null, currentCandidates: [], selectedCandidate: null, voteToken: null, userEmail: '' };
        showScreen('screen-elections');
        loadElections();
    });
}

// ============================================
// OTP INPUT NAVIGATION
// ============================================
function initOTPInputs() {
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = val;
            if (val && idx < inputs.length - 1) {
                inputs[idx + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                inputs[idx - 1].focus();
            }
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').substring(0, 6);
            pasted.split('').forEach((ch, i) => {
                if (inputs[i]) inputs[i].value = ch;
            });
            if (inputs[Math.min(pasted.length, 5)]) inputs[Math.min(pasted.length, 5)].focus();
        });
    });
}

function getOTPCode() {
    return Array.from(document.querySelectorAll('.otp-input')).map(i => i.value).join('');
}

function clearOTPInputs() {
    document.querySelectorAll('.otp-input').forEach(i => { i.value = ''; });
}

// ============================================
// LOGIN
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    hideError('login-error');
    setLoading('btn-login', 'login-spinner', true);

    const email = document.getElementById('voter-email').value.trim();
    const password = document.getElementById('voter-password').value;

    try {
        const result = await voterApi.login(email, password);
        state.userEmail = email;

        if (result.otpRequired) {
            document.getElementById('otp-email-display').textContent = email;
            clearOTPInputs();
            showScreen('screen-otp');
            setTimeout(() => document.querySelector('.otp-input').focus(), 100);
        } else {
            showScreen('screen-elections');
            loadElections();
        }
    } catch (err) {
        const msg = err.message || err.error || t('err_invalid_creds');
        showError('login-error', msg);
    } finally {
        setLoading('btn-login', 'login-spinner', false);
    }
}

// ============================================
// REGISTER
// ============================================
async function handleRegister(e) {
    e.preventDefault();
    hideError('register-error');
    setLoading('btn-register', 'register-spinner', true);

    try {
        await voterApi.register({
            firstName: document.getElementById('reg-firstname').value.trim(),
            lastName: document.getElementById('reg-lastname').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            phone: document.getElementById('reg-phone').value.trim(),
            password: document.getElementById('reg-password').value,
            acceptedTerms: document.getElementById('reg-terms').checked,
        });

        showToast(t('toast_registered'), 'success');
        showScreen('screen-login');
    } catch (err) {
        const msg = err.message || err.error || t('err_connection');
        showError('register-error', msg);
    } finally {
        setLoading('btn-register', 'register-spinner', false);
    }
}

// ============================================
// OTP
// ============================================
async function handleOTP(e) {
    e.preventDefault();
    hideError('otp-error');
    const code = getOTPCode();
    if (code.length !== 6) return;

    setLoading('btn-verify-otp', 'otp-spinner', true);

    try {
        await voterApi.verifyOTP(code);
        showScreen('screen-elections');
        loadElections();
    } catch (err) {
        const msg = err.message || err.error || 'Invalid code';
        showError('otp-error', msg);
        clearOTPInputs();
        setTimeout(() => document.querySelector('.otp-input').focus(), 100);
    } finally {
        setLoading('btn-verify-otp', 'otp-spinner', false);
    }
}

async function handleResendOTP() {
    try {
        await voterApi.resendOTP();
        showToast(t('toast_otp_resent'), 'success');
    } catch {
        showToast(t('err_connection'), 'error');
    }
}

// ============================================
// ELECTIONS
// ============================================
async function loadElections() {
    const list = document.getElementById('elections-list');
    const empty = document.getElementById('elections-empty');
    const loading = document.getElementById('elections-loading');

    list.innerHTML = '';
    empty.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const data = await voterApi.getActiveElections();
        loading.classList.add('hidden');

        const elections = data.data?.elections || data.data || [];

        if (!elections.length) {
            empty.classList.remove('hidden');
            return;
        }

        elections.forEach(election => {
            const card = document.createElement('button');
            card.className = 'election-card';
            card.setAttribute('aria-label', election.title);

            const type = election.type || 'presidential';
            const icon = electionIcons[type] || '🗳️';

            card.innerHTML = `
                <div class="election-icon">${icon}</div>
                <div class="election-info">
                    <div class="election-name">${escapeHtml(election.title)}</div>
                    <div class="election-meta">
                        <span class="election-badge">${capitalize(type)}</span>
                    </div>
                </div>
                <div class="election-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
            `;

            card.addEventListener('click', () => selectElection(election));
            list.appendChild(card);
        });
    } catch (err) {
        loading.classList.add('hidden');
        if (err.status === 401) {
            voterApi.logout();
            showScreen('screen-login');
            return;
        }
        showToast(t('err_connection'), 'error');
    }
}

async function selectElection(election) {
    state.currentElection = election;
    state.selectedCandidate = null;

    document.getElementById('candidates-election-title').textContent = election.title;
    document.getElementById('btn-continue-vote').disabled = true;

    showScreen('screen-candidates');
    loadCandidates(election.id);
}

// ============================================
// CANDIDATES
// ============================================
async function loadCandidates(electionId) {
    const list = document.getElementById('candidates-list');
    const loading = document.getElementById('candidates-loading');

    list.innerHTML = '';
    loading.classList.remove('hidden');

    try {
        const data = await voterApi.getCandidates(electionId);
        loading.classList.add('hidden');

        const candidates = data.data?.candidates || data.data || [];
        state.currentCandidates = candidates;

        candidates.forEach(candidate => {
            const card = document.createElement('button');
            card.className = 'candidate-card';
            card.setAttribute('aria-label', candidate.full_name || candidate.fullName);

            const name = candidate.full_name || candidate.fullName || 'Unknown';
            const party = candidate.political_party || candidate.politicalParty || '';
            const initials = getInitials(name);

            card.innerHTML = `
                <div class="candidate-avatar">${escapeHtml(initials)}</div>
                <div class="candidate-info">
                    <div class="candidate-name">${escapeHtml(name)}</div>
                    ${party ? `<div class="candidate-party">${escapeHtml(party)}</div>` : ''}
                </div>
                <div class="candidate-radio"></div>
            `;

            card.addEventListener('click', () => {
                // Deselect all
                list.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
                // Select this
                card.classList.add('selected');
                state.selectedCandidate = candidate;
                document.getElementById('btn-continue-vote').disabled = false;
            });

            list.appendChild(card);
        });
    } catch (err) {
        loading.classList.add('hidden');
        showToast(t('err_connection'), 'error');
    }
}

// ============================================
// CONFIRMATION
// ============================================
function goToConfirm() {
    if (!state.selectedCandidate || !state.currentElection) return;

    const candidate = state.selectedCandidate;
    const name = candidate.full_name || candidate.fullName || 'Unknown';
    const party = candidate.political_party || candidate.politicalParty || '';
    const initials = getInitials(name);

    const avatarEl = document.getElementById('confirm-avatar');
    avatarEl.textContent = initials;

    document.getElementById('confirm-name').textContent = name;
    document.getElementById('confirm-party').textContent = party;
    document.getElementById('confirm-election').textContent = state.currentElection.title;

    showScreen('screen-confirm');
}

// ============================================
// VOTE SUBMISSION
// ============================================
async function handleVoteSubmit() {
    if (!state.selectedCandidate || !state.currentElection) return;

    setLoading('btn-confirm-vote', 'confirm-spinner', true);

    try {
        // Step 1: Request vote token
        const tokenData = await voterApi.requestVoteToken(state.currentElection.id);
        const voteToken = tokenData.data?.voteToken || tokenData.data?.token;

        if (!voteToken) throw { message: t('err_connection') };

        // Step 2: Submit vote
        const candidateId = state.selectedCandidate.id;
        const voteResult = await voterApi.submitVote(voteToken, candidateId);

        // Step 3: Show success
        const receipt = voteResult.data?.receiptCode || voteResult.data?.receipt || '—';
        document.getElementById('receipt-code').textContent = receipt;

        showScreen('screen-success');
    } catch (err) {
        setLoading('btn-confirm-vote', 'confirm-spinner', false);

        if (err.status === 409) {
            showToast(t('err_already_voted'), 'error');
            showScreen('screen-elections');
            loadElections();
            return;
        }
        if (err.status === 422) {
            showToast(t('err_election_not_active'), 'error');
            return;
        }

        const msg = err.message || err.error || t('err_connection');
        showToast(msg, 'error');
    }
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
