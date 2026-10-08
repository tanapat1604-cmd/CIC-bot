$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows only' }
$cicRepo = Split-Path -Parent $PSScriptRoot
$cicCompiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$cicFramework = Split-Path -Parent $cicCompiler
$cicOutput = Join-Path $cicRepo '.tools\native-lab'
New-Item -ItemType Directory -Force -Path $cicOutput | Out-Null
$cicArgs = @('/nologo','/target:exe','/platform:x64',('/out:' + (Join-Path $cicOutput 'CicLab.exe')),('/reference:' + (Join-Path $cicFramework 'System.Windows.Forms.dll')),('/reference:' + (Join-Path $cicFramework 'System.Drawing.dll')),('/reference:' + (Join-Path $cicFramework 'System.Web.Extensions.dll')),('/reference:' + (Join-Path $cicFramework 'WPF\UIAutomationClient.dll')),('/reference:' + (Join-Path $cicFramework 'WPF\UIAutomationTypes.dll')),('/reference:' + (Join-Path $cicFramework 'WPF\WindowsBase.dll')),(Join-Path $cicRepo 'backend\lab\CicLab.cs'))
& $cicCompiler @cicArgs
if ($LASTEXITCODE -ne 0) { throw 'Native lab compile failed' }
(Get-FileHash -LiteralPath (Join-Path $cicOutput 'CicLab.exe') -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath (Join-Path $cicOutput 'CicLab.sha256') -Encoding ascii
Write-Output 'Built owned-window UIA lab. No download or installation.'
