param(
  [switch]$Build
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($PSVersionTable.PSVersion.Major -ge 7) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvPath = Join-Path $ProjectRoot ".env"
$EnvExamplePath = Join-Path $ProjectRoot ".env.example"
$PublicUrl = "https://sistema.institutoORES.ong.br/login"
$LocalUrl = "http://localhost:8080/login"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-WarnLine {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Write-SuccessLine {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Green
}

function Get-EnvMap {
  param([string]$Path)

  $map = @{}
  if (-not (Test-Path $Path)) {
    return $map
  }

  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1)
    $map[$key] = $value
  }

  return $map
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $lines = @()
  if (Test-Path $Path) {
    $lines = Get-Content $Path
  }

  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].StartsWith("$Key=")) {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $lines -Encoding ascii
}

function New-HexSecret {
  param([int]$Bytes = 24)

  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return ([BitConverter]::ToString($buffer)).Replace("-", "").ToLowerInvariant()
}

function Ensure-DockerCommand {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker nao foi encontrado. Instale o Docker Desktop e tente novamente."
  }
}

function Test-DockerReady {
  cmd /c "docker info >nul 2>nul"
  return ($LASTEXITCODE -eq 0)
}

function Ensure-DockerReady {
  Ensure-DockerCommand

  if (Test-DockerReady) {
    return
  }

  $dockerDesktopPath = Join-Path ${env:ProgramFiles} "Docker\Docker\Docker Desktop.exe"
  if (Test-Path $dockerDesktopPath) {
    Write-Step "Abrindo o Docker Desktop e aguardando o engine ficar disponivel..."
    Start-Process $dockerDesktopPath | Out-Null
  } else {
    throw "Docker instalado, mas o engine nao esta respondendo. Abra o Docker Desktop e tente novamente."
  }

  for ($attempt = 1; $attempt -le 60; $attempt++) {
    Start-Sleep -Seconds 2
    if (Test-DockerReady) {
      return
    }
  }

  throw "O Docker nao ficou pronto a tempo. Abra o Docker Desktop manualmente e rode o script de novo."
}

function Ensure-ComposeAvailable {
  cmd /c "docker compose version >nul 2>nul"
  if ($LASTEXITCODE -ne 0) {
    throw "O plugin 'docker compose' nao esta disponivel nessa maquina."
  }
}

function Ensure-EnvFile {
  $createdEnv = $false
  if (-not (Test-Path $EnvPath)) {
    if (-not (Test-Path $EnvExamplePath)) {
      throw "Nao encontrei .env nem .env.example para preparar a configuracao inicial."
    }

    Write-Step "Criando o .env inicial a partir do .env.example..."
    Copy-Item $EnvExamplePath $EnvPath
    $createdEnv = $true
  }

  $envMap = Get-EnvMap $EnvPath

  if (-not $envMap.ContainsKey("AMBIENTE") -or [string]::IsNullOrWhiteSpace($envMap["AMBIENTE"])) {
    Set-EnvValue -Path $EnvPath -Key "AMBIENTE" -Value "DEV"
  }

  if (
    -not $envMap.ContainsKey("PASSWORD_PEPPER") -or
    [string]::IsNullOrWhiteSpace($envMap["PASSWORD_PEPPER"]) -or
    $envMap["PASSWORD_PEPPER"] -eq "troque-por-um-segredo-longo"
  ) {
    Set-EnvValue -Path $EnvPath -Key "PASSWORD_PEPPER" -Value (New-HexSecret)
  }

  $envMap = Get-EnvMap $EnvPath
  if (
    -not $envMap.ContainsKey("CLOUDFLARE_TUNNEL_TOKEN") -or
    [string]::IsNullOrWhiteSpace($envMap["CLOUDFLARE_TUNNEL_TOKEN"])
  ) {
    Write-WarnLine ""
    Write-WarnLine "Falta configurar o token do Cloudflare Tunnel para publicar no dominio fixo."
    $token = Read-Host "Cole o token do tunel e pressione Enter"
    if ([string]::IsNullOrWhiteSpace($token)) {
      throw "O token do Cloudflare Tunnel e obrigatorio para subir no dominio publico."
    }

    Set-EnvValue -Path $EnvPath -Key "CLOUDFLARE_TUNNEL_TOKEN" -Value $token.Trim()
  }

  if ($createdEnv) {
    Write-Step "Arquivo .env inicial criado com configuracao pronta para subir em qualquer maquina."
  }
}

function Start-ComposeStack {
  $composeArgs = @("compose", "--profile", "public", "up", "-d", "--remove-orphans")
  if ($Build) {
    $composeArgs += "--build"
  }

  Write-Step "Subindo os containers do ORES..."
  & docker @composeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao subir os containers com docker compose."
  }

  Write-Step "Recarregando o nginx para atualizar o destino interno do app..."
  & docker compose restart nginx
}

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$MaxAttempts = 40,
    [int]$DelaySeconds = 3
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds $DelaySeconds
      continue
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  return $false
}

Push-Location $ProjectRoot
try {
  Write-Step "Validando Docker..."
  Ensure-DockerReady
  Ensure-ComposeAvailable

  Write-Step "Conferindo configuracao local..."
  Ensure-EnvFile

  Start-ComposeStack

  Write-Step "Aguardando o ORES responder em localhost..."
  $localReady = Wait-HttpReady -Url $LocalUrl

  if ($localReady) {
    Write-SuccessLine "Sistema local respondeu com sucesso."
  } else {
    Write-WarnLine "O sistema demorou mais que o esperado para responder localmente."
  }

  Write-Step "Status atual dos containers:"
  & docker compose ps

  Write-Host ""
  Write-SuccessLine "ORES pronto para uso."
  Write-Host "Local:   $LocalUrl"
  Write-Host "Publico: $PublicUrl"
  Write-Host ""
  Write-Host "Se for a primeira subida em outra maquina, o script ja salvou o token no .env."
} finally {
  Pop-Location
}
