# ============================================================================
#  S'HISTORIA - "NAKARM" WEBHOOKI make.com (Run once / Determine data structure)
#  Uruchom z folderu projektu:
#     powershell -ExecutionPolicy Bypass -File scripts\feed-webhooks.ps1
#
#  PO CO: zeby make poznal WSZYSTKIE pola (w tym email_html_3d / email_html_5h),
#  trzeba raz wyslac kompletny payload, gdy webhook jest w trybie "Run once".
#
#  KOLEJNOSC:
#   1) W make otworz scenariusz i kliknij moduł Webhook -> "Run once"
#      (albo "Redetermine data structure"). make czeka na dane.
#   2) Odpal ten skrypt i wybierz numer (1 = event, 2 = komentarz).
#   3) make pokaze "successfully determined" i zna juz wszystkie pola.
# ============================================================================

$NAME  = "Mario"
$EMAIL = "test@shistoria.it"
$LANG  = "it"

# --- WEBHOOKI ---------------------------------------------------------------
$WH_EVENT   = "https://hook.eu1.make.com/4swpubn6ixliy7w2j77kxhyc9e6s1lfz"   # eventy (zapis do Data Store)
# URL komentarzy ZOSTAW pusty - skrypt poprosi o wklejenie (kopiuj DOKLADNIE z modulu
# Webhook w make -> "Copy address to clipboard"), zeby nie bylo literowki.
$WH_COMMENT = ""

function HtmlCard($title, $body) {
  $h = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#12303f;color:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.12)">'
  $h += '<div style="background:linear-gradient(135deg,#E8927C,#5BB8D4);padding:24px"><h1 style="margin:0;font-size:22px;color:#1a1014">S Historia</h1></div>'
  $h += '<div style="padding:26px 24px">'
  $h += ('<h2 style="margin:0 0 12px;color:#E8927C">' + $title + '</h2>')
  $h += ('<p style="line-height:1.6;color:#e7eef3">' + $body + '</p>')
  $h += '<a href="https://www.shistoria.it/#eventi" style="display:inline-block;margin-top:14px;background:#E8927C;color:#1a1014;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:999px">Vedi evento</a>'
  $h += '</div></div>'
  return $h
}

function Post($url, $obj, $label) {
  Write-Host ""
  Write-Host ("--> Wysylam: " + $label) -ForegroundColor Cyan
  Write-Host ("    URL: " + $url) -ForegroundColor DarkGray
  try {
    $json = $obj | ConvertTo-Json -Depth 8
    $r = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" -Body $json
    Write-Host ("    OK (make odpowiedzial: " + $r + ")") -ForegroundColor Green
  } catch {
    Write-Host ("    BLAD: " + $_.Exception.Message) -ForegroundColor Red
  }
}

# 1) EVENT - pelny payload (wszystkie pola, ktore wysyla strona) -------------
function Feed-Event {
  $h3 = HtmlCard "Tra 3 giorni: Serata Test" ("Ciao " + $NAME + ", tra 3 giorni ci vediamo per la Serata Test.")
  $h5 = HtmlCard "Tra poche ore: Serata Test" ("Ciao " + $NAME + ", manca poco! La Serata Test inizia tra qualche ora.")
  $body = @{
    type               = "event_reminder"
    source             = "shistoria.it"
    ts                 = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    name               = $NAME
    email              = $EMAIL
    lang               = $LANG
    event_title        = "Serata Test"
    event_date         = (Get-Date).AddHours(72).ToString("yyyy-MM-ddTHH:mm:ss")
    event_description  = "Serata di test"
    remind_days_before = 3
    remind_hours_before= 5
    email_subject_3d   = "Tra 3 giorni: Serata Test"
    email_html_3d      = $h3
    email_subject_5h   = "Tra poche ore: Serata Test"
    email_html_5h      = $h5
  }
  Post $WH_EVENT $body "EVENT (pelny payload: 3d + 5h + HTML)"
}

# 2) KOMENTARZ - payload jaki wysyla strona (notifyComment) ------------------
function Feed-Comment {
  if ([string]::IsNullOrWhiteSpace($WH_COMMENT)) {
    $script:WH_COMMENT = (Read-Host "Wklej URL webhooka KOMENTARZY z make (Copy address to clipboard)").Trim()
  }
  if ([string]::IsNullOrWhiteSpace($WH_COMMENT)) { Write-Host "Brak URL - pomijam." -ForegroundColor Yellow; return }
  $body = @{
    type       = "new_comment"
    source     = "shistoria.it"
    ts         = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
    drink_id   = "00000000-0000-0000-0000-000000000000"
    drink_name = "Tramonto Siciliano"
    author     = $NAME
    content    = "Bellissimo drink! Complimenti."
    lang       = $LANG
  }
  Post $WH_COMMENT $body "KOMENTARZ (type=new_comment)"
}

# ============================================================================
Write-Host ""
Write-Host "=== NAKARM WEBHOOKI (najpierw 'Run once' w make!) ===" -ForegroundColor Magenta
Write-Host " 1) Event    -> $WH_EVENT"
Write-Host " 2) Komentarz -> (URL wkleisz po wyborze 2)"
Write-Host " 9) Oba po kolei"
$c = Read-Host "`nWybierz numer (1/2/9)"
switch ($c) {
  "1" { Feed-Event }
  "2" { Feed-Comment }
  "9" { Feed-Event; Feed-Comment }
  default { Write-Host "Nieznany wybor." -ForegroundColor Yellow }
}
Write-Host ""
Write-Host "Gotowe. W make sprawdz, czy webhook pokazal 'successfully determined'." -ForegroundColor Green
Write-Host "Teraz w modulach mozesz przypisac pola: email_html_3d, email_html_5h itd." -ForegroundColor Green
