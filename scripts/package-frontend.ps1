#Requires -Version 5.1
<#
  Zip frontend source (no node_modules / build output). Writes zip to project root.
  From repo root:
    .\scripts\package-frontend.ps1
    npm run package:zip
  Optional:
    -OutputName  default: ai-shopping-assistant-h5-source.zip
#>
param(
  [string]$OutputName = "ai-shopping-assistant-h5-source.zip"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$staging = Join-Path $env:TEMP "h5-export-$stamp"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
  $robocopyArgs = @(
    $ProjectRoot,
    $staging,
    "/E",
    "/XD", "node_modules", ".next", "out", "dist", ".git", "coverage", ".turbo", ".vercel", ".cursor",
    "/XF", "*.zip",
    "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/NP"
  )
  & robocopy @robocopyArgs
  $rc = $LASTEXITCODE
  if ($rc -gt 7) {
    throw "robocopy failed with exit code $rc"
  }

  $zipPath = Join-Path $ProjectRoot $OutputName
  if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
  }

  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force

  $sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
  Write-Host ""
  Write-Host "OK: $zipPath ($sizeMb MB)" -ForegroundColor Green
  Write-Host "Next: extract, then npm install and npm run build"
}
finally {
  if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
  }
}
