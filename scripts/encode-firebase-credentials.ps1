# scripts/encode-firebase-credentials.ps1
param(
  [string]$JsonPath = ".\service-account.json"
)

if (-not (Test-Path $JsonPath)) {
  Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Yellow
  Write-Host "❌ File not found: $JsonPath" -ForegroundColor Red
  Write-Host ""
  Write-Host "Steps to generate your Firebase service account key:" -ForegroundColor Cyan
  Write-Host "  1. Open Firebase Console: https://console.firebase.google.com/project/tasklync-6e7ae/settings/serviceaccounts/adminsdk"
  Write-Host "  2. Click 'Generate new private key' and download the JSON file."
  Write-Host "  3. Save it as 'service-account.json' in this folder."
  Write-Host "  4. Run: .\scripts\encode-firebase-credentials.ps1"
  Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Yellow
  exit 1
}

try {
  $rawContent = Get-Content -Raw -Path $JsonPath
  $parsed = $rawContent | ConvertFrom-Json

  $projectId = $parsed.project_id
  if (-not $projectId) { $projectId = "tasklync-6e7ae" }

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $JsonPath))
  $base64 = [System.Convert]::ToBase64String($bytes)

  # Copy to clipboard
  $base64 | Set-Clipboard
  Write-Host "📋 Base64 string copied to clipboard!" -ForegroundColor Green

  # Update tasklync-admin .env
  $envPath = ".\.env"
  if (Test-Path $envPath) {
    $envContent = Get-Content -Raw -Path $envPath

    if ($envContent -match "FCM_PROJECT_ID=") {
      $envContent = $envContent -replace "FCM_PROJECT_ID=.*", "FCM_PROJECT_ID=$projectId"
    } else {
      $envContent += "`nFCM_PROJECT_ID=$projectId"
    }

    if ($envContent -match "FCM_SERVICE_ACCOUNT_JSON_BASE64=") {
      $envContent = $envContent -replace "FCM_SERVICE_ACCOUNT_JSON_BASE64=.*", "FCM_SERVICE_ACCOUNT_JSON_BASE64=$base64"
    } else {
      $envContent += "`nFCM_SERVICE_ACCOUNT_JSON_BASE64=$base64"
    }

    Set-Content -Path $envPath -Value $envContent.Trim() -Encoding utf8
    Write-Host "✅ Updated $envPath with Firebase FCM credentials!" -ForegroundColor Green
  }

  Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Cyan
  Write-Host "🔥 Firebase Credentials Configured:" -ForegroundColor Cyan
  Write-Host "   Project ID:   $projectId"
  Write-Host "   Client Email: $($parsed.client_email)"
  Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Cyan
} catch {
  Write-Host "❌ Error encoding service account: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
