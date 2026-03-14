# UTS QR Finder (Unofficial)

A fast, commuter-friendly web app to find and open UTS station QR codes by State/UT and Station Code.

This repository is an unofficial utility project.

## Features

- Searchable State/UT filter
- Searchable Station Code filter
- QR preview with missing-file handling
- Shareable links using URL parameters
- Favorites and quick access saved in localStorage
- Progressive Web App support (installable)

## Project Structure

- [index.html](index.html): Main UI
- [styles.css](styles.css): Styling and responsive layout
- [app.js](app.js): App logic
- [data/manifest.json](data/manifest.json): Source data manifest
- [data/manifest.js](data/manifest.js): Browser-ready data manifest
- [manifest.webmanifest](manifest.webmanifest): PWA manifest
- [sw.js](sw.js): Service worker
- [qr_codes](qr_codes): QR image assets grouped by State/UT code

## Run Locally

Because this project uses a service worker and PWA features, run it over a local server instead of opening the file directly.

Example with Python:

```powershell
# from the project root
python -m http.server 8080
```

Then open:

- http://localhost:8080

## Data Updates

When QR files are added, removed, or renamed in [qr_codes](qr_codes), regenerate data manifests:

```powershell
# run from the project root
$stateMap = [ordered]@{ AP='Andhra Pradesh'; AR='Arunachal Pradesh'; AS='Assam'; BR='Bihar'; CG='Chhattisgarh'; GA='Goa'; GJ='Gujarat'; HR='Haryana'; HP='Himachal Pradesh'; JH='Jharkhand'; KA='Karnataka'; KL='Kerala'; MP='Madhya Pradesh'; MH='Maharashtra'; MN='Manipur'; ML='Meghalaya'; MZ='Mizoram'; NL='Nagaland'; OR='Odisha (formerly Orissa)'; PB='Punjab'; RJ='Rajasthan'; TN='Tamil Nadu'; TR='Tripura'; UK='Uttarakhand'; UP='Uttar Pradesh'; WB='West Bengal'; CH='Chandigarh'; DL='Delhi'; JK='Jammu and Kashmir'; PY='Puducherry (Pondicherry)'; TS='Telangana' }
$states = @()
foreach($code in $stateMap.Keys){
  $dirPath = Join-Path 'qr_codes' $code
  $stations = @()
  if(Test-Path $dirPath){
    Get-ChildItem -Path $dirPath -File | ForEach-Object {
      $name = $_.Name
      if($name -match '^(?<st>.+)\.png$'){
        $stations += [pscustomobject]@{ code = $Matches.st.ToUpper(); file = ('qr_codes/{0}/{1}' -f $code, $name).Replace('\\','/'); status = 'available' }
      } elseif($name -match '^(?<st>.+)\.png\.missing$'){
        $stations += [pscustomobject]@{ code = $Matches.st.ToUpper(); file = $null; status = 'missing' }
      }
    }
  }
  $stations = @($stations | Sort-Object code, status -Unique)
  $states += [pscustomobject]@{ code = $code; name = $stateMap[$code]; stationCount = $stations.Count; stations = $stations }
}
$payload = [pscustomobject]@{ generatedAt = (Get-Date).ToString('o'); totalStates = $states.Count; states = $states }
$payload | ConvertTo-Json -Depth 12 | Set-Content -Path data/manifest.json -Encoding UTF8
('window.UTS_MANIFEST = ' + ($payload | ConvertTo-Json -Depth 12 -Compress) + ';') | Set-Content -Path data/manifest.js -Encoding UTF8
```

## Legal and Ownership Notice

- This project is unofficial and provided for convenience.
- QR assets may belong to their respective owners.
- Repository owner does not claim ownership over third-party QR assets.

See [LICENSE](LICENSE) for licensing details.