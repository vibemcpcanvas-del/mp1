$ErrorActionPreference = 'Stop'
$content = Get-Content index.html -Raw
$matches = [regex]::Matches($content, '\"\.\/(images|WorldMap|bgm)\/[^\"]+\"')
$urls = $matches | ForEach-Object { $_.Value.Trim('"').Substring(2) } | Sort-Object -Unique

Write-Host "Found $($urls.Count) unique assets to download."

$baseUrl = "https://maplebuild.kr/"

$pool = [RunspaceFactory]::CreateRunspacePool(1, 20)
$pool.Open()
$tasks = @()

foreach ($url in $urls) {
    $targetPath = "$PWD\$url" -replace '/', '\'
    $targetDir = Split-Path $targetPath
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
    
    if (-not (Test-Path $targetPath)) {
        $fullUrl = $baseUrl + $url.Replace(" ", "%20")
        
        $scriptBlock = {
            param($url, $path)
            try {
                Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing | Out-Null
                return "$url - OK"
            } catch {
                return "$url - ERROR: $_"
            }
        }
        
        $ps = [powershell]::Create().AddScript($scriptBlock).AddArgument($fullUrl).AddArgument($targetPath)
        $ps.RunspacePool = $pool
        $tasks += [PSCustomObject]@{
            Pipe = $ps
            Result = $ps.BeginInvoke()
        }
    }
}

$completed = 0
foreach ($task in $tasks) {
    $res = $task.Pipe.EndInvoke($task.Result)
    $task.Pipe.Dispose()
    $completed++
    if ($completed % 100 -eq 0) {
        Write-Host "Downloaded $completed / $($tasks.Count)"
    }
}

$pool.Close()
$pool.Dispose()

Write-Host "Finished downloading assets."
