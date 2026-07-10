// lib/parse-user-agent.ts
import { UAParser } from 'ua-parser-js'

export interface ParsedUserAgent {
  isBot: boolean
  deviceType: string
  browser: string
  os: string
}

// Catches your own Postman/curl/internal-tooling traffic so it doesn't
// pollute "real visitor" device/browser stats.
const BOT_PATTERN = /bot|crawler|spider|postman|curl|python-requests|axios|okhttp|insomnia/i

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { isBot: false, deviceType: 'Unknown', browser: 'Unknown', os: 'Unknown' }
  }

  if (BOT_PATTERN.test(userAgent)) {
    return { isBot: true, deviceType: 'Bot / API client', browser: 'N/A', os: 'N/A' }
  }

  const result = new UAParser(userAgent).getResult()

  const deviceType = result.device.type
    ? result.device.type.charAt(0).toUpperCase() + result.device.type.slice(1)
    : 'Desktop' // ua-parser-js leaves type undefined for normal desktop UAs

  return {
    isBot: false,
    deviceType,
    browser: result.browser.name ?? 'Unknown',
    os: result.os.name ?? 'Unknown',
  }
}