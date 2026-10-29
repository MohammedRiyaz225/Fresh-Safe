$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root 'public\assets\products'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Save-UnsplashPhoto {
  param([string]$Name, [string]$PhotoId, [int]$W = 900, [int]$H = 600)
  $url = "https://images.unsplash.com/${PhotoId}?w=${W}&h=${H}&fit=crop&q=85&auto=format"
  $dest = Join-Path $outDir $Name
  Write-Host "Fetching $Name ..."
  & curl.exe -sSL -o $dest "$url" | Out-Null
  $ok = ($LASTEXITCODE -eq 0) -and (Test-Path $dest) -and ((Get-Item $dest).Length -ge 1000)
  if (-not $ok) {
    Write-Warning "Skip (failed): $Name"
    if (Test-Path $dest) { Remove-Item $dest -Force }
  }
}

# Unsplash photo IDs used across the site
$photos = @(
  'photo-1542838132-92c53300491e',
  'photo-1610348725531-843dff563e2c',
  'photo-1582515073490-39981397c445',
  'photo-1506617564039-2f3b650b7010',
  'photo-1540420773420-3366772f4999',
  'photo-1605027545626-2468f14a8043',
  'photo-1553279768-865429fa0078',
  'photo-1601004890684-d8cbf643f5f2',
  'photo-1464965911861-746a04b4bca6',
  'photo-1550258987-190a2d41a8ba',
  'photo-1459411621453-7b03977f4bfc',
  'photo-1587735243615-c03f25aaff15',
  'photo-1519996529931-28324d5a630e',
  'photo-1550828520-4cb496926fc9',
  'photo-1606923994480-958244687209',
  'photo-1506872132052-c96df8220b72',
  'photo-1547514701-42782101795e',
  'photo-1486297678162-eb2a19b0a32d',
  'photo-1629820229846-936247681a34',
  'photo-1567306226416-28f0efdc88ce',
  'photo-1528825871115-3581a5387919',
  'photo-1574226516831-e1dff420e562',
  'photo-1582979512210-99b6a53386f9',
  'photo-1615485500704-8e990f9900f7',
  'photo-1560707865-ce25ba879151',
  'photo-1546094096-0df4bcaaa337',
  'photo-1576045057995-568f588f82fb',
  'photo-1459411552884-841e9c92d048',
  'photo-1598170845058-32b9d6a5da37',
  'photo-1590005354167-6da97870c757',
  'photo-1508747703725-719777637510',
  'photo-1591814028651-b55e60bd664b',
  'photo-1568584711075-3d021a7c3ca3',
  'photo-1568584711271-6c929fb49b60',
  'photo-1447175008436-054170c2e979',
  'photo-1543362906-acfc16c67564',
  'photo-1560806887-1e4cd0b6cbd6',
  'photo-1571771894821-ce9b6c11b08e',
  'photo-1596040033229-a9821ebd058d',
  'photo-1604902595623-7582cb788a08',
  'photo-1574323347408-f8e79238998e',
  'photo-1615480366862-f3067686ba7c',
  'photo-1610872448704-22af22825173'
)

foreach ($id in $photos) {
  Save-UnsplashPhoto -Name "$id.jpg" -PhotoId $id
}

# Cut vegetables — semantic filenames for client catalog
$cutMap = @{
  'cut-hero.jpg' = 'photo-1582515073490-39981397c445'
  'cut-chopped-onion.jpg' = 'photo-1604902595623-7582cb788a08'
  'cut-chopped-tomato.jpg' = 'photo-1546094096-0df4bcaaa337'
  'cut-diced-potato.jpg' = 'photo-1635774855536-9728f2610245'
  'cut-sliced-capsicum.jpg' = 'photo-1685399246815-de9702299038'
  'cut-grated-carrot.jpg' = 'photo-1598170845058-32b9d6a5da37'
  'cut-chopped-beans.jpg' = 'photo-1567375698348-5d9d5ae99de0'
  'cut-diced-brinjal.jpg' = 'photo-1722501561648-b28829d2f289'
  'cut-sliced-cucumber.jpg' = 'photo-1568584711271-6c929fb49b60'
  'cut-chopped-spinach.jpg' = 'photo-1576045057995-568f588f82fb'
  'cut-diced-pumpkin.jpg' = 'photo-1574323347408-f8e79238998e'
  'cut-chopped-ginger.jpg' = 'photo-1615480366862-f3067686ba7c'
  'cut-chopped-garlic.jpg' = 'photo-1610872448704-22af22825173'
}

foreach ($entry in $cutMap.GetEnumerator()) {
  Save-UnsplashPhoto -Name $entry.Key -PhotoId $entry.Value
}

Write-Host "Done. Images saved to $outDir"
