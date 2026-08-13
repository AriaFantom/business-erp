[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'setup', 'up', 'migrate', 'seed', 'ps', 'logs', 'down', 'help')]
  [string]$Command = 'start'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = $PSScriptRoot
$composeFile = Join-Path $projectRoot 'docker-compose.dev.yml'
$envFile = Join-Path $projectRoot '.env'
$envExample = Join-Path $projectRoot '.env.dev.example'

function Invoke-Checked {
  param(
    [Parameter(Mandatory)]
    [string]$FilePath,

    [string[]]$ArgumentList = @()
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

function Invoke-Compose {
  param([string[]]$ArgumentList = @())

  Invoke-Checked 'docker' (@('compose', '-f', $composeFile) + $ArgumentList)
}

function Assert-Command {
  param(
    [Parameter(Mandatory)]
    [string]$Name,

    [Parameter(Mandatory)]
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or is not on PATH. $InstallHint"
  }
}

function Assert-NodeToolchain {
  Assert-Command 'node' 'Install Node.js 24 or newer from https://nodejs.org/.'
  Assert-Command 'npm.cmd' 'Install Node.js 24 or newer from https://nodejs.org/.'

  $versionText = (& node --version).TrimStart('v')
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to determine the installed Node.js version.'
  }

  $nodeVersion = [version]$versionText
  if ($nodeVersion.Major -lt 24) {
    throw "Node.js 24 or newer is required; found v$versionText."
  }
}

function Assert-DockerToolchain {
  Assert-Command 'docker' 'Install and start Docker Desktop.'
  Invoke-Checked 'docker' @('compose', 'version')

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  & docker info *> $null
  $dockerInfoExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference

  if ($dockerInfoExitCode -ne 0) {
    throw 'Docker Desktop is installed, but its engine is not running. Start Docker Desktop and try again.'
  }
}

function New-AppKey {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  }
  finally {
    $generator.Dispose()
  }

  return [Convert]::ToBase64String($bytes)
}

function Initialize-Environment {
  if (Test-Path -LiteralPath $envFile) {
    return
  }

  if (-not (Test-Path -LiteralPath $envExample)) {
    throw '.env.dev.example was not found.'
  }

  Write-Host 'Creating .env from .env.dev.example...'
  $contents = [System.IO.File]::ReadAllText($envExample)
  $contents = [System.Text.RegularExpressions.Regex]::Replace(
    $contents,
    '(?m)^APP_KEY=.*$',
    "APP_KEY=$(New-AppKey)"
  )
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($envFile, $contents, $utf8WithoutBom)
  Write-Host 'Created .env with a generated development APP_KEY.'
}

function Initialize-Dependencies {
  if (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules')) {
    return
  }

  Write-Host 'Installing npm dependencies...'
  Invoke-Checked 'npm.cmd' @('install')
}

function Start-Infrastructure {
  Write-Host 'Starting PostgreSQL, Redis, MinIO, and InfluxDB...'
  Invoke-Compose @(
    'up', '-d', '--wait',
    'postgres', 'redis', 'minio', 'influxdb'
  )

  Write-Host 'Ensuring the MinIO development bucket exists...'
  Invoke-Compose @('run', '--rm', '--no-deps', 'createbuckets')
}

function Initialize-Application {
  Assert-NodeToolchain
  Initialize-Environment
  Initialize-Dependencies
}

function Start-Application {
  Write-Host 'Starting the AdonisJS and Vite development servers...'
  Write-Host 'Press Ctrl+C to stop the app. Development containers will keep running.'
  Invoke-Checked 'npm.cmd' @('run', 'dev')
}

function Show-Help {
  Write-Host @'
Windows development helper

Usage:
  .\dev.ps1             Start the dev containers and run the app with npm
  .\dev.ps1 setup       First-time setup: start, migrate, seed, and run the app
  .\dev.ps1 up          Start only the dev containers
  .\dev.ps1 migrate     Start containers and run pending migrations
  .\dev.ps1 seed        Start containers and run the development seeders
  .\dev.ps1 ps          Show dev container status
  .\dev.ps1 logs        Follow dev container logs
  .\dev.ps1 down        Stop dev containers without deleting their data
  .\dev.ps1 help        Show this help

If PowerShell blocks local scripts, run:
  powershell -ExecutionPolicy Bypass -File .\dev.ps1 setup

The app runs directly on Windows. Only PostgreSQL, Redis, MinIO, and InfluxDB
run in Docker. An existing .env is always preserved.
'@
}

Push-Location $projectRoot
try {
  switch ($Command) {
    'help' {
      Show-Help
    }
    'ps' {
      Assert-DockerToolchain
      Invoke-Compose @('ps')
    }
    'logs' {
      Assert-DockerToolchain
      Invoke-Compose @('logs', '-f', '--tail=200')
    }
    'down' {
      Assert-DockerToolchain
      Invoke-Compose @('down')
    }
    'up' {
      Assert-DockerToolchain
      Start-Infrastructure
      Invoke-Compose @('ps')
    }
    'migrate' {
      Assert-DockerToolchain
      Initialize-Application
      Start-Infrastructure
      Invoke-Checked 'node' @('ace', 'migration:run')
    }
    'seed' {
      Assert-DockerToolchain
      Initialize-Application
      Start-Infrastructure
      Invoke-Checked 'node' @('ace', 'db:seed')
    }
    'setup' {
      Assert-DockerToolchain
      Initialize-Application
      Start-Infrastructure
      Invoke-Checked 'node' @('ace', 'migration:run')
      Invoke-Checked 'node' @('ace', 'db:seed')
      Start-Application
    }
    'start' {
      Assert-DockerToolchain
      Initialize-Application
      Start-Infrastructure
      Start-Application
    }
  }
}
catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}
