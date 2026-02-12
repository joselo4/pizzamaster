
Param(
  [Parameter(Mandatory=$true)][string]$Root
)
$ErrorActionPreference='Stop'

$srcRoot  = Join-Path $PSScriptRoot ".."
$srcPromos = Join-Path $srcRoot "public\promos\*"
$srcSql    = Join-Path $srcRoot "supabase_sql\99_fix_promos_admin_v3_FIXED.sql"

$dstPromos = Join-Path $Root "public\promos\"
$dstSqlDir = Join-Path $Root "supabase_sql\"

New-Item -ItemType Directory -Force -Path $dstPromos | Out-Null
New-Item -ItemType Directory -Force -Path $dstSqlDir | Out-Null

Copy-Item -Force $srcPromos $dstPromos -Recurse
Copy-Item -Force $srcSql $dstSqlDir

# Backups
$targets = @('src\pages\Promo.tsx','src\pages\Promos.tsx')
foreach($t in $targets){
  $p = Join-Path $Root $t
  if(Test-Path $p){ Copy-Item -Force $p ($p + '.bak') }
}

function Patch-OperadorLink($path){
  if(!(Test-Path $path)){ return }
  $txt = Get-Content -Raw -Encoding UTF8 $path
  if($txt -match 'href=\\"/login\\"' -and $txt -match 'Operador'){ return }
  $needle = 'Ver pedido normal'
  if($txt.Contains($needle)){
    $txt = $txt.Replace($needle, $needle + "  \n        <a href=\"/login\" className=\"text-xs underline opacity-70 hover:opacity-100\">Operador</a>")
    Set-Content -Encoding UTF8 $path $txt
  }
}

function Patch-PromoCardImage($path){
  if(!(Test-Path $path)){ return }
  $txt = Get-Content -Raw -Encoding UTF8 $path
  if($txt -match "\(p as any\)\.image" -or $txt -match "src=\{\(p as any\)\.image"){ return }
  # Insert image right before any button that contains '>Pedir<'
  $img = "<img src={(p as any).image || '/promos/promo_placeholder_1.svg'} alt={p.title} className=\"w-full h-28 rounded-lg object-cover mb-3\" />\n"
  $txt2 = $txt -replace "(\s*)(<button[^>]*>\s*Pedir\s*</button>)", "`$1$img`$1`$2"
  if($txt2 -ne $txt){
    Set-Content -Encoding UTF8 $path $txt2
  }
}

function Patch-PromosListImage($path){
  if(!(Test-Path $path)){ return }
  $txt = Get-Content -Raw -Encoding UTF8 $path
  if($txt -match '<img' -and ($txt -match 'thumb_url' -or $txt -match 'image_url')){ return }
  # Try to insert an <img> before rendering p.name
  $img = "<img src={p.thumb_url || p.image_url || '/promos/promo_placeholder_1.svg'} alt={p.name} className=\"w-full h-28 rounded-lg object-cover mb-3\" />\n"
  $txt2 = $txt -replace "(\s*)(\{\s*p\.name\s*\})", "`$1$img`$1`$2"
  if($txt2 -ne $txt){
    Set-Content -Encoding UTF8 $path $txt2
  }
}

Patch-OperadorLink (Join-Path $Root 'src\pages\Promo.tsx')
Patch-OperadorLink (Join-Path $Root 'src\pages\Promos.tsx')
Patch-PromoCardImage (Join-Path $Root 'src\pages\Promo.tsx')
Patch-PromosListImage (Join-Path $Root 'src\pages\Promos.tsx')

Write-Host "✅ Copiado assets+SQL y parchado UI (con backups .bak)." -ForegroundColor Green
Write-Host "➡️ Ejecuta en Supabase: supabase_sql\99_fix_promos_admin_v3_FIXED.sql" -ForegroundColor Yellow
Write-Host "➡️ Luego reinicia Vite y prueba /promo, /promos, /login, /admin" -ForegroundColor Yellow
