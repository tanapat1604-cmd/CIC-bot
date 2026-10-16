$ErrorActionPreference='Stop'
$cicRepo=Split-Path -Parent $PSScriptRoot
$cicCompiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$cicFramework=Split-Path -Parent $cicCompiler
$cicOutput=Join-Path $cicRepo '.tools\native-personal-chrome'
New-Item -ItemType Directory -Force -Path $cicOutput | Out-Null
$cicArgs=@('/nologo','/target:exe','/platform:x64',('/out:'+(Join-Path $cicOutput 'CicPersonalChrome.exe')),('/reference:'+(Join-Path $cicFramework 'System.Drawing.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\UIAutomationClient.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\UIAutomationTypes.dll')),('/reference:'+(Join-Path $cicFramework 'WPF\WindowsBase.dll')),('/reference:'+(Join-Path $cicFramework 'System.Management.dll')),('/reference:'+(Join-Path $cicFramework 'System.Web.Extensions.dll')),(Join-Path $cicRepo 'backend\chrome\CicPersonalChrome.cs'))
& $cicCompiler @cicArgs
if($LASTEXITCODE -ne 0){throw 'Personal Chrome helper compile failed'}
Write-Output 'Built bounded focus-only adapter for personal Chrome.'
