<div align="center">

# 📬 S'HISTORIA — ODBIERANIE MAILI BEZ MAKE.COM (cron.org + IMAP)

**Klient odpisuje na maila → wiadomość trafia do panelu admina (Messaggi) jako czat. Za darmo, co minutę.**

</div>

---

## 🧩 Jak to działa (prosto)
```
Klient odpisuje na e-mail
        │
        ▼
cron.org (co 1 min) dzwoni pod:  https://www.shistoria.it/api/check-mail?key=SEKRET
        │
        ▼
Endpoint loguje się do skrzynki OVH (info@shistoria.it), czyta NIEPRZECZYTANE maile
        │
        ▼
Zapisuje je do Supabase (contact_messages) i oznacza jako przeczytane
        │
        ▼
Panel admin (zakładka Messaggi) pokazuje je NA ŻYWO jako czat (grupuje po e-mailu)
```

> ✅ Endpoint już jest w kodzie i wdrożony: `src/app/api/check-mail/route.ts`. Ty robisz tylko KROK 1 i 2 poniżej.

---

## 🔴 KROK 1 — zmienne w Vercel (~5 min)

Vercel → projekt Shistoria → **Settings → Environment Variables** → dodaj:

| Zmienna | Wartość | Uwaga |
|---|---|---|
| `IMAP_HOST` | `ssl0.ovh.net` | serwer poczty OVH |
| `IMAP_PORT` | `993` | |
| `IMAP_USER` | `info@shistoria.it` | Twoja skrzynka |
| `IMAP_PASS` | hasło skrzynki | hasło do `info@shistoria.it` |
| `CRON_SECRET` | wymyśl losowy ciąg, np. `sh_8x42kfp9` | hasło zabezpieczające endpoint |
| `SUPABASE_SERVICE_KEY` | (opcjonalnie) service_role key z Supabase | jeśli nie dasz, użyje anon — też działa |

Po dodaniu → **Redeploy** projektu (Deployments → ⋯ → Redeploy).

> 🔐 `CRON_SECRET` to Twoje tajne hasło — bez niego nikt nie wywoła endpointu. Zapamiętaj je, użyjesz w KROKU 2.

---

## 🔴 KROK 2 — cron.org (~5 min)

1. Wejdź na **[cron-job.org](https://cron-job.org)** → załóż darmowe konto (e-mail + hasło)
2. Kliknij **„Create cronjob"**
3. Wypełnij:
   - **Title:** `Shistoria — sprawdzaj maile`
   - **URL:**
     ```
     https://www.shistoria.it/api/check-mail?key=TWOJ_CRON_SECRET
     ```
     (zamień `TWOJ_CRON_SECRET` na to co wpisałeś w Vercel, np. `...?key=sh_8x42kfp9`)
   - **Schedule:** wybierz **„Every 1 minute"** (lub co 2-5 min jak wolisz)
   - **Request method:** `GET`
4. **Create** / **Save**

Gotowe. Od teraz co minutę cron.org sprawdza skrzynkę.

---

## ✅ KROK 3 — test (2 min)

1. Z innego adresu (np. Gmail) wyślij maila na **info@shistoria.it**
2. Poczekaj ~1 minutę (cron musi się odpalić)
3. Wejdź do panelu admin → zakładka **Messaggi** → wiadomość powinna się pojawić jako czat
4. Możesz też ręcznie sprawdzić wpisując w przeglądarce:
   ```
   https://www.shistoria.it/api/check-mail?key=TWOJ_CRON_SECRET
   ```
   Zobaczysz np. `{"ok":true,"fetched":1,"saved":1}` — `fetched` = ile maili znalazł, `saved` = ile zapisał.

---

## ❓ Najczęstsze problemy

| Komunikat | Co zrobić |
|---|---|
| `{"ok":false,"error":"unauthorized"}` | zły `key` w URL — musi pasować do `CRON_SECRET` w Vercel |
| `{"ok":false,"error":"IMAP_PASS non configurato"}` | nie dodałeś `IMAP_PASS` w Vercel albo nie zrobiłeś Redeploy |
| `IMAP login nieudany` | złe hasło/login skrzynki OVH |
| `fetched:0` ciągle | maile są już „przeczytane" — wyślij NOWY testowy mail (endpoint czyta tylko UNSEEN) |

---

## 💬 Czy to na pewno trafi do admina jako czat?
**Tak.** Wiadomości lądują w tabeli `contact_messages` z polem `email` = adres nadawcy.
Panel admin (Messaggi) czyta tę tabelę **na żywo (realtime)** i **grupuje po adresie e-mail** — czyli każdy klient = jeden wątek (klient po lewej, admin po prawej, jak WhatsApp).
Gdy ten sam klient napisze ponownie z tego samego adresu → dopisze się do istniejącego wątku.

> 📌 To zastępuje scenariusz IMAP w make.com. Możesz make.com w ogóle nie używać do odbierania — cron.org + ten endpoint robi to samo, częściej (co minutę) i za darmo.

---

## 🔁 (Opcjonalnie) Odpowiedź admina → e-mail do klienta
Gdy odpisujesz w panelu admin, strona wysyła webhook `admin_reply`. Żeby to dotarło do klienta jako e-mail,
potrzebny jest 1 prosty scenariusz wysyłki (make.com albo osobny endpoint + Resend). To osobny temat —
odbieranie (powyżej) działa niezależnie.
