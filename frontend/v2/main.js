/**
 * SecureVote Dashboard V2 - Version Simplifiée et Fonctionnelle
 * Architecture claire avec gestion d'événements robuste
 */

// ============================================
// CONFIGURATION ET ÉTAT GLOBAL
// ============================================
const AppState = {
    currentUser: null,
    currentPage: 'dashboard',
    isDebugMode: true
};

// ============================================
// UTILITAIRES DE DÉBOGAGE
// ============================================
function debug(message, type = 'info') {
    if (!AppState.isDebugMode) return;

    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
        debugDiv.classList.add('active');
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff';
        debugDiv.innerHTML += `<div style="color:${color}">[${time}] ${message}</div>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================
// SYSTÈME DE TOAST
// ============================================
function showToast(message, type = 'info') {
    debug(`Toast: ${message} (${type})`, type);
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// SYSTÈME DE MODAL
// ============================================
const Modal = {
    show(title, bodyHTML, footerHTML = '') {
        debug(`Modal.show appelée: ${title}`, 'info');
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-content');

        if (!overlay || !modal) {
            debug('Erreur: Éléments modal non trouvés', 'error');
            return;
        }

        modal.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="Modal.close()">✕</button>
            </div>
            <div class="modal-body">${bodyHTML}</div>
            ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
        `;

        overlay.classList.add('active');
        debug('Modal affichée avec succès', 'success');
    },

    close() {
        debug('Modal.close appelée', 'info');
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            debug('Modal fermée', 'success');
        }
    }
};

// Exposer Modal globalement
window.Modal = Modal;

// ============================================
// GESTION DES ÉLECTIONS
// ============================================
const Elections = {
    showCreateModal() {
        debug('Elections.showCreateModal appelée', 'info');

        Modal.show('➕ Nouvelle Élection', `
            <form id="election-form">
                <div class="form-group">
                    <label>Titre</label>
                    <input type="text" id="election-title" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="election-desc" class="form-control" rows="3" required></textarea>
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="election-type" class="form-control">
                        <option value="presidential">Présidentielle</option>
                        <option value="legislative">Législative</option>
                        <option value="local">Locale</option>
                        <option value="university">Universitaire</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date de début</label>
                        <input type="datetime-local" id="election-start" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Date de fin</label>
                        <input type="datetime-local" id="election-end" class="form-control" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full">Créer l'élection</button>
            </form>
        `);

        // Attacher l'événement au formulaire
        setTimeout(() => {
            const form = document.getElementById('election-form');
            if (form) {
                form.addEventListener('submit', Elections.handleCreate);
                debug('Événement submit attaché au formulaire', 'success');
            } else {
                debug('Erreur: Formulaire non trouvé', 'error');
            }
        }, 100);
    },

    async handleCreate(e) {
        e.preventDefault();
        debug('Elections.handleCreate appelée', 'info');

        try {
            const data = {
                title: document.getElementById('election-title').value,
                description: document.getElementById('election-desc').value,
                type: document.getElementById('election-type').value,
                startDate: new Date(document.getElementById('election-start').value).toISOString(),
                endDate: new Date(document.getElementById('election-end').value).toISOString()
            };

            debug(`Données élection: ${JSON.stringify(data)}`, 'info');

            await api.createElection(data);
            Modal.close();
            showToast('Élection créée avec succès !', 'success');
            Navigation.goTo('elections');
        } catch (err) {
            debug(`Erreur création élection: ${err.message}`, 'error');
            const msg = err.errors ? err.errors.join(' | ') : (err.message || 'Erreur lors de la création');
            showToast(msg, 'error');
        }
    }
};

// Exposer Elections globalement
window.Elections = Elections;

// ============================================
// GESTION DES MEMBRES
// ============================================
const Members = {
    showAddModal() {
        debug('Members.showAddModal appelée', 'info');

        Modal.show('👥 Ajouter un Membre', `
            <form id="member-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" id="member-firstname" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" id="member-lastname" class="form-control" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="member-email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="text" id="member-phone" class="form-control" placeholder="+221771234567" required>
                </div>
                <div class="form-group">
                    <label>Mot de passe</label>
                    <input type="password" id="member-password" class="form-control" placeholder="Min 8 caractères" required>
                </div>
                <div class="form-group">
                    <label>Rôle</label>
                    <select id="member-role" class="form-control">
                        <option value="voter">Votant</option>
                        <option value="organizer">Organisateur</option>
                        <option value="admin">Administrateur</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-full">Ajouter le membre</button>
            </form>
        `);

        // Attacher l'événement au formulaire
        setTimeout(() => {
            const form = document.getElementById('member-form');
            if (form) {
                form.addEventListener('submit', Members.handleAdd);
                debug('Événement submit attaché au formulaire membre', 'success');
            } else {
                debug('Erreur: Formulaire membre non trouvé', 'error');
            }
        }, 100);
    },

    async handleAdd(e) {
        e.preventDefault();
        debug('Members.handleAdd appelée', 'info');

        try {
            const userData = {
                firstName: document.getElementById('member-firstname').value,
                lastName: document.getElementById('member-lastname').value,
                email: document.getElementById('member-email').value,
                phone: document.getElementById('member-phone').value,
                password: document.getElementById('member-password').value,
                acceptedTerms: true
            };

            const role = document.getElementById('member-role').value;

            debug(`Données membre: ${JSON.stringify(userData)}`, 'info');

            const res = await api.register(userData);
            const newUser = res.data.user;

            // Mettre à jour le rôle si nécessaire
            if (role !== 'voter' && newUser && newUser.id) {
                debug(`Mise à jour du rôle vers: ${role}`, 'info');
                await api.updateUserRole(newUser.id, role);
            }

            Modal.close();
            showToast('Membre ajouté avec succès !', 'success');
            Navigation.goTo('roles');
        } catch (err) {
            debug(`Erreur ajout membre: ${err.message}`, 'error');
            const msg = err.errors ? err.errors.join(' | ') : (err.message || 'Erreur lors de l\'ajout');
            showToast(msg, 'error');
        }
    }
};

// Exposer Members globalement
window.Members = Members;

// ============================================
// SYSTÈME DE NAVIGATION
// ============================================
const Navigation = {
    goTo(page) {
        debug(`Navigation vers: ${page}`, 'info');
        AppState.currentPage = page;

        // Mettre à jour la navigation active
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Charger le contenu de la page
        const content = document.getElementById('page-content');
        content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        switch (page) {
            case 'dashboard':
                Pages.renderDashboard(content);
                break;
            case 'elections':
                Pages.renderElections(content);
                break;
            case 'candidates':
                Pages.renderCandidates(content);
                break;
            case 'roles':
                Pages.renderRoles(content);
                break;
            case 'settings':
                Pages.renderSettings(content);
                break;
        }
    }
};

// Exposer Navigation globalement
window.Navigation = Navigation;

// ============================================
// RENDU DES PAGES
// ============================================
const Pages = {
    async renderDashboard(container) {
        debug('Rendu de la page Dashboard', 'info');
        let elections = [], stats = {};

        try {
            const [eRes, sRes] = await Promise.all([
                api.getElections({ limit: 5 }).catch(() => ({ data: { data: [] } })),
                api.getStats().catch(() => ({ data: {} }))
            ]);
            elections = eRes.data.data || [];
            stats = sRes.data || {};
        } catch (e) {
            debug(`Erreur chargement dashboard: ${e.message}`, 'error');
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Tableau de bord</h1>
                    <p>Bienvenue, <strong>${AppState.currentUser?.firstName || 'Admin'}</strong></p>
                </div>
                <button class="btn btn-primary" onclick="Elections.showCreateModal()">
                    ➕ Nouvelle Élection
                </button>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue">🗳️</div>
                    <div class="stat-info">
                        <h3>Élections</h3>
                        <div class="stat-number">${stats.elections?.total || elections.length}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">✅</div>
                    <div class="stat-info">
                        <h3>Actives</h3>
                        <div class="stat-number">${stats.elections?.active || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">👥</div>
                    <div class="stat-info">
                        <h3>Utilisateurs</h3>
                        <div class="stat-number">${stats.totalUsers || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">📊</div>
                    <div class="stat-info">
                        <h3>Votes</h3>
                        <div class="stat-number">${stats.totalVotes || 0}</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>📋 Dernières Élections</h3></div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${elections.length > 0 ? elections.map(el => `
                                <tr>
                                    <td><strong>${el.title}</strong></td>
                                    <td><span class="badge badge-${el.status}">${el.status}</span></td>
                                    <td><button class="btn-icon" onclick="alert('Détails: ${el.title}')">👁️</button></td>
                                </tr>
                            `).join('') : '<tr><td colspan="3" style="text-align:center;padding:20px;">Aucune élection</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async renderElections(container) {
        debug('Rendu de la page Élections', 'info');
        let elections = [];

        try {
            const res = await api.getElections();
            elections = res.data.data || [];
        } catch (e) {
            debug(`Erreur chargement élections: ${e.message}`, 'error');
            showToast('Erreur de chargement des élections', 'error');
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Élections</h1>
                    <p>Gérez vos scrutins</p>
                </div>
                <button class="btn btn-primary" onclick="Elections.showCreateModal()">
                    ➕ Nouvelle Élection
                </button>
            </div>
            <div class="elections-grid">
                ${elections.length > 0 ? elections.map(el => `
                    <div class="election-card">
                        <div class="election-card-header">
                            <h4>${el.title}</h4>
                            <span class="badge badge-${el.status}">${el.status}</span>
                        </div>
                        <p style="font-size:13px; color:var(--gray-500); margin:10px 0;">${el.description || '...'}</p>
                        <div class="election-meta">
                            <span>📅 ${new Date(el.startDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('') : '<div class="empty-state"><h3>Aucune élection</h3><p>Créez votre première élection</p></div>'}
            </div>
        `;
    },

    async renderCandidates(container) {
        debug('Rendu de la page Candidats', 'info');
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Candidats</h1>
                    <p>Gestion des candidats</p>
                </div>
            </div>
            <div class="card">
                <p style="padding:20px;text-align:center;">Sélectionnez une élection pour voir ses candidats</p>
            </div>
        `;
    },

    async renderRoles(container) {
        debug('Rendu de la page Rôles', 'info');
        let users = [];

        try {
            const res = await api.getUsers();
            debug(`Réponse API utilisateurs: ${JSON.stringify(res.data).substring(0, 100)}`, 'info');
            // L'API peut retourner les users de plusieurs façons
            if (Array.isArray(res.data)) {
                users = res.data;
            } else if (Array.isArray(res.data?.users)) {
                users = res.data.users;
            } else if (Array.isArray(res.data?.data)) {
                users = res.data.data;
            }
            debug(`${users.length} utilisateur(s) chargé(s)`, 'success');
        } catch (e) {
            debug(`Erreur chargement utilisateurs: ${e.message}`, 'error');
            showToast('Erreur de chargement des utilisateurs', 'error');
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Rôles & Membres</h1>
                    <p>Gérez votre équipe</p>
                </div>
                <button class="btn btn-primary" onclick="Members.showAddModal()">
                    👥 Ajouter un Membre
                </button>
            </div>
            <div class="card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Rôle</th>
                            <th>Statut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.length > 0 ? users.map(u => `
                            <tr>
                                <td>
                                    <div class="member-cell">
                                        <div class="member-avatar">${(u.firstName || 'U')[0]}</div>
                                        <div>
                                            <strong>${u.firstName} ${u.lastName}</strong><br>
                                            <small>${u.email}</small>
                                        </div>
                                    </div>
                                </td>
                                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                                <td>
                                    <span class="status-dot ${u.isActive ? 'active' : 'inactive'}"></span>
                                    ${u.isActive ? 'Actif' : 'Bloqué'}
                                </td>
                                <td>
                                    <button class="btn-icon" title="Modifier">✏️</button>
                                </td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;">Aucun utilisateur</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderSettings(container) {
        debug('Rendu de la page Paramètres', 'info');
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1>Paramètres</h1>
                    <p>Configuration du système</p>
                </div>
            </div>
            <div class="card">
                <p style="padding:20px;">Fonctionnalité en cours de développement...</p>
            </div>
        `;
    }
};

// ============================================
// AUTHENTIFICATION
// ============================================
const Auth = {
    async handleLogin(e) {
        e.preventDefault();
        debug('Auth.handleLogin appelée', 'info');

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;

        try {
            await api.login(email, password);

            // Toujours afficher la page OTP après le login
            debug('Login réussi → affichage de la page OTP', 'success');
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('otp-form').classList.remove('hidden');
            document.getElementById('otp-email-display').textContent = email;
            // Vider les champs OTP et mettre le focus sur le 1er
            document.querySelectorAll('.otp-input').forEach(i => i.value = '');
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) firstInput.focus();
            Auth.setupOTPInputs();
            showToast('Code OTP envoyé par email 📧', 'success');
        } catch (err) {
            debug(`Erreur login: ${err.message}`, 'error');
            const errorDiv = document.getElementById('login-error');
            if (errorDiv) {
                errorDiv.textContent = err.message || 'Email ou mot de passe incorrect';
                errorDiv.classList.remove('hidden');
            }
            showToast(err.message || 'Erreur de connexion', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    setupOTPInputs() {
        const inputs = document.querySelectorAll('.otp-input');
        inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (e.target.value.length === 1 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && index > 0) {
                    inputs[index - 1].focus();
                }
            });
        });
    },

    async handleOTP(e) {
        e.preventDefault();
        debug('Auth.handleOTP appelée', 'info');

        const inputs = document.querySelectorAll('.otp-input');
        const otpCode = Array.from(inputs).map(input => input.value).join('');
        const errorDiv = document.getElementById('otp-error');
        const btn = e.target.querySelector('button[type="submit"]');

        if (errorDiv) errorDiv.classList.add('hidden');

        if (otpCode.length !== 6) {
            if (errorDiv) { errorDiv.textContent = 'Entrez les 6 chiffres du code'; errorDiv.classList.remove('hidden'); }
            return;
        }

        if (btn) btn.disabled = true;

        try {
            const result = await api.verifyOTP(otpCode);
            // Récupérer l'utilisateur depuis la réponse (peut être dans différentes propriétés)
            AppState.currentUser = result.data?.user || result.data || null;
            debug(`OTP vérifié avec succès !`, 'success');
            showToast('Connexion réussie ! 🎉', 'success');
            Auth.showDashboard();
        } catch (err) {
            debug(`Erreur OTP: ${err.message}`, 'error');
            if (errorDiv) {
                errorDiv.textContent = err.message || 'Code OTP invalide ou expiré';
                errorDiv.classList.remove('hidden');
            }
            showToast(err.message || 'Code invalide', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    showDashboard() {
        debug('Affichage du dashboard', 'info');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('dashboard-page').classList.remove('hidden');
        Navigation.goTo('dashboard');
    },

    logout() {
        debug('Déconnexion', 'info');
        api.logout();
        AppState.currentUser = null;
        document.getElementById('dashboard-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
        showToast('Déconnexion réussie', 'info');
    }
};

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    debug('🚀 Dashboard V2 Initializing...', 'success');

    // Configuration des événements d'authentification
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', Auth.handleLogin);
        debug('Événement login attaché', 'success');
    }

    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        otpForm.addEventListener('submit', Auth.handleOTP);
        debug('Événement OTP attaché', 'success');
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
        debug('Événement logout attaché', 'success');
    }

    // Configuration de la navigation
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            Navigation.goTo(item.dataset.page);
        });
    });
    debug('Navigation configurée', 'success');

    // Fermer la modal en cliquant sur l'overlay
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            Modal.close();
        }
    });

    // Vérifier si l'utilisateur est déjà connecté
    if (api.isLoggedIn()) {
        debug('Utilisateur déjà connecté', 'info');
        Auth.showDashboard();
    } else {
        debug('Affichage de la page de login', 'info');
        document.getElementById('login-page').classList.remove('hidden');
    }

    debug('✅ Dashboard V2 initialisé avec succès', 'success');
});

// Exposer les fonctions globalement pour les onclick dans le HTML
window.showToast = showToast;
window.debug = debug;
