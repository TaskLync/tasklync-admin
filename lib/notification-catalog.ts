// lib/notification-catalog.ts
// Shared by server routes, client components AND scripts/generate-broadcast-templates.ts.
// No server-only imports. Relative imports only so `tsx` can run the script without path aliases.
import { CUSTOM_TEMPLATE_KEY, DEFAULT_DEEP_LINK, type BroadcastCategory } from './notification-constants'

export type TemplateLanguage = 'en' | 'ur'
export const LANGUAGE_LABEL: Record<TemplateLanguage, string> = { en: 'English', ur: 'Roman Urdu' }

export type TemplateKind = 'operational' | 'promo' | 'greeting' | 'seasonal'
export type TemplateAudience = 'users' | 'workers' | 'anyone'

export interface TemplateVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'year'
  required?: boolean // default true
  placeholder?: string
  min?: number
  max?: number
}

export interface LocalizedCopy {
  title: string
  body: string
}

export interface CatalogTemplate {
  id: string
  name: string
  description: string
  kind: TemplateKind
  category: BroadcastCategory
  audience: TemplateAudience
  /** Sensitive occasion: greeting only, never attach a discount. */
  greetingOnly?: boolean
  variables: TemplateVariable[]
  deepLink: string
  copy: Record<TemplateLanguage, LocalizedCopy>
}

const USER_LINK = DEFAULT_DEEP_LINK
const WORKER_LINK = 'tasklync://worker/profile'

const DISCOUNT: TemplateVariable = {
  key: 'discount', label: 'Discount (%)', type: 'number', min: 1, max: 90, placeholder: '15',
}
const CITY: TemplateVariable = { key: 'city', label: 'City', type: 'text', placeholder: 'Lahore' }
const CATEGORY: TemplateVariable = {
  key: 'category', label: 'Service', type: 'text', placeholder: 'AC repair',
}

export const CATALOG: CatalogTemplate[] = [
  // ---------- Operational (category: platform) ----------
  {
    id: 'maintenance_notice', name: 'Scheduled maintenance',
    description: 'Warn everyone about planned downtime.',
    kind: 'operational', category: 'platform', audience: 'anyone',
    variables: [
      { key: 'time', label: 'From', type: 'text', placeholder: '2:00 AM' },
      { key: 'time2', label: 'Until', type: 'text', placeholder: '4:00 AM' },
    ],
    deepLink: USER_LINK,
    copy: {
      en: { title: 'Scheduled maintenance', body: 'Tasklync will be down for maintenance from {{time}} to {{time2}}.' },
      ur: { title: 'Maintenance ki itla', body: 'Tasklync {{time}} se {{time2}} tak maintenance ke liye band rahe ga.' },
    },
  },
  {
    id: 'app_update', name: 'App update available',
    description: 'Nudge people to update the app.',
    kind: 'operational', category: 'platform', audience: 'anyone',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Update available', body: 'New Tasklync version is out with faster booking. Update now.' },
      ur: { title: 'Naya version', body: 'Tasklync ka naya version aa gaya, tez booking ke saath. Abhi update karein.' },
    },
  },
  {
    id: 'fraud_warning', name: 'Fraud / OTP warning',
    description: 'Safety reminder. Never share OTP or card details.',
    kind: 'operational', category: 'platform', audience: 'anyone',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Stay safe', body: 'Tasklync never asks for OTP or card details on call or WhatsApp.' },
      ur: { title: 'Hoshiyar rahein', body: 'Tasklync kabhi call ya WhatsApp par OTP ya card details nahi mangta.' },
    },
  },

  // ---------- Promotions (category: marketing) ----------
  {
    id: 'city_launch', name: 'New city launch',
    description: 'Announce Tasklync in a new city with a first-booking discount.',
    kind: 'promo', category: 'marketing', audience: 'users',
    variables: [CITY, DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'Now live in {{city}}', body: "We're now in {{city}}! First booking {{discount}}% off." },
      ur: { title: 'Ab {{city}} mein live', body: 'Ab hum {{city}} mein hain! Pehli booking par {{discount}}% off.' },
    },
  },
  {
    id: 'weekend_flash_sale', name: 'Weekend flash sale',
    description: 'Discount on one service category for the weekend.',
    kind: 'promo', category: 'marketing', audience: 'users',
    variables: [CATEGORY, DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'Weekend offer', body: 'Weekend offer: {{discount}}% off all {{category}} bookings.' },
      ur: { title: 'Weekend offer', body: 'Weekend offer: tamam {{category}} bookings par {{discount}}% off.' },
    },
  },
  {
    id: 'new_category', name: 'New service category',
    description: 'Announce a newly launched service.',
    kind: 'promo', category: 'marketing', audience: 'users',
    variables: [CATEGORY], deepLink: USER_LINK,
    copy: {
      en: { title: 'New on Tasklync', body: 'New on Tasklync: {{category}}. Book now.' },
      ur: { title: 'Tasklync par naya', body: 'Tasklync par naya: {{category}}. Abhi book karein.' },
    },
  },
  {
    id: 'winback_discount', name: 'Win-back discount',
    description: 'Bring back users who stopped booking.',
    kind: 'promo', category: 'marketing', audience: 'users',
    variables: [DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'We miss you!', body: "We miss you! Here's {{discount}}% off your next booking." },
      ur: { title: 'Hum aapko yaad kar rahe hain!', body: 'Hum aapko yaad kar rahe hain! Agli booking par {{discount}}% discount.' },
    },
  },
  {
    id: 'worker_demand_high', name: 'Worker: demand is high',
    description: 'Ask workers in an area to go online. For automatic spikes the service already sends category_trending_nudge.',
    kind: 'promo', category: 'marketing', audience: 'workers',
    variables: [{ key: 'area', label: 'Area', type: 'text', placeholder: 'DHA Lahore' }],
    deepLink: WORKER_LINK,
    copy: {
      en: { title: 'Demand is high', body: 'Demand is high in {{area}}. Go online and earn more.' },
      ur: { title: 'Demand zyada hai', body: '{{area}} mein demand zyada hai. Online ho kar zyada kamayein.' },
    },
  },

  // ---------- Occasions (category: marketing). Lunar dates are manual sends. ----------
  {
    id: 'pakistan_day_greeting', name: 'Pakistan Day (23 Mar)',
    description: 'Greeting with a one-day discount.',
    kind: 'greeting', category: 'marketing', audience: 'users',
    variables: [DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'Happy Pakistan Day!', body: 'Happy Pakistan Day! Enjoy {{discount}}% off today.' },
      ur: { title: 'Youm-e-Pakistan mubarak!', body: 'Youm-e-Pakistan mubarak! Aaj {{discount}}% discount payein.' },
    },
  },
  {
    id: 'independence_day_greeting', name: 'Independence Day (14 Aug)',
    description: 'Greeting with the AZADI{{year}} code. Template key is also used by the service test suite.',
    kind: 'greeting', category: 'marketing', audience: 'users',
    variables: [DISCOUNT, { key: 'year', label: 'Year', type: 'year', min: 2024, max: 2100 }],
    deepLink: USER_LINK,
    copy: {
      en: { title: 'Happy Independence Day!', body: 'Jashn-e-Azadi Mubarak! {{discount}}% off all bookings today. Code: AZADI{{year}}' },
      ur: { title: 'Jashn-e-Azadi Mubarak!', body: 'Jashn-e-Azadi Mubarak! Aaj tamam bookings par {{discount}}% off. Code: AZADI{{year}}' },
    },
  },
  {
    id: 'ramadan_greeting', name: 'Ramadan start (lunar, manual)',
    description: 'Greeting plus home-prep services. Send manually on moon-sighting day.',
    kind: 'greeting', category: 'marketing', audience: 'users',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Ramadan Mubarak!', body: 'Ramadan Mubarak! Get your home ready: deep clean, AC and plumbing checks.' },
      ur: { title: 'Ramazan Mubarak!', body: 'Ramazan Mubarak! Ghar tayyar karein: safai, AC aur plumbing check.' },
    },
  },
  {
    id: 'eid_ul_fitr_greeting', name: 'Eid ul Fitr (lunar, manual)',
    description: 'Greeting with a discount on the next booking.',
    kind: 'greeting', category: 'marketing', audience: 'users',
    variables: [DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'Eid Mubarak!', body: 'Eid Mubarak! Enjoy {{discount}}% off on your next booking.' },
      ur: { title: 'Eid Mubarak!', body: 'Eid Mubarak! Agli booking par {{discount}}% discount.' },
    },
  },
  {
    id: 'eid_ul_adha_greeting', name: 'Eid ul Adha (lunar, manual)',
    description: 'Greeting with post-Eid cleaning discount.',
    kind: 'greeting', category: 'marketing', audience: 'users',
    variables: [DISCOUNT], deepLink: USER_LINK,
    copy: {
      en: { title: 'Eid ul Adha Mubarak!', body: 'Eid ul Adha Mubarak! Book post-Eid cleaning at {{discount}}% off.' },
      ur: { title: 'Eid ul Adha Mubarak!', body: 'Eid ul Adha Mubarak! Eid ke baad ki safai {{discount}}% off par book karein.' },
    },
  },
  {
    id: 'labour_day_greeting', name: 'Labour Day (1 May) — workers',
    description: 'Thank-you message for workers. No discount.',
    kind: 'greeting', category: 'marketing', audience: 'workers', greetingOnly: true,
    variables: [], deepLink: WORKER_LINK,
    copy: {
      en: { title: 'Happy Labour Day!', body: 'Happy Labour Day! You build our homes. Thank you.' },
      ur: { title: 'Youm-e-Mazdoor mubarak!', body: 'Youm-e-Mazdoor mubarak! Aap hamare gharon ko banate hain. Shukriya.' },
    },
  },
  {
    id: 'defence_day_greeting', name: 'Defence Day (6 Sep)',
    description: 'Greeting only. Sensitive occasion: no discounts.',
    kind: 'greeting', category: 'marketing', audience: 'anyone', greetingOnly: true,
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Youm-e-Difa', body: 'Salute to our heroes. Youm-e-Difa.' },
      ur: { title: 'Youm-e-Difa', body: 'Hamare hero ko salam. Youm-e-Difa Paindabad.' },
    },
  },

  // ---------- Seasonal services (category: marketing) ----------
  {
    id: 'summer_ac_service', name: 'Summer: AC servicing',
    description: 'Run in March to May, before the heat.',
    kind: 'seasonal', category: 'marketing', audience: 'users',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'AC servicing season', body: 'Heat is coming. Book AC servicing before the rush.' },
      ur: { title: 'AC service ka mausam', body: 'Garmi aa rahi hai. Rush se pehle AC service book karein.' },
    },
  },
  {
    id: 'monsoon_leak_repair', name: 'Monsoon: leaks and seepage',
    description: 'Run in July to September.',
    kind: 'seasonal', category: 'marketing', audience: 'users',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Monsoon is here', body: 'Rain season: fix roof leaks and seepage now.' },
      ur: { title: 'Barsaat ka mausam', body: 'Barsaat ka mausam: chhat ki leakage aur seelan abhi theek karwayein.' },
    },
  },
  {
    id: 'winter_geyser_check', name: 'Winter: geyser check',
    description: 'Run in November to January.',
    kind: 'seasonal', category: 'marketing', audience: 'users',
    variables: [], deepLink: USER_LINK,
    copy: {
      en: { title: 'Winter is coming', body: 'Geyser check before the cold hits.' },
      ur: { title: 'Sardi aa rahi hai', body: 'Sardi se pehle geyser check karwayein.' },
    },
  },
]

// ---------- Helpers ----------

export const getTemplate = (id: string) => CATALOG.find((t) => t.id === id)
export const templateKey = (id: string, lang: TemplateLanguage) => `${id}_${lang}`

export function parseTemplateKey(key: string): { template: CatalogTemplate; language: TemplateLanguage } | null {
  const m = /^(.+)_(en|ur)$/.exec(key)
  const template = m ? getTemplate(m[1]) : undefined
  return template && m ? { template, language: m[2] as TemplateLanguage } : null
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

export function renderCopy(
  text: string,
  values: Record<string, string | number | undefined | null>,
  fallback?: (key: string) => string
): string {
  return text.replace(VAR_RE, (_m, key: string) => {
    const v = values[key]
    if (v !== undefined && v !== null && v !== '') return String(v)
    return fallback ? fallback(key) : `{{${key}}}`
  })
}

export function defaultValues(t: CatalogTemplate): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of t.variables) out[v.key] = v.type === 'year' ? String(new Date().getFullYear()) : ''
  return out
}

/** Validates + coerces variable values. Used by the launch route and the composer. */
export function checkValues(
  t: CatalogTemplate,
  raw: Record<string, unknown>
): { data: Record<string, string | number>; errors: string[] } {
  const data: Record<string, string | number> = {}
  const errors: string[] = []

  for (const v of t.variables) {
    const s = String(raw[v.key] ?? '').trim()
    if (!s) {
      if (v.required !== false) errors.push(`${v.label} is required`)
      continue
    }
    if (v.type === 'text') {
      if (s.length > 40) errors.push(`${v.label} must be 40 characters or fewer`)
      else if (/["\\]/.test(s)) errors.push(`${v.label} can't contain double quotes or backslashes`)
      else data[v.key] = s
    } else {
      const n = Number(s)
      const bad =
        !Number.isFinite(n) || (v.min !== undefined && n < v.min) || (v.max !== undefined && n > v.max)
      if (bad) errors.push(`${v.label} must be a number between ${v.min ?? '−∞'} and ${v.max ?? '∞'}`)
      else data[v.key] = n
    }
  }
  return { data, errors }
}

export type PreviewMessage = { title: string; body: string }

/** What the push will look like. Missing variables show as [label] so the admin sees what's left to fill. */
export function previewTemplate(
  t: CatalogTemplate,
  lang: TemplateLanguage,
  values: Record<string, string | number | undefined>
): PreviewMessage {
  const label = (key: string) => `[${t.variables.find((v) => v.key === key)?.label ?? key}]`
  const c = t.copy[lang]
  return { title: renderCopy(c.title, values, label), body: renderCopy(c.body, values, label) }
}

/** Rebuilds the message a past campaign sent, from its template_key + template_data. */
export function resolveCampaignMessage(
  key: string,
  data: Record<string, unknown>
): { title: string; body: string; label: string } | null {
  if (key === CUSTOM_TEMPLATE_KEY) {
    return { title: String(data.title ?? ''), body: String(data.body ?? ''), label: 'Custom message' }
  }
  const parsed = parseTemplateKey(key)
  if (!parsed) return null
  const values = data as Record<string, string | number>
  const p = previewTemplate(parsed.template, parsed.language, values)
  return { ...p, label: `${parsed.template.name} · ${LANGUAGE_LABEL[parsed.language]}` }
}