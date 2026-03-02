# 🗳️ SecureVote Backend

> **Système de vote électronique sécurisé** - Backend Node.js/Express avec PostgreSQL et Redis.
> Version optimisée pour la production.

---

## 🏗️ Architecture & Sécurité

### Architecture
Le projet suit une structure modulaire pour assurer la scalabilité et la maintenance :
- `src/config` : Centralisation des configurations (DB, Redis, App).
- `src/services` : Logique métier (Auth, Vote, Election, Encryption).
- `src/middleware` : Sécurité, validation, gestion globale des erreurs.
- `src/server.js` : Point d'entrée avec vérification stricte de l'environnement.

### Sécurité (Production Ready)
- 🔒 **Chiffrement** : AES-256-GCM pour les votes (Données au repos).
- 🛡️ **Hardening** : Helmet, HPP, Rate Limiting (100 req/15min).
- 🚫 **Sans Backdoor** : Suppression des routes de reset HTTP.
- 🎭 **Anonymat** : Découplage strict entre l'identité et le vote.
- 📋 **Validation** : Stricte via `Joi` et `express-validator`.

---

## 🚀 Déploiement

### Option 1 : Déploiement via Docker (Recommandé)

C'est la méthode la plus sûre et la plus rapide pour la production.

1. **Préparer l'environnement** :
   ```bash
   cp .env.example .env
   # GÉNÉRER VOS SECRETS (voir section Variables ci-dessous)
   ```

2. **Lancer le système** :
   ```bash
   docker-compose up -d --build
   ```

3. **Vérifier le statut** :
   Consultez `http://localhost:3000/health`

### Option 2 : Déploiement Local (Sans Docker)

1. **Installer les dépendances** : `npm install`
2. **Configurer `.env`** avec votre PostgreSQL et Redis locaux.
3. **Lancer les migrations** : `npm run migrate`
4. **Démarrer** : `npm start`

---

## 📋 Configuration (Variables d'Environnement)

| Variable | Importance | Description |
|----------|------------|-------------|
| `JWT_ACCESS_SECRET` | 🚨 CRITIQUE | Secret pour les tokens d'accès (32+ chars) |
| `ENCRYPTION_KEY` | 🚨 CRITIQUE | Clé AES-256 (Exactement 32 chars) |
| `DATABASE_URL` | Recommandé | URL de connexion PostgreSQL (Prod) |
| `NODE_ENV` | Important | Set à `production` pour activer le hardening |

**Génération de secrets sécurisés** :
```bash
openssl rand -base64 32
```

---

## 🛠️ Maintenance & Scalabilité

### Gestion des Workers (Scalabilité)
Le système utilise **BullMQ** pour traiter les votes de manière asynchrone. Par défaut, le worker se lance avec l'application. Pour passer à l'échelle :

1. **Démarrer un worker dédié** (sur une autre instance) :
   ```bash
   START_WORKER=true npm start
   ```

### Visualiser les logs
```bash
# Via Docker
docker-compose logs -f app

# Localement
tail -f logs/error.log
```

### Réinitialiser l'Admin
En cas de perte d'accès, utilisez le script CLI :
```bash
npm run reset-admin
```

---

## 📚 Documentation API

🔗 **http://localhost:3000/docs** (Uniquement en mode développement)
🔗 **http://localhost:3000/health** (Toujours disponible)

---
**Développé pour garantir l'intégrité démographique numérique.**
