param([Parameter(Mandatory=$true)][string]$Image, [Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime] | Out-Null
$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'})[0]
function Await($operation,[type]$type) {
  $task=$asTask.MakeGenericMethod($type).Invoke($null,@($operation))
  if(-not $task.Wait(20000)){throw 'native-timeout'}
  return $task.Result
}
$clock=[Diagnostics.Stopwatch]::StartNew()
$stream=$null; $bitmap=$null
try {
  $language=New-Object Windows.Globalization.Language('en-US')
  $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
  if(-not $engine){throw 'language-unavailable'}
  $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Image)) ([Windows.Storage.StorageFile])
  $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $recognition=[Diagnostics.Stopwatch]::StartNew()
  $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $recognition.Stop()
  $lines=@(foreach($line in $result.Lines){
    $words=@(foreach($word in $line.Words){$r=$word.BoundingRect; [ordered]@{text=$word.Text;x=$r.X;y=$r.Y;width=$r.Width;height=$r.Height}})
    [ordered]@{text=$line.Text;words=$words}
  })
  $clock.Stop()
  $value=[ordered]@{source='Windows.Media.Ocr';language='en-US';text=$result.Text;lines=$lines;width=$bitmap.PixelWidth;height=$bitmap.PixelHeight;recognitionMs=$recognition.Elapsed.TotalMilliseconds;decodeAndRecognitionMs=$clock.Elapsed.TotalMilliseconds;textAngle=$result.TextAngle;confidenceProvided=$false}
  [IO.File]::WriteAllText($Output,($value | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
} finally {
  if($bitmap){$bitmap.Dispose()}; if($stream){$stream.Dispose()}
}
