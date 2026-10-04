$ErrorActionPreference = 'Stop'
while ($true) {
  $os = Get-CimInstance Win32_OperatingSystem
  $runnerIds = @(Get-CimInstance Win32_Process -Filter "Name='llama-server.exe'" | Where-Object { $_.ExecutablePath -like '*\Programs\Ollama\lib\ollama\llama-server.exe' } | Select-Object -ExpandProperty ProcessId)
  $processes = @(@(Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue) + @(foreach ($runnerId in $runnerIds) { Get-Process -Id $runnerId -ErrorAction SilentlyContinue }) | Sort-Object Id -Unique)
  $ws = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
  $private = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
  @{ timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); totalPhysicalBytes = [long]$os.TotalVisibleMemorySize * 1024; freePhysicalBytes = [long]$os.FreePhysicalMemory * 1024; freeVirtualBytes = [long]$os.FreeVirtualMemory * 1024; ollamaWorkingSetBytes = [long]$ws; ollamaPrivateBytes = [long]$private; pids = @($processes.Id) } | ConvertTo-Json -Compress
  Start-Sleep -Milliseconds 500
}
