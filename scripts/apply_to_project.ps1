
Param(
  [Parameter(Mandatory=$true)][string]$Root
)
$ErrorActionPreference='Stop'
if(!(Test-Path (Join-Path $Root 'src'))){ throw "No encuentro $Root\src. ¿Apuntaste al root del proyecto?" }
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'public\promos\social') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'supabase_sql') | Out-Null
Copy-Item -Force public\promos\*.svg (Join-Path $Root 'public\promos')
Copy-Item -Force public\promos\social\*.svg (Join-Path $Root 'public\promos\social')
Copy-Item -Force supabase_sql_promotions_variants_upsert.sql (Join-Path $Root 'supabase_sql')
Copy-Item -Force promos_config.json (Join-Path $Root 'promos_config.json')
Write-Host "✅ Copiado. Ejecuta en Supabase SQL Editor: supabase_sql_promotions_variants_upsert.sql" -ForegroundColor Green
