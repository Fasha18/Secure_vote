# 📖 GUIDE COMPLET - Backend Vote Électronique

## Comment le backend a été construit, étape par étape

---

## 📋 TABLE DES MATIÈRES

1. [Étape 1 : Initialisation du projet](#étape-1--initialisation-du-projet)
2. [Étape 2 : Configuration](#étape-2--configuration)
3. [Étape 3 : Utilitaires](#étape-3--utilitaires)
4. [Étape 4 : Base de données](#étape-4--base-de-données)
5. [Étape 5 : Middleware](#étape-5--middleware)
6. [Étape 6 : Validators](#étape-6--validators)
7. [Étape 7 : Services (logique métier)](#étape-7--services-logique-métier)
8. [Étape 8 : Controllers](#étape-8--controllers)
9. [Étape 9 : Routes](#étape-9--routes)
10. [Étape 10 : Application & Serveur](#étape-10--application--serveur)
11. [Étape 11 : Tests](#étape-11--tests)
12. [Étape 12 : Docker](#étape-12--docker)
13. [Comment tester le backend](#-comment-tester-le-backend)

---

## Étape 1 : Initialisation du projet

### Ce qui a été fait :
```bash
# 1. Créer le dossier du projet
mkdir Backend_Vote
cd Backend_Vote

# 2. Initialiser Node.js
npm init -y

# 3. Installer les dépendances de production
npm install express cors helmet morgan compression dotenv uuid bcryptjs jsonwebtoken speakeasy qrcode pg ioredis joi swagger-jsdoc swagger-ui-express winston express-rate-limit rate-limit-redis multer prom-client hpp

# 4. Installer les dépendances de développement
npm install --save-dev nodemon jest supertest
```

### Pourquoi ces dépendances ?

| Package | Rôle |
|---------|------|
| `express` | Framework web HTTP |
| `cors` | Autoriser les requêtes cross-origin (frontend ↔ backend) |
| `helmet` | Ajouter des headers de sécurité HTTP |
| `morgan` | Logger les requêtes HTTP |
| `compression` | Compresser les réponses (gzip) |
| `dotenv` | Charger les variables d'environnement depuis `.env` |
| `bcryptjs` | Hasher les mots de passe |
| `jsonwebtoken` | Créer/vérifier les tokens JWT |
| `speakeasy` + `qrcode` | Authentification 2FA (TOTP) |
| `pg` | Driver PostgreSQL |
| `ioredis` | Client Redis (cache, tokens de vote) |
| `joi` | Validation des données d'entrée |
| `swagger-jsdoc` + `swagger-ui-express` | Documentation API auto-générée |
| `winston` | Logger structuré (fichiers + console) |
| `express-rate-limit` | Protection contre les abus (brute-force) |
| `hpp` | Protection contre la pollution de paramètres HTTP |
| `nodemon` | Redémarrage auto du serveur en dev |
| `jest` + `supertest` | Tests unitaires et d'intégration |

### Fichiers créés :
- **`package.json`** - Configuration du projet, scripts, dépendances
- **`.env`** - Variables d'environnement (secrets, config DB/Redis)
- **`.env.example`** - Modèle des variables (sans les vrais secrets)
- **`.gitignore`** - Fichiers à ne pas committer (node_modules, .env, logs)

### Scripts dans package.json :
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --forceExit --detectOpenHandles",
    "test:unit": "jest tests/unit --forceExit",
    "test:watch": "jest --watch",
    "migrate": "node src/db/migrations/001_initial_schema.js"
  }
}
```

---

## Étape 2 : Configuration

### Fichiers créés dans `src/config/` :

#### 📄 `src/config/app.js` - Configuration centralisée
**Rôle** : Lire TOUTES les variables d'environnement en un seul endroit et les exporter sous forme d'objet structuré.

```
Pourquoi ? → Évite d'avoir process.env.XXX éparpillé partout dans le code.
             Un seul fichier à modifier si on change une variable.
```

**Contenu clé** :
```javascript
module.exports = {
  port: process.env.PORT || 3000,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: '15m',    // Token courte durée
    refreshExpiresIn: '7d',    // Token longue durée
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: 'aes-256-gcm',
  },
  // ... etc
};
```

#### 📄 `src/config/database.js` - Connexion PostgreSQL
**Rôle** : Créer un pool de connexions à PostgreSQL avec monitoring.

**Comment ça marche** :
```
App ──→ Pool (10 connexions) ──→ PostgreSQL
        ↑
        Le pool réutilise les connexions au lieu d'en créer
        une nouvelle à chaque requête (performance++)
```

**Fonctions exportées** :
- `query(sql, params)` - Exécuter une requête SQL
- `getClient()` - Obtenir un client pour les transactions
- `testConnection()` - Vérifier que la DB est accessible

#### 📄 `src/config/redis.js` - Connexion Redis
**Rôle** : Cache temporaire pour les données fréquemment lues.

**Utilisation dans l'app** :
- Stocker les tokens de vote (expiration 1h)
- Cacher les résultats d'élection (éviter de requêter la DB)
- Compteurs de rate limiting

**Fonctions exportées** :
- `cache.get(key)` - Lire du cache
- `cache.set(key, value, ttl)` - Écrire dans le cache
- `cache.del(key)` - Supprimer du cache
- `cache.exists(key)` - Vérifier si une clé existe
- `cache.incr(key)` - Incrémenter un compteur

#### 📄 `src/config/swagger.js` - Documentation API
**Rôle** : Générer automatiquement la documentation Swagger à partir des commentaires dans les routes.

---

## Étape 3 : Utilitaires

### Fichiers créés dans `src/utils/` :

#### 📄 `src/utils/logger.js` - Logger Winston
**Rôle** : Remplacer `console.log` par un logger structuré.

```
En dev  → Affichage coloré dans la console
En prod → Écriture dans des fichiers :
          - logs/error.log   (erreurs uniquement)
          - logs/combined.log (tout)
```

#### 📄 `src/utils/errors.js` - Erreurs personnalisées
**Rôle** : Classes d'erreurs HTTP standard.

```javascript
// Au lieu de faire :
res.status(404).json({ message: 'Non trouvé' });

// On fait :
throw new NotFoundError('Élection non trouvée');
// → Le middleware d'erreur gère automatiquement la réponse
```

**Hiérarchie** :
```
AppError (base)
├── ValidationError     (400)
├── UnauthorizedError   (401)
├── ForbiddenError      (403)
├── NotFoundError       (404)
├── ConflictError       (409)
├── UnprocessableError  (422)
└── TooManyRequestsError(429)
```

#### 📄 `src/utils/response.js` - Réponses standardisées
**Rôle** : Format de réponse uniforme pour toute l'API.

```javascript
// Toutes les réponses ont cette structure :
{
  "success": true/false,
  "message": "Description",
  "data": { ... }           // si succès
  "pagination": { ... }     // si liste paginée
  "errors": [ ... ]         // si erreur de validation
}
```

---

## Étape 4 : Base de données

### 📄 `src/db/migrations/001_initial_schema.js`
**Rôle** : Créer toutes les tables PostgreSQL au démarrage.

### Schéma des tables :

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│     users       │     │   elections      │     │   candidates    │
├─────────────────┤     ├──────────────────┤     ├─────────────────┤
│ id (UUID)       │     │ id (UUID)        │     │ id (UUID)       │
│ email           │────→│ organizer_id     │←────│ election_id     │
│ password_hash   │     │ title            │     │ full_name       │
│ first_name      │     │ description      │     │ political_party │
│ last_name       │     │ type             │     │ biography       │
│ role            │     │ status           │     │ vote_count      │
│ national_id_hash│     │ start_date       │     │ status          │
│ is_active       │     │ end_date         │     └─────────────────┘
│ failed_login_*  │     │ requires_2fa     │
└─────────────────┘     └──────────────────┘
         │                       │
         │    ┌──────────────────┤
         │    │                  │
         ▼    ▼                  ▼
┌───────────────────┐   ┌─────────────────┐
│ user_participation│   │     votes       │  ← PAS DE user_id !
├───────────────────┤   ├─────────────────┤    (anonymat)
│ user_id           │   │ id (UUID)       │
│ election_id       │   │ election_id     │
│ has_voted         │   │ candidate_id    │
│ receipt_code      │   │ encrypted_vote  │
│ voted_at          │   │ vote_proof      │
└───────────────────┘   │ vote_signature  │
                        └─────────────────┘
                                │
                        ┌───────┴─────────┐
                        │  vote_receipts  │
                        ├─────────────────┤
                        │ receipt_code    │
                        │ vote_id         │
                        │ election_id     │
                        └─────────────────┘
```

### Point clé - ANONYMAT :
```
La table "votes" n'a PAS de colonne user_id !
→ Impossible de savoir qui a voté pour qui
→ On sait seulement si un user A VOTÉ (via user_participation)
→ Mais on ne peut PAS lier son vote à son identité
```

### Autres tables :
- **`user_profiles`** - Infos complémentaires (avatar, ville, préférences)
- **`two_factor_auth`** - Secret TOTP pour la 2FA
- **`election_documents`** - Documents attachés aux élections
- **`audit_logs`** - Journal d'audit (qui a fait quoi, quand)
- **`system_events`** - Événements système
- **`notifications`** - Notifications utilisateur
- **`election_stats`** - Snapshots statistiques

---

## Étape 5 : Middleware

### Fichiers dans `src/middleware/` :

#### 📄 `auth.middleware.js` - Authentification JWT
**Rôle** : Vérifier le token JWT dans le header `Authorization`.

```
Requête HTTP
    │
    ▼
Header: "Authorization: Bearer eyJhbGci..."
    │
    ▼
authenticate() middleware
    ├── Extraire le token du header
    ├── Vérifier avec jwt.verify()
    ├── Chercher l'utilisateur en DB
    ├── Vérifier que le compte est actif
    └── Attacher req.user = { id, email, role, ... }
    │
    ▼
Route handler (req.user est disponible)
```

**Fonctions** :
- `authenticate` - Requiert un token valide (401 si absent)
- `optionalAuth` - Token optionnel (req.user peut être null)
- `authorize('admin', 'organizer')` - Vérifier le rôle de l'utilisateur

#### 📄 `validation.middleware.js` - Validation Joi
**Rôle** : Valider automatiquement le body/query/params de la requête.

```javascript
// Utilisation dans les routes :
router.post('/register',
  validate(registerSchema),  // ← Vérifie le body automatiquement
  authController.register
);
```

#### 📄 `error.middleware.js` - Gestion d'erreurs globale
**Rôle** : Attraper TOUTES les erreurs et renvoyer une réponse propre.

```
Erreur lancée n'importe où dans le code
    │
    ▼
errorHandler middleware
    ├── AppError       → Renvoyer statusCode + message
    ├── Erreur Joi     → 400 + détails de validation
    ├── Erreur JWT     → 401 + "Token invalide"
    ├── Erreur PG      → 409/500 selon le code
    └── Autre erreur   → 500 + "Erreur serveur"
```

#### 📄 `ratelimit.middleware.js` - Protection rate limiting
**Rôle** : Limiter le nombre de requêtes par IP.

```
globalLimiter     → 1000 requêtes / 15 min (toute l'API)
loginLimiter      → 5 tentatives / 15 min  (anti-bruteforce)
registerLimiter   → 3 inscriptions / heure
voteLimiter       → 5 soumissions / minute
tokenRequestLimiter → 10 demandes / 5 min
```

---

## Étape 6 : Validators

### Fichiers dans `src/validators/` :

Chaque fichier contient des schémas **Joi** qui définissent exactement quels champs sont acceptés, leur type, et les messages d'erreur en français.

#### `auth.validator.js`
```javascript
registerSchema = {
  email:         string, email, obligatoire, max 255
  phone:         string, format +221XXXXXXXXX, obligatoire
  password:      string, min 8, majuscule+minuscule+chiffre+spécial
  firstName:     string, min 2, obligatoire
  lastName:      string, min 2, obligatoire
  nationalId:    string, optionnel
  acceptedTerms: boolean, doit être true
}
```

#### `election.validator.js`
```javascript
createElectionSchema = {
  title:       string, min 3, obligatoire
  description: string, obligatoire
  type:        enum ['presidential','legislative','local',...]
  startDate:   date ISO, doit être dans le futur
  endDate:     date ISO, doit être après startDate
  // ... options de configuration
}
```

#### `vote.validator.js`
```javascript
submitVoteSchema = {
  candidateId: string UUID, obligatoire
  confirmVote: boolean, doit être true
}
```

---

## Étape 7 : Services (logique métier)

### C'est le CŒUR de l'application. Toute la logique est ici.

#### 📄 `encryption.service.js` - Cryptographie
```
encrypt(text)     → Chiffrer avec AES-256-GCM
decrypt(data)     → Déchiffrer
hash(data)        → Hash SHA-256 (irréversible)
generateVoteProof()    → Preuve cryptographique du vote
generateVoteSignature() → Signature pour vérification
verifyVoteSignature()   → Vérifier une signature
generateReceiptCode()   → Code lisible "VOTE-ABC12345-F1E2D3"
generateToken()         → Token aléatoire sécurisé
```

#### 📄 `jwt.service.js` - Tokens JWT
```
generateAccessToken(user)  → Token courte durée (15 min)
generateRefreshToken(user) → Token longue durée (7 jours)
generateTokenPair(user)    → Les deux en même temps
verifyAccessToken(token)   → Vérifier + décoder
verifyRefreshToken(token)  → Vérifier + décoder
decode(token)              → Décoder sans vérifier
```

#### 📄 `auth.service.js` - Authentification
```
register(data)    → Hasher le mot de passe, créer l'utilisateur
login(email, pwd) → Vérifier le mot de passe, anti-bruteforce
refreshToken(token) → Renouveler les tokens
setup2FA(userId)    → Générer un secret TOTP + QR code
verify2FA(userId, code) → Vérifier le code 2FA
getProfile(userId)  → Récupérer le profil utilisateur
```

**Flow de login détaillé** :
```
1. Chercher l'utilisateur par email
2. Vérifier que le compte n'est pas verrouillé
3. Comparer le mot de passe avec bcrypt.compare()
4. Si échec → incrémenter failed_login_attempts
   Si 5 échecs → verrouiller le compte 15 min
5. Si succès → reset les compteurs d'échec
6. Si 2FA activé → renvoyer un token temporaire
7. Sinon → générer accessToken + refreshToken
8. Logger dans audit_logs
```

#### 📄 `election.service.js` - Gestion des élections
```
createElection(data, userId)    → Créer (status: 'draft')
getElections(filters)           → Lister avec pagination, filtres, recherche
getElectionById(id)             → Détail avec cache Redis
updateElection(id, data, userId) → Modifier (si draft/scheduled)
changeStatus(id, newStatus)     → Transitions : draft→scheduled→active→closed
```

**Machine d'états des élections** :
```
  draft ──→ scheduled ──→ active ──→ closed
    │           │           │
    └───────────┴───────────┴──→ cancelled
```

#### 📄 `candidate.service.js` - Gestion des candidats
```
createCandidate(electionId, data, userId) → Ajouter un candidat
getCandidatesByElection(electionId)       → Lister les candidats
updateCandidate(id, data, userId)         → Modifier
deleteCandidate(id, userId)              → Supprimer (draft only)
```

#### 📄 `vote.service.js` - LE SERVICE LE PLUS CRITIQUE 🔐

**Flow complet du vote** :
```
╔══════════════════════════════════════════════════════════════╗
║  ÉTAPE 1 : Demander un token de vote                       ║
║  POST /api/elections/:id/request-vote-token                 ║
╠══════════════════════════════════════════════════════════════╣
║  1. Vérifier que l'élection est "active"                    ║
║  2. Vérifier que l'utilisateur n'a PAS déjà voté            ║
║  3. Vérifier les critères d'éligibilité (2FA, etc.)         ║
║  4. Générer un token unique (crypto.randomBytes)            ║
║  5. Stocker dans Redis avec TTL de 1 heure                  ║
║     clé: "vote_token:{token}" → valeur: {userId, electionId}║
║  6. Créer l'entrée user_participation                       ║
║  7. Retourner le token à l'utilisateur                      ║
╚══════════════════════════════════════════════════════════════╝
                         │
                         ▼
╔══════════════════════════════════════════════════════════════╗
║  ÉTAPE 2 : Soumettre le vote                                ║
║  POST /api/votes/submit  (header: X-Vote-Token)             ║
╠══════════════════════════════════════════════════════════════╣
║  1. Récupérer les données du token depuis Redis             ║
║  2. Vérifier que le token n'a pas été utilisé               ║
║  3. Vérifier que le candidat existe dans cette élection     ║
║  4. ── DÉBUT TRANSACTION SQL ──                             ║
║  5. Chiffrer le vote (AES-256-GCM) → "encrypted_vote"      ║
║  6. Générer une preuve cryptographique → "vote_proof"       ║
║  7. Générer une signature → "vote_signature"                ║
║  8. Insérer dans la table "votes" (SANS user_id !)          ║
║  9. Mettre à jour user_participation (has_voted = true)     ║
║  10. Incrémenter vote_count du candidat                     ║
║  11. Générer un receipt_code et l'insérer                   ║
║  12. ── FIN TRANSACTION SQL ──                              ║
║  13. Supprimer le token de Redis (usage unique)             ║
║  14. Invalider les caches                                   ║
║  15. Retourner le receipt_code à l'utilisateur              ║
╚══════════════════════════════════════════════════════════════╝
                         │
                         ▼
╔══════════════════════════════════════════════════════════════╗
║  ÉTAPE 3 : Vérifier le vote                                 ║
║  GET /api/votes/verify/:receiptCode                         ║
╠══════════════════════════════════════════════════════════════╣
║  1. Chercher le receipt dans vote_receipts                  ║
║  2. Joindre avec votes pour avoir le timestamp              ║
║  3. Joindre avec elections pour le titre                    ║
║  4. Vérifier la signature cryptographique                   ║
║  5. Retourner : vérifié oui/non, élection, timestamp       ║
║     (SANS révéler pour qui le vote a été fait !)            ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Étape 8 : Controllers

### Fichiers dans `src/controllers/` :

Les controllers sont la couche **HTTP**. Ils ne contiennent PAS de logique métier. Ils font seulement :

```
1. Extraire les données de la requête (req.body, req.params, req.user)
2. Appeler le service correspondant
3. Retourner la réponse formatée
4. Passer les erreurs au middleware (via next(error))
```

**Exemple simplifié** :
```javascript
class AuthController {
  async register(req, res, next) {
    try {
      // 1. Extraire les données
      const userData = req.body;
      
      // 2. Appeler le service
      const result = await authService.register(userData);
      
      // 3. Retourner la réponse
      return ApiResponse.created(res, result, 'Inscription réussie');
    } catch (error) {
      // 4. Passer l'erreur au middleware
      next(error);
    }
  }
}
```

---

## Étape 9 : Routes

### Fichiers dans `src/routes/` :

Les routes définissent les **endpoints de l'API** et les middleware à appliquer.

#### Structure :
```
src/routes/
├── index.js              ← Monte tous les sous-routers
├── auth.routes.js        ← /api/auth/*
├── election.routes.js    ← /api/elections/*
├── candidate.routes.js   ← /api/candidates/*
└── vote.routes.js        ← /api/votes/*
```

#### `index.js` - Routeur central :
```javascript
router.use('/auth', authRoutes);
router.use('/elections', electionRoutes);
router.use('/candidates', candidateRoutes);
router.use('/votes', voteRoutes);
```

#### Exemple de route avec tout le middleware :
```javascript
router.post('/register',
  registerLimiter,              // 1. Rate limiting (3/heure)
  validate(registerSchema),     // 2. Validation du body
  authController.register       // 3. Controller
);

router.post('/',
  authenticate,                 // 1. Vérifier le JWT
  authorize('organizer','admin'), // 2. Vérifier le rôle
  validate(createElectionSchema), // 3. Valider le body
  electionController.create     // 4. Controller
);
```

---

## Étape 10 : Application & Serveur

#### 📄 `src/app.js` - Configuration Express
```
app.use(helmet())          → Headers de sécurité
app.use(cors())            → Cross-Origin autorisé
app.use(hpp())             → Anti parameter pollution
app.use(express.json())    → Parser le body JSON
app.use(compression())     → Comprimer les réponses
app.use(morgan())          → Logger les requêtes HTTP
app.use(globalLimiter)     → Rate limiting global
app.use('/docs', swagger)  → Documentation API
app.get('/health', ...)    → Health check (DB + Redis)
app.use('/api', routes)    → Monter toutes les routes
app.use(notFoundHandler)   → 404 pour les routes inconnues
app.use(errorHandler)      → Gestion globale des erreurs
```

#### 📄 `src/server.js` - Point d'entrée
```
1. Charger dotenv (variables d'environnement)
2. Tester la connexion PostgreSQL
3. Exécuter les migrations (créer les tables)
4. Connecter Redis
5. Démarrer le serveur HTTP sur le port configuré
6. Configurer le graceful shutdown (SIGTERM, SIGINT)
```

---

## Étape 11 : Tests

### Tests unitaires dans `tests/unit/` :

#### `encryption.service.test.js` (19 tests)
- Chiffrement + déchiffrement correct
- Les résultats sont différents à chaque appel (IV aléatoire)
- Le hashing est déterministe
- Les preuves de vote sont uniques
- Les signatures sont vérifiables
- Les receipt codes ont le bon format

#### `jwt.service.test.js` (10 tests)
- Génération de token access valide
- Génération de token refresh valide
- Vérification réussie avec bon token
- Échec avec token invalide
- Impossible d'utiliser un refresh en tant qu'access (et vice-versa)

#### `validators.test.js` (16 tests)
- Validation réussie avec données valides
- Rejet des emails invalides
- Rejet des mots de passe trop faibles
- Rejet des dates dans le passé
- Etc.

---

## Étape 12 : Docker

#### `Dockerfile` - Image de production
```dockerfile
# Build multi-stage pour une image légère
FROM node:18-alpine          # Image minimale
RUN npm ci --only=production # Pas de devDependencies
USER nodejs                  # Pas de root !
HEALTHCHECK ...              # Vérification de santé
```

#### `docker-compose.yml` - Orchestration
```yaml
services:
  app:
    build: .           # Notre backend
    depends_on:
      - postgres       # Attend que la DB soit prête
      - redis          # Attend que Redis soit prêt

  postgres:
    image: postgres:15-alpine
    healthcheck: ...   # pg_isready

  redis:
    image: redis:7-alpine
    command: --requirepass ... --maxmemory 256mb
```

---

## 🧪 COMMENT TESTER LE BACKEND

### Prérequis

1. **PostgreSQL** installé et lancé
2. **Redis** installé (optionnel pour les tests basiques)
3. **Node.js** >= 18

---

### Méthode 1 : Tests unitaires (SANS base de données)

```bash
# Lancer tous les tests unitaires
npm run test:unit

# Résultat attendu : 45 tests passed ✅
```

Ces tests ne nécessitent NI PostgreSQL NI Redis. Ils testent la logique pure (cryptographie, JWT, validation).

---

### Méthode 2 : Lancer le serveur en local

#### Étape 1 : Préparer PostgreSQL

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE voting_db;

# Créer l'utilisateur (optionnel, on peut utiliser postgres)
CREATE USER voting_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE voting_db TO voting_user;

# Quitter
\q
```

#### Étape 2 : Configurer .env

Éditer le fichier `.env` avec vos paramètres réels :
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=voting_db
DB_USER=postgres         # ou voting_user
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Étape 3 : Lancer le serveur

```bash
npm run dev
```

Vous devriez voir :
```
info: Database connected successfully
info: Database migration completed successfully
info: Server running on port 3000
```

#### Étape 4 : Vérifier avec le navigateur

- **http://localhost:3000/** → Page d'accueil JSON
- **http://localhost:3000/health** → État de santé
- **http://localhost:3000/docs** → Documentation Swagger interactive

---

### Méthode 3 : Tester avec cURL (terminal)

#### Test 1 : Vérifier que le serveur tourne
```bash
curl http://localhost:3000/
```

#### Test 2 : Health check
```bash
curl http://localhost:3000/health
```

#### Test 3 : Inscription d'un utilisateur
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+221771234567",
    "password": "MonMotDePasse1!",
    "firstName": "Amadou",
    "lastName": "Diallo",
    "acceptedTerms": true
  }'
```

#### Test 4 : Connexion
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "MonMotDePasse1!"
  }'
```
→ Réponse : `{ "accessToken": "eyJ...", "refreshToken": "eyJ..." }`

#### Test 5 : Créer une élection (avec le token)
```bash
curl -X POST http://localhost:3000/api/elections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_ACCESS_TOKEN_ICI" \
  -d '{
    "title": "Élection Présidentielle 2026",
    "description": "Élection du président",
    "type": "presidential",
    "startDate": "2026-03-01T08:00:00Z",
    "endDate": "2026-03-01T20:00:00Z"
  }'
```

#### Test 6 : Lister les élections
```bash
curl http://localhost:3000/api/elections
```

---

### Méthode 4 : Tester avec Postman

1. Importer l'URL de Swagger : `http://localhost:3000/docs`
2. Utiliser les endpoints décrits dans la documentation
3. Pour les endpoints protégés, mettre le token dans `Authorization: Bearer <token>`

---

### Méthode 5 : Lancer avec Docker (tout automatique)

```bash
# Lancer tout (app + PostgreSQL + Redis)
docker-compose up -d

# Voir les logs
docker-compose logs -f app

# Arrêter tout
docker-compose down
```

---

### Méthode 6 : Flow complet de vote (test E2E manuel)

```bash
# 1. S'inscrire
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"voter@test.com","phone":"+221770001111","password":"VoteSecure1!","firstName":"Moussa","lastName":"Ba","acceptedTerms":true}'

# 2. Se connecter → récupérer accessToken
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"voter@test.com","password":"VoteSecure1!"}' | jq -r '.data.accessToken')

# 3. Créer une élection
ELECTION=$(curl -s -X POST http://localhost:3000/api/elections -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Vote Test","description":"Test","type":"amicale","startDate":"2026-03-01T08:00:00Z","endDate":"2026-03-02T20:00:00Z"}' | jq -r '.data.id')

# 4. Ajouter un candidat
CANDIDATE=$(curl -s -X POST http://localhost:3000/api/elections/$ELECTION/candidates \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"fullName":"Candidat A","biography":"Description du candidat"}' | jq -r '.data.id')

# 5. Activer l'élection (draft → scheduled → active)
curl -X PATCH http://localhost:3000/api/elections/$ELECTION/status \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"scheduled"}'

curl -X PATCH http://localhost:3000/api/elections/$ELECTION/status \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"active"}'

# 6. Demander un token de vote
VOTE_TOKEN=$(curl -s -X POST http://localhost:3000/api/elections/$ELECTION/request-vote-token \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.voteToken')

# 7. Voter !
RECEIPT=$(curl -s -X POST http://localhost:3000/api/votes/submit \
  -H "Content-Type: application/json" \
  -H "X-Vote-Token: $VOTE_TOKEN" \
  -d "{\"candidateId\":\"$CANDIDATE\",\"confirmVote\":true}" | jq -r '.data.receiptCode')

# 8. Vérifier le vote
curl http://localhost:3000/api/votes/verify/$RECEIPT

# 9. Voir les résultats
curl http://localhost:3000/api/elections/$ELECTION/results \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Résumé de l'architecture

```
Requête HTTP
    │
    ▼
┌─── Express App (app.js) ───────────────────────────┐
│                                                     │
│  Helmet → CORS → HPP → JSON Parser → Compression  │
│                    │                                │
│                    ▼                                │
│  Morgan (logging) → Rate Limiter                   │
│                    │                                │
│                    ▼                                │
│  ┌── Routes (routes/*.js) ──────────────────────┐  │
│  │                                               │  │
│  │  Rate Limiter → Validation → Auth → Controller│  │
│  │                                               │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                              │
│                      ▼                              │
│  ┌── Controllers (controllers/*.js) ─────────────┐  │
│  │  Extraire données → Appeler Service → Réponse │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                              │
│                      ▼                              │
│  ┌── Services (services/*.js) ───────────────────┐  │
│  │  Logique métier → DB Queries → Cache Redis    │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                              │
│                      ▼                              │
│  ┌── Error Handler (middleware/error.js) ────────┐  │
│  │  Attraper toutes les erreurs → Réponse JSON   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    PostgreSQL              Redis
    (données)             (cache/tokens)
```

---

**Fichier créé le 14 Février 2026**
**45 tests unitaires ✅ | 33 fichiers source | 10+ tables SQL**
