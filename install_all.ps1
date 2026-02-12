
Param(
  [Parameter(Mandatory=$true)][string]$Root
)

$ErrorActionPreference = 'Stop'

function Ensure-Dir($p){ if(!(Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }
function Copy-Into($src,$dst){ Ensure-Dir (Split-Path -Parent $dst); Copy-Item -Force $src $dst }
function Backup-File($p){ if(Test-Path $p){ Copy-Item -Force $p ($p + '.bak') } }

# Validate
if(!(Test-Path (Join-Path $Root 'src'))){ throw "No encuentro $Root\src. Apunta al root del proyecto." }

$promo = Join-Path $Root 'src\pages\Promo.tsx'
$cust  = Join-Path $Root 'src\pages\CustomerOrder.tsx'
$app   = Join-Path $Root 'src\App.tsx'
$admin = Join-Path $Root 'src\pages\admin.tsx'

@($promo,$cust,$app,$admin) | ForEach-Object { Backup-File $_ }

# 1) Copy assets
Ensure-Dir (Join-Path $Root 'public\campaigns')
Ensure-Dir (Join-Path $Root 'public\promos')
Copy-Into (Join-Path $PSScriptRoot 'public\campaigns\carlos_poster_bw.svg') (Join-Path $Root 'public\campaigns\carlos_poster_bw.svg')
Copy-Into (Join-Path $PSScriptRoot 'public\campaigns\carlos_poster_bw.html') (Join-Path $Root 'public\campaigns\carlos_poster_bw.html')
Copy-Into (Join-Path $PSScriptRoot 'public\promos\promo_placeholder_1.svg') (Join-Path $Root 'public\promos\promo_placeholder_1.svg')
Copy-Into (Join-Path $PSScriptRoot 'public\promos\promo_placeholder_2.svg') (Join-Path $Root 'public\promos\promo_placeholder_2.svg')

# 2) Copy new TS/TSX files
Copy-Into (Join-Path $PSScriptRoot 'src\lib\promos.ts') (Join-Path $Root 'src\lib\promos.ts')
Copy-Into (Join-Path $PSScriptRoot 'src\pages\Promos.tsx') (Join-Path $Root 'src\pages\Promos.tsx')
Copy-Into (Join-Path $PSScriptRoot 'src\pages\PromoShow.tsx') (Join-Path $Root 'src\pages\PromoShow.tsx')
Copy-Into (Join-Path $PSScriptRoot 'src\pages\AdminPromos.tsx') (Join-Path $Root 'src\pages\AdminPromos.tsx')

# 3) Copy SQL
Ensure-Dir (Join-Path $Root 'supabase_sql')
Copy-Into (Join-Path $PSScriptRoot 'supabase_sql\18_promotions_schema.sql') (Join-Path $Root 'supabase_sql\18_promotions_schema.sql')
Copy-Into (Join-Path $PSScriptRoot 'supabase_sql\19_promotions_policies.sql') (Join-Path $Root 'supabase_sql\19_promotions_policies.sql')
Copy-Into (Join-Path $PSScriptRoot 'supabase_sql\20_promotions_seed.sql') (Join-Path $Root 'supabase_sql\20_promotions_seed.sql')

# 4) Patch Promo.tsx content
$text = Get-Content -Raw -Encoding UTF8 $promo
$text = [regex]::Replace($text, "const\s+badge\s*=\s*cfg\?\.promo_badge\s*\|\|\s*'[^']*';", "const badge = cfg?.promo_badge || 'CHISME REAL. PROMO REAL.';" )
$text = [regex]::Replace($text, "const\s+titleA\s*=\s*cfg\?\.promo_headline\s*\|\|\s*'[^']*';", "const titleA = cfg?.promo_headline || '¡CARLOS TE ENGAÑA! 💔';" )
$text = [regex]::Replace($text, "const\s+titleB\s*=\s*cfg\?\.promo_subheadline\s*\|\|\s*'[^']*';", "const titleB = cfg?.promo_subheadline || '...Dijo que él invitaba la cena hoy y se hizo humo.';" )
$text = [regex]::Replace($text, "const\s+body\s*=\s*cfg\?\.promo_body\s*\|\|\s*'[^']*';", "const body = cfg?.promo_body || 'No dejes que te rompan el corazón (ni el estómago). Consuélate con nuestra masa fina y crujiente de 16 cm.';" )
$text = [regex]::Replace($text, "const\s+ctaLabel\s*=\s*cfg\?\.promo_cta_label\s*\|\|\s*'[^']*';", "const ctaLabel = cfg?.promo_cta_label || 'PEDIR MI PIZZA AHORA';" )
$text = [regex]::Replace($text, "const\s+waMsg\s*=\s*cfg\?\.promo_wa_message\s*\|\|\s*'[^']*';", "const waMsg = cfg?.promo_wa_message || 'Hola 👋 Quiero la promo CARLOS (S/10: pizza personal + chicha). ¿Me ayudas a pedir?';" )

$text = $text.Replace('Hecha al momento','¡Lista en 8 minutos!')
$text = $text.Replace('(masa fresca + queso full)','(Más rápido que las excusas de Carlos).')
$text = $text.Replace('Delivery gratis','La personal perfecta (16cm).')
$text = $text.Replace('(hoy)','Ni muy grande, ni muy chica. Tuya.')
$text = $text.Replace('Sabor brutal','Masa extra fina y crujiente.')
$text = $text.Replace('(la dieta no se salva)','El verdadero "crunch".')

if($text -notmatch 'Mira todo el menú'){
  $marker = "</div>`n`n      <div className=\"mt-6 grid"
  if($text.Contains($marker)){
    $insert = "</div>`n`n      <div className=\"mt-4 text-center\">`n        <Link to=\"/pedido\" className=\"underline text-white/80 hover:text-white\">¿No quieres pepperoni? Mira todo el menú.</Link>`n      </div>`n`n      <div className=\"mt-6 grid"
    $text = $text.Replace($marker, $insert)
  }
}
Set-Content -Encoding UTF8 $promo $text

# 5) Remove Soy operador button
$c = Get-Content -Raw -Encoding UTF8 $cust
$c = [regex]::Replace($c, "\s*<button[^>]*navigate\((?:'|\")/login(?:'|\")\)[\s\S]*?Soy operador[\s\S]*?</button>\s*", "`n", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
if($c -match 'Soy operador'){
  $c = [regex]::Replace($c, "\s*<button[\s\S]*?Soy operador[\s\S]*?</button>\s*", "`n", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}
Set-Content -Encoding UTF8 $cust $c

# 6) Router add routes
$a = Get-Content -Raw -Encoding UTF8 $app
if($a -notmatch "import Promos from './pages/Promos'"){
  $a = $a.Replace("import Promo from './pages/Promo';", "import Promo from './pages/Promo';`nimport Promos from './pages/Promos';`nimport PromoShow from './pages/PromoShow';")
}
if($a -notmatch 'path="/promos"'){
  $a = $a.Replace('<Route path="/promo" element={<Promo />} />', '<Route path="/promo" element={<Promo />} />' + "`n          <Route path=\"/promos\" element={<Promos />} />`n          <Route path=\"/promo/:slug\" element={<PromoShow />} />")
}
Set-Content -Encoding UTF8 $app $a

Write-Host "✅ Listo. Cambios aplicados." -ForegroundColor Green
Write-Host "- Revisa backups .bak" -ForegroundColor Yellow
Write-Host "- Ejecuta SQL: 18_promotions_schema.sql, 19_promotions_policies.sql, 20_promotions_seed.sql" -ForegroundColor Yellow
Write-Host "- Prueba: /promo?ref=carlos, /promos, /promo/carlos10" -ForegroundColor Yellow
