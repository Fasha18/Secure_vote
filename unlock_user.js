require('dotenv').config();
const { query } = require('./src/config/database');

async function unlockUser(email) {
    try {
        console.log(`🔓 Déverrouillage de l'utilisateur : ${email}...`);
        const result = await query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1 RETURNING id, email',
            [email.toLowerCase()]
        );

        if (result.rows.length > 0) {
            console.log(`✅ Utilisateur ${result.rows[0].email} déverrouillé avec succès !`);
        } else {
            console.log(`❌ Utilisateur ${email} non trouvé.`);
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors du déverrouillage :', error);
        process.exit(1);
    }
}

const email = process.argv[2] || 'fatou5@gmail.com';
unlockUser(email);
