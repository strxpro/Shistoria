# ============================================================================
#  S'HISTORIA - DIAGNOSTYKA WEBHOOKOW make.com
#  Uruchom (z folderu projektu):
#     powershell -ExecutionPolicy Bypass -File scripts\check-webhooks.ps1
#
#  Co robi:
#   1) Pokazuje webhooki uzywane przez strone i do czego sluza.
#   2) Sprawdza podany URL - czy to ktorys ze znanych webhookow strony.
#   3) Wysyla poprawny, ostylowany test eventu (pelny HTML) na webhook eventow.
# ============================================================================

$EMAIL = "TWOJ@email.com"   # <<< ZMIEN na swoj adres (tu przyjdzie test)
$NAME  = "Mario"
$LANG  = "it"

$BASE = "https://hook.eu1.make.com/"

# --- Webhooki uzywane przez strone (te same, ktore wpisujesz w Vercel) -------
$KNOWN = [ordered]@{
  "NEXT_PUBLIC_MAKE_WINNER_WEBHOOK"     = "1u05fm2tbvepewxonnnl89vdihslu9gu"
  "NEXT_PUBLIC_MAKE_EVENT_WEBHOOK"      = "4swpubn6ixliy7w2j77kxhyc9e6s1lfz"
  "NEXT_PUBLIC_MAKE_REPLY_WEBHOOK"      = "z9kyy3i4xmtug5vknp7vff5udnd2rnf1"
  "NEXT_PUBLIC_MAKE_NEWSLETTER_WEBHOOK" = "lqnvmsdrxchdb954pzosqh6ccwp6l8as"
}

# --- URL ktory chcesz sprawdzic ---------------------------------------------
$CHECK_URL = "https://hook.eu1.make.com/ieeo3nyorpo6otmkv64ucdbndr4ho0pvi"

function Identify($url) {
  $id = ($url -replace [regex]::Escape($BASE), "").Trim("/")
  $hit = $null
  foreach ($k in $KNOWN.Keys) { if ($KNOWN[$k] -eq $id) { $hit = $k; break } }
  Write-Host ""
  Write-Host "=== SPRAWDZAM URL ===" -ForegroundColor Magenta
  Write-Host ("  " + $url)
  if ($hit) {
    Write-Host ("  -> UZYWANY przez strone jako: " + $hit) -ForegroundColor Green
  } else {
    Write-Host "  -> NIE jest zadnym z 4 znanych webhookow strony." -ForegroundColor Yellow
    Write-Host "     To osobny scenariusz (np. komentarze albo kontakt)," -ForegroundColor Yellow
    Write-Host "     ustawiony w Vercel jako jedna z tych zmiennych:" -ForegroundColor Yellow
    Write-Host "       NEXT_PUBLIC_MAKE_COMMENT_WEBHOOK   (komentarze)" -ForegroundColor Yellow
    Write-Host "       NEXT_PUBLIC_MAKE_CONTACT_WEBHOOK   (formularz rezerwacji)" -ForegroundColor Yellow
    Write-Host "       NEXT_PUBLIC_MAKE_DRINK_WEBHOOK     (share drinka)" -ForegroundColor Yellow
    Write-Host "     Sprawdz: Vercel -> Settings -> Environment Variables." -ForegroundColor Yellow
  }
}

function Post($url, $obj, $label) {
  Write-Host ""
  Write-Host ("--> Wysylam: " + $label) -ForegroundColor Cyan
  try {
    $json = $obj | ConvertTo-Json -Depth 8
    $r = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" -Body $json
    Write-Host ("    OK (make odpowiedzial: " + $r + ")") -ForegroundColor Green
  } catch {
    Write-Host ("    BLAD: " + $_.Exception.Message) -ForegroundColor Red
  }
}

# Pelny, ostylowany HTML - to, co strona wysyla jako email_html_5h.
function HtmlEvent($title, $body) {
  $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#12303f;color:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12)">'
  $html += '<div style="background:linear-gradient(135deg,#E8927C,#5BB8D4);padding:26px 24px"><h1 style="margin:0;font-size:22px;color:#1a1014">S Historia</h1></div>'
  $html += '<div style="padding:28px 24px">'
  $html += ('<h2 style="margin:0 0 12px;font-size:21px;color:#E8927C">' + $title + '</h2>')
  $html += ('<p style="margin:0 0 16px;line-height:1.6;color:#e7eef3">' + $body + '</p>')
  $html += '<a href="https://www.shistoria.it/#eventi" style="display:inline-block;background:#E8927C;color:#1a1014;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:999px">Vedi evento</a>'
  $html += '<p style="font-size:12px;color:#9fb2bf;margin-top:22px">TEST stylu - S Historia - www.shistoria.it</p>'
  $html += '</div></div>'
  return $html
}

function Test-EventStyled {
  $h3 = HtmlEvent "Tra 3 giorni: Serata Test" ("Ciao " + $NAME + ", tra 3 giorni ci vediamo per la Serata Test.")
  $h5 = HtmlEvent "Tra poche ore: Serata Test" ("Ciao " + $NAME + ", manca poco! La Serata Test inizia tra qualche ora.")
  $body = @{
    type = "event_reminder"; name = $NAME; email = $EMAIL; lang = $LANG
    event_title = "Serata Test"
    event_date = (Get-Date).AddHours(72).ToString("yyyy-MM-ddTHH:mm:ss")
    event_description = "Serata di test"
    remind_days_before = 3; remind_hours_before = 5
    email_subject_3d = "Tra 3 giorni: Serata Test"; email_html_3d = $h3
    email_subject_5h = "Tra poche ore: Serata Test"; email_html_5h = $h5
  }
  Post ($BASE + $KNOWN["NEXT_PUBLIC_MAKE_EVENT_WEBHOOK"]) $body "Event reminder (PELNY HTML 3d + 5h)"
  Write-Host ""
  Write-Host "  WAZNE: ten webhook tylko ZAPISUJE rekord do Data Store (scenariusz A)." -ForegroundColor Yellow
  Write-Host "  Zeby mail poszedl OD RAZU: w make otworz scenariusz B (cykliczny)" -ForegroundColor Yellow
  Write-Host "  i kliknij 'Run once'." -ForegroundColor Yellow
}

# ============================================================================
#  START
# ============================================================================
Write-Host ""
Write-Host "=== WEBHOOKI UZYWANE PRZEZ STRONE ===" -ForegroundColor Magenta
foreach ($k in $KNOWN.Keys) { Write-Host ("  " + $k.PadRight(38) + " " + $BASE + $KNOWN[$k]) }

Identify $CHECK_URL

if ($EMAIL -eq "TWOJ@email.com") {
  Write-Host ""
  Write-Host "(Test maila pominiety - zmien `$EMAIL na gorze pliku, by wyslac test.)" -ForegroundColor DarkYellow
  return
}

Write-Host ""
Write-Host ("Wyslac testowy, ostylowany event na " + $EMAIL + " ? (T/N)") -ForegroundColor Cyan
if ((Read-Host) -match '^[TtYy]') { Test-EventStyled }
Write-Host ""
Write-Host "Gotowe. Sprawdz skrzynke (i SPAM)." -ForegroundColor Green
