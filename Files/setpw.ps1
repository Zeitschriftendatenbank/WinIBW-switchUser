param(
    [string]$file,
    [string]$pwd
)
$ErrorActionPreference = 'Stop'

try {
    $file = [Environment]::ExpandEnvironmentVariables($file)
    $secure = $null

    $dir = Split-Path -Parent $file
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
    }

    if ([string]::IsNullOrEmpty($pwd)) {
        $secure = Read-Host "Passwort" -AsSecureString
    } else {
        $secure = ConvertTo-SecureString $pwd -AsPlainText -Force
    }

    $encrypted = ConvertFrom-SecureString $secure
    $encrypted | Set-Content $file

    Write-Output $true
    exit 0
} catch {
    Write-Error $_
    Write-Output $false
    exit 1
}