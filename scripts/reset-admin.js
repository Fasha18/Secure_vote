/**
 * ============================================
 * SCRIPT DE REINITIALISATION DU COMPTE ADMIN
 * ============================================
 * 
 * Usage LOCAL:
 *   node scripts/reset-admin.js
 *
 * Usage avec DATABASE_URL (Render) :
 *   $env:DATABASE_URL="postgres://user:pass@host/db?sslmode=require"
 *   node scripts/reset-admin.js
 *
 * Vous pouvez aussi passer les arguments :
 *   node scripts/reset-admin.js --email=votre@email.com --password=VotreMotDePasse123
 */
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ---- Configuration ----
const args = process.argv.slice(2);
const getArg = (name) => {
    const found = args.find(a => a.startsWith(`--${name}=`));
    return found ? found.split('=').slice(1).join('=') : null;
};

const ADMIN_EMAIL = getArg('email') || 'moussaibnseyni2001@gmail.com';
const ADMIN_PASSWORD = getArg('password') || 'Admin@SecureVote2024!';
const ADMIN_FIRST = getArg('firstname') || 'Moussa';
const ADMIN_LAST = getArg('lastname') || 'Admin';

// ---- Connexion DB ----
let pool;
if (process.env.DATABASE_URL) {
    console.log('🌐 Utilisation de DATABASE_URL (Render / Production)');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
} else {
    console.log('🏠 Utilisation de la base de données LOCALE');
    pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME || 'voting_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        ssl: false,
    });
}

async function resetAdmin() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║     REINITIALISATION DU COMPTE ADMIN          ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    try {
        // 1. Test connexion
        const testResult = await pool.query('SELECT NOW() as time');
        console.log('✅ Base de données connectée:', testResult.rows[0].time);

        // 2. Vérifier que la table users existe
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            ) as exists
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('\n❌ La table "users" n\'existe pas!');
            console.log('💡 Exécutez d\'abord les migrations: npm run migrate');
            process.exit(1);
        }
        console.log('✅ Table "users" trouvée\n');

        // 3. Hash du nouveau mot de passe
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
        console.log(`📧 Email admin    : ${ADMIN_EMAIL}`);
        console.log(`🔑 Mot de passe   : ${ADMIN_PASSWORD}`);
        console.log(`👤 Prénom / Nom   : ${ADMIN_FIRST} ${ADMIN_LAST}\n`);

        // 4. Vérifier si l'utilisateur existe déjà
        const existing = await pool.query(
            'SELECT id, email, role, is_active FROM users WHERE email = $1',
            [ADMIN_EMAIL.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            // ─── MISE A JOUR ───
            const user = existing.rows[0];
            console.log(`⚠️  L'utilisateur existe déjà (ID: ${user.id})`);
            console.log(`   Rôle actuel  : ${user.role}`);
            console.log(`   Actif        : ${user.is_active}`);
            console.log('\n🔄 Mise à jour du mot de passe et activation du compte...');

            await pool.query(`
                UPDATE users 
                SET 
                    password_hash          = $1,
                    role                   = 'admin',
                    is_active              = TRUE,
                    failed_login_attempts  = 0,
                    locked_until           = NULL,
                    first_name             = $2,
                    last_name              = $3,
                    updated_at             = NOW()
                WHERE email = $4
            `, [passwordHash, ADMIN_FIRST, ADMIN_LAST, ADMIN_EMAIL.toLowerCase()]);

            console.log('\n✅ Compte mis à jour avec succès !');
        } else {
            // ─── CREATION ───
            console.log('➕ Création du nouveau compte admin...');

            const result = await pool.query(`
                INSERT INTO users (
                    email, password_hash, first_name, last_name,
                    role, is_active, email_verified,
                    failed_login_attempts
                ) VALUES ($1, $2, $3, $4, 'admin', TRUE, TRUE, 0)
                RETURNING id, email, role
            `, [ADMIN_EMAIL.toLowerCase(), passwordHash, ADMIN_FIRST, ADMIN_LAST]);

            const newUser = result.rows[0];

            // Créer le profil
            await pool.query(
                'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
                [newUser.id]
            );

            console.log(`\n✅ Compte admin créé ! (ID: ${newUser.id})`);
        }

        // 5. Vérification finale
        console.log('\n🔍 Vérification finale...');
        const verify = await pool.query(
            'SELECT id, email, role, is_active, password_hash FROM users WHERE email = $1',
            [ADMIN_EMAIL.toLowerCase()]
        );

        if (verify.rows.length > 0) {
            const u = verify.rows[0];
            const pwdOk = await bcrypt.compare(ADMIN_PASSWORD, u.password_hash);
            console.log(`   ✅ Utilisateur trouvé`);
            console.log(`   ✅ Email   : ${u.email}`);
            console.log(`   ✅ Rôle    : ${u.role}`);
            console.log(`   ✅ Actif   : ${u.is_active}`);
            console.log(`   ✅ Mot de passe vérifié : ${pwdOk ? '✅ OK' : '❌ ECHEC'}`);
        }

        console.log('\n╔══════════════════════════════════════════════╗');
        console.log('║              CONNEXION ADMIN                  ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║  Email    : ${ADMIN_EMAIL.padEnd(32)}║`);
        console.log(`║  Password : ${ADMIN_PASSWORD.padEnd(32)}║`);
        console.log('╚══════════════════════════════════════════════╝');
        console.log('\n⚠️  IMPORTANT: Changez ce mot de passe après connexion!\n');

    } catch (err) {
        console.error('\n❌ ERREUR:', err.message);
        console.error('   Code:', err.code);
        if (err.code === 'ECONNREFUSED') {
            console.error('\n💡 PostgreSQL ne semble pas être démarré ou les paramètres de connexion sont incorrects.');
            console.error('   Vérifiez votre fichier .env et assurez-vous que PostgreSQL tourne.');
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

resetAdmin();
