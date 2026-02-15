# scripts/fix-html-entities.ps1
# Arregla entidades HTML pegadas por accidente en TS/TSX/JS/JSX.
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\scripts\fix-html-entities.ps1

$patterns = @(
  @{ from = "&amp;&amp;"; to = "&&" },
  @{ from = "&amp;"; to = "&" },
  @{ from = "&lt;="; to = "<=" },
  @{ from = "&gt;="; to = ">=" },
  @{ from = "&lt;"; to = "<" },
  @{ from = "&gt;"; to = ">" },
  @{ from = "&quot;"; to = '"' },
  @{ from = "&#39;"; to = "'" }
)

$files = Get-ChildItem -Recurse -Include *.tsx,*.ts,*.jsx,*.js
$changed = 0
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $orig = $c
  foreach ($p in $patterns) { $c = $c.Replace($p.from, $p.to) }
  if ($c -ne $orig) { Set-Content -Path $f.FullName -Value $c -Encoding UTF8; $changed++ }
}

if (Test-Path "node_modules\.vite") { Remove-Item -Recurse -Force "node_modules\.vite" }
Write-Host "✅ Reparado. Archivos modificados: $changed"
