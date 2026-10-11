// scripts/setup-firebase.ts
import fs from 'node:fs'
import path from 'node:path'

const candidatePaths = [
  process.argv[2],
  path.resolve('./service-account.json'),
  path.resolve('./firebase-service-account.json'),
  path.resolve('../service-account.json'),
].filter(Boolean) as string[]

let foundFile: string | null = null
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    foundFile = p
    break
  }
}

if (!foundFile) {
  console.log('─────────────────────────────────────────────────────────────')
  console.log('🔥 FIREBASE SERVICE ACCOUNT SETUP HELPER')
  console.log('─────────────────────────────────────────────────────────────')
  console.log('No service-account.json file was found.')
  console.log('')
  console.log('Steps to get your Firebase service account JSON:')
  console.log('  1. Open Firebase Console: https://console.firebase.google.com/project/tasklync-6e7ae/settings/serviceaccounts/adminsdk')
  console.log('  2. Click "Generate new private key" and download the JSON file.')
  console.log('  3. Place it in this directory as: service-account.json')
  console.log('  4. Re-run this script:')
  console.log('     npx tsx scripts/setup-firebase.ts')
  console.log('     or')
  console.log('     .\\scripts\\encode-firebase-credentials.ps1')
  console.log('─────────────────────────────────────────────────────────────')

  // Create an example template file if none exists
  const exampleFile = path.resolve('./service-account.example.json')
  if (!fs.existsSync(exampleFile)) {
    fs.writeFileSync(
      exampleFile,
      JSON.stringify(
        {
          type: 'service_account',
          project_id: 'tasklync-6e7ae',
          private_key_id: 'your-private-key-id',
          private_key: '-----BEGIN PRIVATE KEY-----\\nYOUR_KEY\\n-----END PRIVATE KEY-----\\n',
          client_email: 'firebase-adminsdk@tasklync-6e7ae.iam.gserviceaccount.com',
          client_id: 'your-client-id',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/...',
        },
        null,
        2
      ) + '\n',
      'utf8'
    )
    console.log('Created template: service-account.example.json')
  }

  process.exit(1)
}

try {
  const content = fs.readFileSync(foundFile, 'utf8')
  const json = JSON.parse(content)

  if (!json.project_id || !json.private_key || !json.client_email) {
    console.error('❌ Error: The file does not appear to be a valid Firebase service account JSON.')
    console.error('Missing required fields: project_id, private_key, or client_email.')
    process.exit(1)
  }

  const base64 = Buffer.from(content, 'utf8').toString('base64')
  const projectId = json.project_id || 'tasklync-6e7ae'

  console.log('─────────────────────────────────────────────────────────────')
  console.log('🔥 FIREBASE CREDENTIALS DETECTED')
  console.log(`   Project ID:   ${projectId}`)
  console.log(`   Client Email: ${json.client_email}`)
  console.log(`   Key ID:       ${json.private_key_id || 'valid'}`)
  console.log('─────────────────────────────────────────────────────────────')

  // Update or append to .env in tasklync-admin
  const envPath = path.resolve('.env')
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

  const fcmVars = [
    `FCM_PROJECT_ID=${projectId}`,
    `FCM_SERVICE_ACCOUNT_JSON_BASE64=${base64}`,
  ].join('\n')

  if (envContent.includes('FCM_PROJECT_ID=')) {
    envContent = envContent.replace(/FCM_PROJECT_ID=.*(\r?\n|$)/g, `FCM_PROJECT_ID=${projectId}\n`)
  }
  if (envContent.includes('FCM_SERVICE_ACCOUNT_JSON_BASE64=')) {
    envContent = envContent.replace(
      /FCM_SERVICE_ACCOUNT_JSON_BASE64=.*(\r?\n|$)/g,
      `FCM_SERVICE_ACCOUNT_JSON_BASE64=${base64}\n`
    )
  }

  if (!envContent.includes('FCM_PROJECT_ID=')) {
    envContent += `\n# Firebase Cloud Messaging\n${fcmVars}\n`
  }

  fs.writeFileSync(envPath, envContent, 'utf8')
  console.log(`✅ Successfully updated ${envPath}`)

  // Also update backend notification-service .env if directory exists
  const backendEnvPath = path.resolve('../../tasklync-backend/tasklync-backend/services/notification-service/.env')
  if (fs.existsSync(path.dirname(backendEnvPath))) {
    let backendEnv = fs.existsSync(backendEnvPath) ? fs.readFileSync(backendEnvPath, 'utf8') : ''
    if (backendEnv.includes('FCM_PROJECT_ID=')) {
      backendEnv = backendEnv.replace(/FCM_PROJECT_ID=.*(\r?\n|$)/g, `FCM_PROJECT_ID=${projectId}\n`)
    }
    if (backendEnv.includes('FCM_SERVICE_ACCOUNT_JSON_BASE64=')) {
      backendEnv = backendEnv.replace(
        /FCM_SERVICE_ACCOUNT_JSON_BASE64=.*(\r?\n|$)/g,
        `FCM_SERVICE_ACCOUNT_JSON_BASE64=${base64}\n`
      )
    }
    if (!backendEnv.includes('FCM_PROJECT_ID=')) {
      backendEnv += `\n# Firebase Cloud Messaging\n${fcmVars}\n`
    }
    fs.writeFileSync(backendEnvPath, backendEnv, 'utf8')
    console.log(`✅ Successfully updated backend ${backendEnvPath}`)
  }

  console.log('')
  console.log('🎉 Firebase FCM credentials are fully installed and configured!')
} catch (err: any) {
  console.error('❌ Failed to process service-account.json:', err.message)
  process.exit(1)
}
