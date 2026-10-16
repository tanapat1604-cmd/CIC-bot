$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$started = [Diagnostics.Stopwatch]::StartNew()
$synth = $null
$pcm = $null
$wave = $null
try {
    $requestJson = [Console]::In.ReadToEnd()
    if ($requestJson.Length -gt 8192) { throw 'input-limit' }
    $request = $requestJson | ConvertFrom-Json
    $names = @($request.PSObject.Properties.Name)
    $spokenText = $request.text
    if ($names.Count -ne 2 -or -not ($names -contains 'kind') -or -not ($names -contains 'text') -or $request.kind -ne 'tts' -or $spokenText -isnot [string] -or $spokenText.Length -lt 1 -or $spokenText.Length -gt 600 -or $spokenText -ne $spokenText.Trim()) { throw 'invalid-audio' }
    foreach ($character in $spokenText.ToCharArray()) {
        $code = [int]$character
        if ($code -lt 32 -or ($code -ge 127 -and $code -le 159)) { throw 'invalid-audio' }
    }
    $at = $started.ElapsedMilliseconds
    Add-Type -AssemblyName System.Speech
    $importMs = $started.ElapsedMilliseconds - $at
    $at = $started.ElapsedMilliseconds
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voice = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' -and $_.VoiceInfo.Name -eq 'Microsoft David Desktop' })
    if ($voice.Count -ne 1) { throw 'voice-english-not-configured' }
    $synth.SelectVoice($voice[0].VoiceInfo.Name)
    $pcm = New-Object System.IO.MemoryStream
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToAudioStream($pcm, $format)
    $loadMs = $started.ElapsedMilliseconds - $at
    $at = $started.ElapsedMilliseconds
    $synth.Speak($spokenText)
    $synth.SetOutputToNull()
    $decodeMs = $started.ElapsedMilliseconds - $at
    $bytes = $pcm.ToArray()
    if ($bytes.Length -lt 2 -or $bytes.Length + 44 -gt 2000000) { throw 'audio-limit' }
    $wave = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($wave)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
    $writer.Write([uint32]($bytes.Length + 36))
    $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
    $writer.Write([uint32]16)
    $writer.Write([uint16]1)
    $writer.Write([uint16]1)
    $writer.Write([uint32]22050)
    $writer.Write([uint32]44100)
    $writer.Write([uint16]2)
    $writer.Write([uint16]16)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('data'))
    $writer.Write([uint32]$bytes.Length)
    $writer.Write($bytes)
    $writer.Flush()
    $wav = $wave.ToArray()
    @{ version=1; ok=$true; kind='tts'; text=$spokenText; wav=[Convert]::ToBase64String($wav); audioBytes=$wav.Length; elapsedMs=$started.ElapsedMilliseconds; peakWorkingSetMiB=[Math]::Round([Diagnostics.Process]::GetCurrentProcess().PeakWorkingSet64 / 1MB, 2); timings=@{ importMs=$importMs; modelLoadMs=$loadMs; decodeMs=$decodeMs; inputWaitMs=0 } } | ConvertTo-Json -Compress -Depth 4
} catch {
    @{ version=1; ok=$false; code='runtime-failed'; timings=@{ importMs=0; modelLoadMs=0; decodeMs=0; inputWaitMs=0 } } | ConvertTo-Json -Compress
    exit 1
} finally {
    if ($synth) { $synth.Dispose() }
    if ($pcm) { $pcm.Dispose() }
    if ($wave) { $wave.Dispose() }
}
