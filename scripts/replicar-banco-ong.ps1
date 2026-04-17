param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("exportar", "importar")]
  [string]$Acao,

  [string]$Arquivo,

  [string]$MongoUri,

  [string]$MongoContainer,

  [switch]$Drop,

  [switch]$Forcar
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$EnvPath
  )

  if (-not (Test-Path $EnvPath)) {
    return $null
  }

  $line = Get-Content $EnvPath |
    Where-Object { $_ -match "^\s*$Key\s*=" } |
    Select-Object -First 1

  if (-not $line) {
    return $null
  }

  $raw = ($line -replace "^\s*$Key\s*=\s*", "").Trim()
  if ($raw.StartsWith('"') -and $raw.EndsWith('"')) {
    $raw = $raw.Trim('"')
  }
  if ($raw.StartsWith("'") -and $raw.EndsWith("'")) {
    $raw = $raw.Trim("'")
  }
  return $raw
}

function Ensure-Tool {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Ferramenta '$Name' nao encontrada. Instale MongoDB Database Tools e tente novamente."
  }
}

function Test-Tool {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-DbNameFromUri {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri
  )

  $clean = $Uri
  $queryIndex = $clean.IndexOf("?")
  if ($queryIndex -ge 0) {
    $clean = $clean.Substring(0, $queryIndex)
  }

  $lastSlash = $clean.LastIndexOf("/")
  if ($lastSlash -lt 0 -or $lastSlash -eq ($clean.Length - 1)) {
    return "ORES"
  }

  $db = $clean.Substring($lastSlash + 1).Trim()
  if ([string]::IsNullOrWhiteSpace($db)) {
    return "ORES"
  }

  return $db
}

function Resolve-MongoContainer {
  param(
    [string]$PreferredContainer
  )

  if (-not (Test-Tool -Name "docker")) {
    return $null
  }

  if (-not [string]::IsNullOrWhiteSpace($PreferredContainer)) {
    $exists = (& docker ps --format "{{.Names}}" | Where-Object { $_ -eq $PreferredContainer } | Select-Object -First 1)
    if ($exists) { return $PreferredContainer }
    throw "Container informado em -MongoContainer nao esta rodando: $PreferredContainer"
  }

  $rows = & docker ps --format "{{.Names}}|{{.Image}}"
  $mongoRows = $rows | Where-Object {
    $parts = $_ -split "\|", 2
    if ($parts.Count -lt 2) { return $false }
    $image = $parts[1].ToLowerInvariant()
    return $image -eq "mongo" -or $image.StartsWith("mongo:")
  }

  if (-not $mongoRows) {
    return $null
  }

  $preferred = $mongoRows | Where-Object {
    $name = ($_ -split "\|", 2)[0].ToLowerInvariant()
    return $name.Contains("ORES") -or $name.Contains("glpi")
  } | Select-Object -First 1

  if ($preferred) {
    return ($preferred -split "\|", 2)[0]
  }

  $mongoRow = $mongoRows | Select-Object -First 1
  return ($mongoRow -split "\|", 2)[0]
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $projectRoot ".env"

if ([string]::IsNullOrWhiteSpace($MongoUri)) {
  $MongoUri = Get-EnvValue -Key "MONGO_URI" -EnvPath $envPath
}

if ([string]::IsNullOrWhiteSpace($MongoUri)) {
  $MongoUri = "mongodb://127.0.0.1:27017/ORES?directConnection=true"
}

if ($Acao -eq "exportar") {
  if ([string]::IsNullOrWhiteSpace($Arquivo)) {
    $backupDir = Join-Path $projectRoot "backups"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $Arquivo = Join-Path $backupDir "ORES-$ts.archive.gz"
  } else {
    $parent = Split-Path $Arquivo -Parent
    if ($parent) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
  }

  Write-Host "Exportando dados do Mongo..." -ForegroundColor Cyan
  Write-Host "URI: $MongoUri"
  Write-Host "Arquivo: $Arquivo"
  $dumpDone = $false

  if (Test-Tool -Name "mongodump") {
    & mongodump "--uri=$MongoUri" "--archive=$Arquivo" "--gzip"
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao exportar o banco com mongodump local."
    }
    $dumpDone = $true
  } else {
    $container = Resolve-MongoContainer -PreferredContainer $MongoContainer
    if ($container) {
      $dbName = Get-DbNameFromUri -Uri $MongoUri
      $tmpArchive = "/tmp/ORES-export-$((Get-Date).ToString('yyyyMMdd-HHmmss')).archive.gz"

      Write-Host "mongodump local nao encontrado. Usando Docker (container: $container)." -ForegroundColor Yellow
      & docker exec $container mongodump "--db=$dbName" "--archive=$tmpArchive" "--gzip"
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao gerar dump no container Docker."
      }

      & docker cp "$container`:$tmpArchive" "$Arquivo"
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao copiar dump do container Docker para o host."
      }

      & docker exec $container rm -f $tmpArchive | Out-Null
      $dumpDone = $true
    }
  }

  if (-not $dumpDone) {
    throw "Nao encontrei mongodump local e nenhum container Mongo ativo. Instale MongoDB Database Tools ou suba um container mongo."
  }

  Write-Host ""
  Write-Host "Backup concluido com sucesso." -ForegroundColor Green
  Write-Host "Envie este arquivo para o seu amigo:"
  Write-Host $Arquivo -ForegroundColor Yellow
  exit 0
}

if ($Acao -eq "importar") {
  if ([string]::IsNullOrWhiteSpace($Arquivo)) {
    throw "Informe o caminho do backup em -Arquivo para importar."
  }

  if (-not (Test-Path $Arquivo)) {
    throw "Arquivo de backup nao encontrado: $Arquivo"
  }

  if (-not $Forcar) {
    Write-Warning "A importacao pode sobrescrever dados no destino."
    $answer = Read-Host "Digite SIM para continuar"
    if ($answer -ne "SIM") {
      throw "Importacao cancelada pelo usuario."
    }
  }

  Write-Host "Importando dados para o Mongo..." -ForegroundColor Cyan
  Write-Host "URI destino: $MongoUri"
  Write-Host "Arquivo: $Arquivo"
  if ($Drop) {
    Write-Host "Modo: --drop ativo (substitui dados das colecoes importadas)"
  }
  $restoreDone = $false

  if (Test-Tool -Name "mongorestore") {
    $args = @(
      "--uri=$MongoUri",
      "--archive=$Arquivo",
      "--gzip"
    )
    if ($Drop) {
      $args += "--drop"
    }
    & mongorestore @args
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao importar o banco com mongorestore local."
    }
    $restoreDone = $true
  } else {
    $container = Resolve-MongoContainer -PreferredContainer $MongoContainer
    if ($container) {
      $tmpArchive = "/tmp/ORES-import-$((Get-Date).ToString('yyyyMMdd-HHmmss')).archive.gz"
      Write-Host "mongorestore local nao encontrado. Usando Docker (container: $container)." -ForegroundColor Yellow

      & docker cp "$Arquivo" "$container`:$tmpArchive"
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao copiar backup para o container Docker."
      }

      $restoreArgs = @(
        "exec", $container,
        "mongorestore",
        "--archive=$tmpArchive",
        "--gzip"
      )
      if ($Drop) {
        $restoreArgs += "--drop"
      }
      & docker @restoreArgs
      if ($LASTEXITCODE -ne 0) {
        throw "Falha ao importar dump no container Docker."
      }

      & docker exec $container rm -f $tmpArchive | Out-Null
      $restoreDone = $true
    }
  }

  if (-not $restoreDone) {
    throw "Nao encontrei mongorestore local e nenhum container Mongo ativo. Instale MongoDB Database Tools ou suba um container mongo."
  }

  Write-Host ""
  Write-Host "Importacao concluida com sucesso." -ForegroundColor Green
  exit 0
}
