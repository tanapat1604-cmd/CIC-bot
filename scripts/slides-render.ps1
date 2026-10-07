param([Parameter(Mandatory=$true)][string]$Directory,[switch]$CleanupOnly)
$ErrorActionPreference='Stop'
$jobRoot=[IO.Path]::GetFullPath((Join-Path (Get-Location) '.cic-user-files\slides'))
$jobPath=[IO.Path]::GetFullPath($Directory)
if(-not $jobPath.StartsWith($jobRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'invalid job path'}
$pidFile=Join-Path $jobPath 'renderer.json'
$hostFile=Join-Path $jobPath 'renderer-host.json'
$cancelFile=Join-Path $jobPath 'cancel.requested'
if($CleanupOnly){
 if(Test-Path -LiteralPath $hostFile){
  $record=Get-Content -LiteralPath $hostFile -Raw | ConvertFrom-Json
  for($attempt=0;$attempt -lt 80;$attempt++){
   $owned=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
   if(-not $owned -or $owned.ProcessName -ne 'powershell' -or $owned.StartTime.ToUniversalTime().Ticks.ToString() -ne $record.startTicks){exit 0}
   Start-Sleep -Milliseconds 100
  }
  throw 'stop-unverified'
 }
 # A renderer starting after cancellation reads this marker before any COM call.
 exit 0
}
$hostProcess=Get-Process -Id $PID
@{pid=$PID;startTicks=$hostProcess.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json | Set-Content -LiteralPath $hostFile -Encoding utf8
if(Test-Path -LiteralPath $cancelFile){exit 0}
$os=Get-CimInstance Win32_OperatingSystem
if($os.FreePhysicalMemory -lt 262144){throw 'memory-low'}
if(@(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0){throw 'powerpoint-busy'}
$app=$null;$deck=$null;$ownsPowerPoint=$false
$beforeLaunch=[DateTime]::UtcNow.Ticks
try{
 if(Test-Path -LiteralPath $cancelFile){exit 0}
 $app=New-Object -ComObject PowerPoint.Application
 $owned=@(Get-Process POWERPNT -ErrorAction Stop)
 if($owned.Count -ne 1 -or $owned[0].StartTime.ToUniversalTime().Ticks -lt $beforeLaunch -or $app.Presentations.Count -ne 0){throw 'powerpoint-busy'}
 $ownsPowerPoint=$true
 @{pid=$owned[0].Id;startTicks=$owned[0].StartTime.ToUniversalTime().Ticks.ToString();freePhysicalKiB=$os.FreePhysicalMemory} | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
 if(Test-Path -LiteralPath $cancelFile){throw 'cancelled'}
 $deck=$app.Presentations.Open((Join-Path $jobPath 'deck.pptx'),$true,$false,$false)
 $checks=@()
 foreach($slide in $deck.Slides){
  if(Test-Path -LiteralPath $cancelFile){throw 'cancelled'}
  foreach($shape in $slide.Shapes){if($shape.HasTextFrame -and $shape.TextFrame.HasText){$r=$shape.TextFrame2.TextRange;if($r.BoundHeight -gt $shape.Height+2){throw 'text-overflow'};$checks+=@{page=$slide.SlideIndex;text=$r.Text;height=$r.BoundHeight;box=$shape.Height}}}
  $slide.Export((Join-Path $jobPath ('slide-{0:D2}.png' -f $slide.SlideIndex)),'PNG',1600,900)
 }
 if(Test-Path -LiteralPath $cancelFile){throw 'cancelled'}
 $deck.SaveAs((Join-Path $jobPath 'deck.pdf'),32)
 @{opened=$true;pages=$deck.Slides.Count;checks=$checks;freePhysicalKiB=$os.FreePhysicalMemory} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $jobPath 'render-check.json') -Encoding utf8
}finally{if($deck){$deck.Close()};if($app -and $ownsPowerPoint -and $app.Presentations.Count -eq 0){$app.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($app)}}
