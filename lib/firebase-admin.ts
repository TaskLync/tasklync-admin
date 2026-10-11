// lib/firebase-admin.ts
// Direct Firebase Admin SDK singleton for TaskLync Admin.
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging, type Message } from 'firebase-admin/messaging'
import fs from 'node:fs'
import path from 'node:path'

let cachedApp: App | null = null
let cachedMessaging: Messaging | null = null

function loadServiceAccount(): Record<string, unknown> {
  const rawCandidate =
    process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FCM_SERVICE_ACCOUNT_JSON

  if (rawCandidate) {
    const cleaned = rawCandidate.trim().replace(/^["']|["']$/g, '')
    // Check if raw JSON string was provided
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      try {
        return JSON.parse(cleaned)
      } catch (err: unknown) {
        console.warn('[firebase-admin] Failed to parse raw JSON from environment variable:', err)
      }
    }

    // Try base64 decoding
    try {
      const decoded = Buffer.from(cleaned, 'base64').toString('utf8')
      if (decoded.trim().startsWith('{')) {
        return JSON.parse(decoded)
      }
    } catch (err: unknown) {
      console.warn('[firebase-admin] Failed to decode base64 from environment variable:', err)
    }
  }

  // Check individual environment variables (common on Vercel)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FCM_PRIVATE_KEY
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FCM_CLIENT_EMAIL
  const projectId = process.env.FCM_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'tasklync-6e7ae'

  if (privateKey && clientEmail) {
    return {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: clientEmail,
    }
  }

  // Fallback to local service-account.json if present (local dev only)
  const candidateFiles = [
    path.resolve(process.cwd(), 'service-account.json'),
    path.resolve(process.cwd(), 'firebase-service-account.json'),
  ]

  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf8')
        return JSON.parse(raw)
      } catch (err: unknown) {
        console.warn(`[firebase-admin] Failed to parse ${file}:`, err)
      }
    }
  }

  throw new Error(
    'Firebase service account credentials missing. Please configure FCM_SERVICE_ACCOUNT_JSON_BASE64 in your Vercel Project Settings -> Environment Variables.'
  )
}

export function getFirebaseAdminApp(): App {
  if (cachedApp) return cachedApp

  const existingApps = getApps()
  if (existingApps.length > 0) {
    cachedApp = existingApps[0]
    return cachedApp
  }

  const credentials = loadServiceAccount()
  const projectId = process.env.FCM_PROJECT_ID || (credentials.project_id as string) || 'tasklync-6e7ae'

  cachedApp = initializeApp({
    credential: cert(credentials),
    projectId,
  })

  return cachedApp
}

export function getFirebaseMessaging(): Messaging {
  if (cachedMessaging) return cachedMessaging
  const app = getFirebaseAdminApp()
  cachedMessaging = getMessaging(app)
  return cachedMessaging
}

export interface DirectPushPayload {
  token: string
  title: string
  body: string
  imageUrl?: string | null
  deepLink?: string | null
  data?: Record<string, string>
}

export interface DirectPushResult {
  success: boolean
  messageId?: string
  error?: string
  isDeadToken: boolean
}

/**
 * Sends a single FCM push notification formatted according to Google FCM HTTP v1 standards.
 * Supports iOS APNs background/foreground badges & Android channels.
 */
export async function sendDirectPush(payload: DirectPushPayload): Promise<DirectPushResult> {
  let messaging: Messaging
  try {
    messaging = getFirebaseMessaging()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[firebase-admin] Cannot send push — Firebase initialization error:', msg)
    return {
      success: false,
      error: `Firebase Admin unconfigured: ${msg}`,
      isDeadToken: false,
    }
  }

  const dataPayload: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    deepLink: payload.deepLink || 'tasklync://home',
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    ...(payload.data ?? {}),
  }

  if (payload.imageUrl) {
    dataPayload.imageUrl = payload.imageUrl
    dataPayload.image = payload.imageUrl
  }

  const message: Message = {
    token: payload.token,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        channelId: 'tasklync_announcements',
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
      fcmOptions: payload.imageUrl ? { imageUrl: payload.imageUrl } : undefined,
    },
  }

  try {
    const messageId = await messaging.send(message)
    return { success: true, messageId, isDeadToken: false }
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string }
    const code = String(errObj?.code || '')
    const msg = String(errObj?.message || '')

    const isDead =
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token') ||
      msg.includes('NotRegistered') ||
      msg.includes('invalid registration token')

    return {
      success: false,
      error: msg || code || 'Unknown FCM delivery failure',
      isDeadToken: isDead,
    }
  }
}
