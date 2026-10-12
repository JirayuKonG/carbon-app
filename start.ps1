param([ValidateSet('All','Backend','Frontend')][string]$Mode = 'All')
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if ($Mode -eq 'Backend') { npm.cmd run start:dev --workspace=backend }
    elseif ($Mode -eq 'Frontend') { npm.cmd run dev --workspace=frontend }
    else { npm.cmd run dev }
    if ($LASTEXITCODE -ne 0) { throw 'Server exited with an error.' }
} finally { Pop-Location }
