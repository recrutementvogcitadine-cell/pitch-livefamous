Param()
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '..\.env.local' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envFile) {
  Write-Error ".env.local not found in project root. Create it first."; exit 2
}

if (-not $env:VERCEL_TOKEN) {
  Write-Error "VERCEL_TOKEN environment variable is required. Set it with: $env:VERCEL_TOKEN = 'token'"; exit 2
}
if (-not $env:VERCEL_PROJECT_ID) {
  Write-Error "VERCEL_PROJECT_ID environment variable is required. Set it with: $env:VERCEL_PROJECT_ID = 'project_id'"; exit 2
}

$teamQuery = ""
if ($env:VERCEL_TEAM_ID) {
  $encodedTeamId = [uri]::EscapeDataString($env:VERCEL_TEAM_ID)
  $teamQuery = "?teamId=$encodedTeamId"
}

function Parse-EnvFile($path) {
  $pairs = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 0) { return }
    $k = $line.Substring(0,$idx).Trim()
    $v = $line.Substring($idx+1).Trim()
    # strip surrounding quotes
    if ($v.Length -ge 2 -and ($v.StartsWith('"') -and $v.EndsWith('"') -or $v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1,$v.Length-2)
    }
    $pairs[$k] = $v
  }
  return $pairs
}

$pairs = Parse-EnvFile -path $envFile

$keys = @(
  'AGORA_APP_ID',
  'AGORA_APP_CERT',
  'AGORA_TOKEN_SECRET',
  'NEXT_PUBLIC_AGORA_APP_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_COMPLEX_MODEL',
  'LIVE_AI_COOLDOWN_MS',
  'LIVE_AI_MAX_PER_MINUTE',
  'LIVE_AI_ACTIVE_AGENT_SLOTS',
  'LIVE_AI_MONTHLY_BUDGET_USD',
  'LIVE_AI_MODERATOR_EMAILS'
)

foreach ($k in $keys) {
  if ($pairs.ContainsKey($k) -and $pairs[$k]) {
    $body = @{ key = $k; value = $pairs[$k]; target = @('preview','production'); type = 'encrypted' } | ConvertTo-Json -Depth 4
    $uri = "https://api.vercel.com/v9/projects/$($env:VERCEL_PROJECT_ID)/env$teamQuery"
    try {
      Write-Host "Creating env $k..."
      $resp = Invoke-RestMethod -Uri $uri -Method Post -Headers @{ Authorization = "Bearer $($env:VERCEL_TOKEN)"; 'Content-Type' = 'application/json' } -Body $body -ErrorAction Stop
      Write-Host "Created: $($resp.key) (id: $($resp.id))"
    } catch {
      # If it already exists or API returns an error, show the message
      Write-Warning "Failed to create ${k}: $($_.Exception.Message)"
    }
  } else {
    Write-Host "Skipping $k (not present in .env.local)"
  }
}

Write-Host "Done. Confirm variables in Vercel dashboard and trigger a deployment."
