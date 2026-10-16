$ErrorActionPreference='Stop'
$cicRepo=Split-Path -Parent $PSScriptRoot
$cicCompiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$cicFramework=Split-Path -Parent $cicCompiler
$cicOutput=Join-Path $cicRepo '.tools\native-chrome-reader'
New-Item -ItemType Directory -Force -Path $cicOutput | Out-Null
$cicArgs=@('/nologo','/target:exe','/platform:x64',('/out:'+(Join-Path $cicOutput 'CicChromeReader.exe')),('/reference:'+(Join-Path $cicFramework 'System.Web.dll')),('/reference:'+(Join-Path $cicFramework 'System.Web.Extensions.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\UIAutomationClient.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\UIAutomationTypes.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\WindowsBase.dll')),(Join-Path $cicRepo 'backend\chrome\CicChromeReader.cs'))
& $cicCompiler @cicArgs
if($LASTEXITCODE -ne 0){throw 'Chrome reader compile failed'}
(Get-FileHash -LiteralPath (Join-Path $cicOutput 'CicChromeReader.exe') -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath (Join-Path $cicOutput 'CicChromeReader.sha256') -Encoding ascii
Write-Output 'Built read-only Chrome adapter; general control remains disabled.'
