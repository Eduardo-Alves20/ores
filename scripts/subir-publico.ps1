param(
  [switch]$Build
)

& (Join-Path $PSScriptRoot "iniciar-alento.ps1") -Build:$Build
exit $LASTEXITCODE
