// lib/firebase-admin.ts
// Direct Firebase Admin SDK singleton for TaskLync Admin.
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging, type Message } from 'firebase-admin/messaging'
import fs from 'node:fs'
import path from 'node:path'

let cachedApp: App | null = null
let cachedMessaging: Messaging | null = null

function loadServiceAccount(): Record<string, unknown> {
  const base64 = process.env.FCM_SERVICE_ACCOUNT_JSON_BASE64
  if (base64) {
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8')
      return JSON.parse(decoded)
    } catch (err: unknown) {
      console.warn('[firebase-admin] Failed to parse FCM_SERVICE_ACCOUNT_JSON_BASE64, falling back to file:', err)
    }
  }

  // Fallback to local service-account.json if present
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
    'Firebase service account credentials not found. Provide FCM_SERVICE_ACCOUNT_JSON_BASE64 in .env or place service-account.json in the project root.'
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
  const messaging = getFirebaseMessaging()

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
