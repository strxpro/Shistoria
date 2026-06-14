# ============================================================================
#  S'HISTORIA — TEST WSZYSTKICH MAILI (make.com) BEZ CZEKANIA
#  Uruchamianie: prawym na plik > "Run with PowerShell"  ALBO w terminalu:
#     powershell -ExecutionPolicy Bypass -File scripts\test-emails.ps1
#  Potem wpisz numer testu (1-6). Maile lecą od razu (pod warunkiem, ze
#  dany scenariusz w make jest WLACZONY/ON i ma zmapowane pola *_html).
# ============================================================================

# --- 1) USTAW SWOJ EMAIL (tu przyjda testy) ---------------------------------
$EMAIL = "TWOJ@email.com"          # <<< ZMIEN NA SWOJ ADRES
$NAME  = "Mario"
$LANG  = "it"                       # it | pl | en | de | fr | es

# --- 2) WEBHOOKI (baza make.com) --------------------------------------------
$BASE        = "https://hook.eu1.make.com/"
$WH_WINNER   = $BASE + "1u05fm2tbvepewxonnnl89vdihslu9gu"   # Drink del Mese/Settimana
$WH_EVENT    = $BASE + "4swpubn6ixliy7w2j77kxhyc9e6s1lfz"   # Eventy (przypomnienia)
$WH_REPLY    = $BASE + "z9kyy3i4xmtug5vknp7vff5udnd2rnf1"   # Odpowiedz z admina
$WH_NEWS     = $BASE + "lqnvmsdrxchdb954pzosqh6ccwp6l8as"   # Newsletter / broadcast / recenzje

# --- gotowy HTML (zeby make mial co wyslac przy tescie z PowerShell) ---------
function HtmlCard($title, $body) {
@"
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#12171e;color:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.1)">
  <div style="background:linear-gradient(135deg,#E8927C,#b5651d);padding:26px 24px"><h1 style="margin:0;font-size:22px;color:#fff">S'Historia</h1></div>
  <div style="padding:26px 24px">
    <h2 style="margin:0 0 12px;font-size:20px;color:#E8927C">$title</h2>
    <p style="margin:0 0 16px;line-height:1.6;color:#dfe6ee">$body</p>
    <p style="font-size:12px;color:#8b97a5;margin-top:22px">TEST — S'Historia · www.shistoria.it</p>
  </div>
</div>
"@
}

function Post($url, $obj, $label) {
  Write-Host "`n--> Wysylam: $label" -ForegroundColor Cyan
  try {
    $json = $obj | ConvertTo-Json -Depth 8
    $r = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" -Body $json
    Write-Host "    OK (make odpowiedzial: $r)" -ForegroundColor Green
  } catch {
    Write-Host "    BLAD: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# ============================================================================
#  TESTY
# ============================================================================

# 1) DRINK DEL MESE / SETTIMANA (zwyciezca + 1 odbiorca)
function Test-Winner {
  $winHtml = HtmlCard "Hai vinto il Drink del Mese!" "Complimenti $NAME! Il tuo drink ha vinto. Mostra il QR al barman per un drink GRATIS. Codice: SH-TEST1"
  $othHtml = HtmlCard "Scopri il Drink del Mese" "Il vincitore di questo mese e' stato scelto! Vieni a provarlo a S'Historia."
  $body = @{
    type = "winner_announcement"; period = "month"
    winner_drink = "Tramonto Siciliano"; winner_author = $NAME
    winner_email = $EMAIL; winner_lang = $LANG
    winner_code = "SH-TEST1"; reward_url = "https://www.shistoria.it/reward/SH-TEST1"
    winner_email_subject = "Hai vinto il Drink del Mese! (TEST)"
    winner_email_html = $winHtml
    recipients = @(
      @{ email = $EMAIL; name = $NAME; lang = $LANG; email_subject = "Scopri il Drink del Mese (TEST)"; email_html = $othHtml }
    )
    link = "https://www.shistoria.it/#ready-drinks"
  }
  Post $WH_WINNER $body "Drink del Mese (zwyciezca + odbiorca)"
}

# 2) EVENT — przypomnienie "3 dni" i "5 godzin" (od razu, bez czekania)
function Test-Event {
  $h3 = HtmlCard "Tra 3 giorni: Serata Jazz" "Ciao $NAME, tra 3 giorni ci vediamo a S'Historia per la Serata Jazz. Ti aspettiamo!"
  $h5 = HtmlCard "Tra poche ore: Serata Jazz" "Ciao $NAME, manca poco! La Serata Jazz inizia tra qualche ora. A presto!"
  $body = @{
    type = "event_reminder"; name = $NAME; email = $EMAIL; lang = $LANG
    event_title = "Serata Jazz (TEST)"
    event_date = (Get-Date).AddHours(72).ToString("yyyy-MM-ddTHH:mm:ss")
    event_description = "Serata di test"
    remind_days_before = 3; remind_hours_before = 5
    email_subject_3d = "Tra 3 giorni: Serata Jazz (TEST)"; email_html_3d = $h3
    email_subject_5h = "Tra poche ore: Serata Jazz (TEST)"; email_html_5h = $h5
  }
  Post $WH_EVENT $body "Event reminder (zapis do Data Store + maile 3d/5h)"
  Write-Host "    UWAGA: w make scenariusz A zapisze rekord; zeby wyslac mail" -ForegroundColor Yellow
  Write-Host "    od razu, w scenariuszu B (cyklicznym) kliknij 'Run once'." -ForegroundColor Yellow
}

# 3) ODPOWIEDZ Z ADMINA (admin_reply)
function Test-Reply {
  $body = @{
    type = "admin_reply"; email = $EMAIL; name = $NAME; lang = $LANG
    reply_subject = "Risposta da S'Historia (TEST)"
    reply_html = (HtmlCard "Risposta da S'Historia" "Ciao $NAME, grazie per il tuo messaggio! Questa e' una risposta di test.")
    reply_text = "Ciao $NAME, grazie per il tuo messaggio!"
  }
  Post $WH_REPLY $body "Odpowiedz z admina"
}

# 4) NEWSLETTER — zapis (mail powitalny)
function Test-NewsSignup {
  $body = @{
    type = "newsletter_signup"; email = $EMAIL; name = $NAME; lang = $LANG
    email_subject = "Benvenuto nella newsletter S'Historia (TEST)"
    email_html = (HtmlCard "Benvenuto!" "Grazie $NAME per esserti iscritto alla newsletter di S'Historia.")
  }
  Post $WH_NEWS $body "Newsletter signup (mail powitalny)"
}

# 5) NEWSLETTER BROADCAST — do wszystkich (tu 1 odbiorca testowy)
function Test-Broadcast {
  $body = @{
    type = "newsletter_broadcast"; kind = "drink"; title = "Nuovo drink!"
    recipients = @(
      @{ email = $EMAIL; name = $NAME; lang = $LANG; email_subject = "Novita da S'Historia (TEST)"; email_html = (HtmlCard "Novita!" "C'e' un nuovo drink da provare a S'Historia.") }
    )
  }
  Post $WH_NEWS $body "Newsletter broadcast (Iterator recipients)"
}

# 6) RECENZJA — podziekowanie za opinie
function Test-Review {
  $body = @{
    type = "review_thankyou"; name = $NAME; email = $EMAIL; lang = $LANG
    content = "Bellissimo posto!"; stars = 5
    email_subject = "Grazie per la tua opinione (TEST)"
    email_html = (HtmlCard "Grazie!" "Grazie $NAME per la tua recensione a 5 stelle!")
  }
  Post $WH_NEWS $body "Recenzja (podziekowanie)"
}

# ============================================================================
#  MENU
# ============================================================================
if ($EMAIL -eq "TWOJ@email.com") {
  Write-Host "`n!!! Najpierw otworz ten plik i zmien `$EMAIL na swoj adres !!!`n" -ForegroundColor Red
  return
}

Write-Host "`n=== S'HISTORIA — TEST MAILI ===" -ForegroundColor Magenta
Write-Host "Email docelowy: $EMAIL  (jezyk: $LANG)`n"
Write-Host " 1) Drink del Mese (zwyciezca + odbiorca)"
Write-Host " 2) Event (przypomnienie 3 dni / 5 godzin)"
Write-Host " 3) Odpowiedz z admina"
Write-Host " 4) Newsletter — zapis (mail powitalny)"
Write-Host " 5) Newsletter — broadcast do wszystkich"
Write-Host " 6) Recenzja — podziekowanie"
Write-Host " 9) WSZYSTKO po kolei"
$c = Read-Host "`nWybierz numer"
switch ($c) {
  "1" { Test-Winner }
  "2" { Test-Event }
  "3" { Test-Reply }
  "4" { Test-NewsSignup }
  "5" { Test-Broadcast }
  "6" { Test-Review }
  "9" { Test-Winner; Test-Event; Test-Reply; Test-NewsSignup; Test-Broadcast; Test-Review }
  default { Write-Host "Nieznany wybor." -ForegroundColor Yellow }
}
Write-Host "`nGotowe. Sprawdz skrzynke ($EMAIL) i folder SPAM." -ForegroundColor Green
