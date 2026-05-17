param(
  [string]$Message = "Update geoquiz"
)

$githubDesktop = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like "*GitHub*" }

if (-not $githubDesktop) {
  Write-Error "GitHub Desktop is not running. Start GitHub Desktop before upload."
  exit 2
}

$status = git status --short
if (-not $status) {
  Write-Output "No local changes to upload."
  exit 0
}

git add README.md index.html css js data docs assets tools
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git commit -m $Message
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git push origin main
exit $LASTEXITCODE
