# OpenGitDesktop installer for Windows 10 / 11 (x64).
#
#   irm https://raw.githubusercontent.com/CariSoftwareBR/OpenGitDesktop/main/install.ps1 | iex
#
# Installs Git if it is missing (winget), downloads the latest release installer,
# runs it silently per user (no admin prompt) and opens the app.
# Set OPENGITDESKTOP_NO_LAUNCH=1 to install without opening the app.

& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is far slower with the progress bar
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $repo = 'CariSoftwareBR/OpenGitDesktop'

  if ([Environment]::Is64BitOperatingSystem -eq $false) {
    Write-Host 'OpenGitDesktop needs 64-bit Windows.' -ForegroundColor Red
    return
  }

  # 1. Git is required: the app uses the Git installed on the system.
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
      Write-Host '==> Installing Git (winget)...'
      winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    } else {
      Write-Host '==> Git not found. Install it from https://git-scm.com/download/win (the app needs it).' -ForegroundColor Yellow
    }
  }

  # 2. Download the latest installer.
  Write-Host '==> Finding the latest release...'
  $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'opengitdesktop-install' }
  $asset = $rel.assets | Where-Object { $_.name -like 'OpenGitDesktop-Setup-*.exe' } | Select-Object -First 1
  if (-not $asset) { throw "Release $($rel.tag_name) has no Windows installer." }

  $exe = Join-Path $env:TEMP $asset.name
  Write-Host "==> Downloading $($asset.name)..."
  Invoke-WebRequest $asset.browser_download_url -OutFile $exe -UseBasicParsing
  Unblock-File $exe

  # 3. Silent per-user install.
  Write-Host '==> Installing...'
  Start-Process $exe -ArgumentList '/S' -Wait
  Remove-Item $exe -ErrorAction SilentlyContinue

  $app = Get-ChildItem "$env:LOCALAPPDATA\Programs" -Filter 'OpenGitDesktop.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $app) { throw 'The installer finished, but OpenGitDesktop.exe was not found.' }
  Write-Host "==> OpenGitDesktop $($rel.tag_name) installed: $($app.FullName)" -ForegroundColor Green

  # 4. Open the app.
  if ($env:OPENGITDESKTOP_NO_LAUNCH -ne '1') { Start-Process $app.FullName }
}
