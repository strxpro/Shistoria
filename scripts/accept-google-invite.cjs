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
const fs = require('fs');

// Klucz serwisowy szukany w kolejności:
// 1. env GOOGLE_APPLICATION_CREDENTIALS (ścieżka do pliku)
// 2. dokładna nazwa shistoria-menu-bot-0041f7fe2016.json w katalogu projektu
// 3. dowolny shistoria-menu-bot-*.json w katalogu projektu
function findCredentials() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const root = path.join(__dirname, '..');
  const exact = path.join(root, 'shistoria-menu-bot-0041f7fe2016.json');
  if (fs.existsSync(exact)) return exact;
  const candidate = fs.readdirSync(root).find((f) => /^shistoria-menu-bot-.*\.json$/.test(f));
  if (candidate) return path.join(root, candidate);
  return null;
}

async function main() {
  const CREDENTIALS_PATH = findCredentials();
  if (!CREDENTIALS_PATH) {
    console.error('❌ Brak pliku klucza serwisowego (shistoria-menu-bot-*.json).');
    console.error('   Pobierz go z Google Cloud Console:');
    console.error('   IAM & Admin → Service Accounts → shistoria-bot@shistoria-menu-bot.iam.gserviceaccount.com');
    console.error('   → Keys → Add key → JSON, i zapisz plik w katalogu projektu:');
    console.error('   ' + path.join(__dirname, '..'));
    process.exit(2);
  }
  console.log('🔑 Klucz: ' + CREDENTIALS_PATH);

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
        console.log(`      Cel: ${JSON.stringify(inv.targetLocation || inv.targetAccount || inv.targetType)}`);
        try {
          await mybusiness.accounts.invitations.accept({ name: inv.name });
          console.log(`   ✅ ZAAKCEPTOWANO: ${inv.name}`);
        } catch (e) {
          console.error(`   ❌ Błąd akceptacji:`, e.message);
          // Pełny szczegół błędu z API (powód precondition / quota / rola)
          const details = e?.response?.data || e?.errors || null;
          if (details) console.error('   ↳ Szczegóły API:', JSON.stringify(details, null, 2));
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
