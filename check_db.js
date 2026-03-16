require('dotenv').config();
const { query } = require('./src/config/database');

async function checkElections() {
    try {
        console.log('--- Diagnostic Base de Données ---');
        const res = await query('SELECT id, title, status FROM elections');
        console.log(`Nombre d'élections trouvées : ${res.rows.length}`);

        if (res.rows.length > 0) {
            console.log('Liste des élections :');
            res.rows.forEach(e => {
                console.log(`- [${e.status}] ${e.title} (${e.id})`);
            });
        } else {
            console.log('⚠️ Aucune élection trouvée dans la base de données.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur SQL :', error.message);
        process.exit(1);
    }
}

checkElections();
