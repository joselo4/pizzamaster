Param(
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$false)][string]$HistoryRel
)
$ErrorActionPreference = 'Stop'
function Copy-Into($src,$dst){ New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null; Copy-Item -Force $src $dst }
function Backup-File($p){ if(Test-Path $p){ Copy-Item -Force $p ($p + '.bak') } }

if(!(Test-Path (Join-Path $Root 'src'))){ throw "No encuentro $Root\src" }

# 1) Copiar pantalla
Copy-Into (Join-Path $PSScriptRoot '..\src\pages\CashierOrderEditor.tsx') (Join-Path $Root 'src\pages\CashierOrderEditor.tsx')

# 2) Patch App.tsx
$app = Join-Path $Root 'src\App.tsx'
if(Test-Path $app){
  Backup-File $app
  $text = Get-Content -Raw -Encoding UTF8 $app
  if($text -notmatch "CashierOrderEditor"){ $text = $text -replace "(import .+?;\s*)$","$1`nimport CashierOrderEditor from './pages/CashierOrderEditor';`n" }
  if($text -notmatch 'path="/cashier/history/edit/:id"'){
    $text = $text -replace "(</Routes>)","  <Route path=\"/cashier/history/edit/:id\" element={<CashierOrderEditor />} />`n`$1"
  }
  Set-Content -Encoding UTF8 $app $text
}
else{ Write-Warning "No existe src\App.tsx. Agrega ruta manual." }

# 3) Patch Historial
function Select-File{
  param([string]$Root,[string]$HistoryRel)
  if($HistoryRel -and (Test-Path (Join-Path $Root $HistoryRel))){ return (Join-Path $Root $HistoryRel) }
  $cands = @(
    'src\pages\CashierHistory.tsx',
    'src\modules\cashier\History.tsx',
    'src\modules\cashier\CashierHistory.tsx',
    'src\pages\Cashier\History.tsx'
  )
  foreach($c in $cands){ $p = Join-Path $Root $c; if(Test-Path $p){ return $p } }
  # Buscar por 'Reimprimir'
  $files = Get-ChildItem -Path (Join-Path $Root 'src') -Recurse -Include *.tsx
  foreach($f in $files){ $t = Get-Content -Raw -Encoding UTF8 $f.FullName; if($t -match 'Reimprimir'){ return $f.FullName } }
  return $null
}
$hfile = Select-File -Root $Root -HistoryRel $HistoryRel
if($hfile){
  Backup-File $hfile
  $t = Get-Content -Raw -Encoding UTF8 $hfile
  if($t -notmatch 'useNavigate'){ $t = $t -replace "from 'react-router-dom';","from 'react-router-dom';`nimport { useNavigate } from 'react-router-dom';" }
  if($t -notmatch 'useNavigate\(\)'){ $t = $t -replace "(export default function [^{]+{)","$1`n  const navigate = useNavigate();" }
  $btn = "<button class=\"inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700\" onClick={() => navigate(`/cashier/history/edit/${o.id}`)}>Editar</button>"
  if($t -notmatch 'cashier/history/edit'){ $t = $t -replace '(Reimprimir\s*</button>)',"`$1`n$btn" }
  if($t -notmatch 'cashier/history/edit'){ $t = $t -replace '(<div className=\"flex items-center[^>]*\">)',"`$1`n$btn" }
  Set-Content -Encoding UTF8 $hfile $t
  Write-Host "✅ Botón Editar inyectado en: $hfile"
}
else{ Write-Warning "No se encontró el archivo de Historial. Pásalo con -HistoryRel" }

Write-Host "Listo. Revisa backups .bak y corre npm run dev" -ForegroundColor Green
