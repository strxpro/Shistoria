/**
 * Jednorazowy skrypt: akceptuje oczekujące zaproszenie Google Business Profile dla bota.
 *
 * Wymagania:
 * - Node.js 18+
 * - Plik credentials: shistoria-menu-bot-0041f7fe2016.json (w katalogu projektu)
 * - Google Business Profile API access ZATWIERDZONY
 *
 * Uruchomienie:
 *   node scripts/accept-google-invite.cjs
 */

const { google } = require('googleapis');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '..', 'shistoria-menu-bot-0041f7fe2016.json');

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/business.manage'],
  });

  const client = await auth.getClient();
  google.options({ auth: client });

  const mybusiness = google.mybusinessaccountmanagement('v1');

  console.log('🔍 Szukam kont...');
  const accountsRes = await mybusiness.accounts.list();
  const accounts = accountsRes.data.accounts || [];
  console.log(`   Znaleziono ${accounts.length} kont:`);
  accounts.forEach(a => console.log(`   - ${a.name} (${a.accountName})`));

  if (accounts.length === 0) {
    console.log('⚠️  Brak kont. Sprawdź czy Google Business Profile API jest aktywne.');
    return;
  }

  for (const account of accounts) {
    console.log(`\n📬 Sprawdzam zaproszenia dla ${account.name}...`);
    try {
      const invRes = await mybusiness.accounts.invitations.list({ parent: account.name });
      const invitations = invRes.data.invitations || [];

      if (invitations.length === 0) {
        console.log('   Brak oczekujących zaproszeń.');
        continue;
      }

      for (const inv of invitations) {
        console.log(`   📩 Zaproszenie: ${inv.name} (rola: ${inv.role})`);
        console.log(`      Cel: ${inv.targetLocation || inv.targetAccount}`);
        try {
          await mybusiness.accounts.invitations.accept({ name: inv.name });
          console.log(`   ✅ ZAAKCEPTOWANO: ${inv.name}`);
        } catch (e) {
          console.error(`   ❌ Błąd akceptacji:`, e.message);
        }
      }
    } catch (e) {
      console.error(`   ❌ Błąd pobierania zaproszeń:`, e.message);
    }
  }

  console.log('\n✅ Gotowe.');
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
