param(
  [switch]$Build
)

& (Join-Path $PSScriptRoot "iniciar-ORES.ps1") -Build:$Build
exit $LASTEXITCODE
