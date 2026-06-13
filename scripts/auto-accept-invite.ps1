# Auto-akceptacja zaproszenia Google Business Profile dla bota.
# Uruchamiany cyklicznie (Harmonogram zadań Windows). Gdy Google w koncu
# przyzna dostep do API (kwota > 0), ten skrypt sam zaakceptuje zaproszenie
# i zapisze wynik do logu. Do tego czasu loguje "jeszcze brak dostepu" i konczy.
#
# Bezpieczny do wielokrotnego uruchamiania: gdy zaproszenie zostanie raz
# przyjete, kolejne uruchomienia po prostu nie znajda nic do zrobienia.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot          # katalog projektu
$log  = Join-Path $PSScriptRoot "invite-accept.log"
$stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

function Write-Log($msg) { Add-Content -Path $log -Value "[$stamp] $msg" }

try {
  # node musi byc w PATH; skrypt accept-google-invite.cjs robi cala robote
  $out = & node (Join-Path $PSScriptRoot "accept-google-invite.cjs") 2>&1 | Out-String
  Write-Log ($out.Trim())

  if ($out -match "ZAAKCEPTOWANO") {
    Write-Log "SUKCES: zaproszenie przyjete. Mozesz usunac zaplanowane zadanie."
  }
  elseif ($out -match "Quota exceeded|has not been used|disabled|PERMISSION_DENIED") {
    Write-Log "Jeszcze brak dostepu do API (kwota 0 / brak zgody). Sprobuje ponownie nastepnym razem."
  }
}
catch {
  Write-Log ("BLAD: " + $_.Exception.Message)
}
