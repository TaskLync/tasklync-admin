// types/notification.ts
import type {
  BroadcastCategory,
  BroadcastStatus,
  DeliveryChannel,
  SegmentType,
} from '@/lib/notification-constants'
import type { TemplateLanguage } from '@/lib/notification-catalog'

// ---------- Composer ----------

export type AudienceSelection =
  | { segmentType: 'all_users' }
  | { segmentType: 'all_workers' }
  | { segmentType: 'category_city'; categoryId: string; city: string }
  | { segmentType: 'custom_ids'; audience: 'users' | 'workers'; ids: string[] }

export type MessageDraft =
  | { mode: 'template'; templateId: string; language: TemplateLanguage; values: Record<string, string>; imageUrl?: string }
  | { mode: 'custom'; title: string; body: string; deepLink: string; imageUrl?: string }

export interface LaunchRequest {
  /** Internal label, never shown to recipients. */
  title: string
  message: MessageDraft
  channels: DeliveryChannel[]
  category: BroadcastCategory
  audience: AudienceSelection
  acknowledgeQuietHours: boolean
}

export interface LaunchResponse {
  campaignId: string
  status: string
}

export interface AudienceEstimate {
  entity: 'user' | 'worker'
  /** People who get the in-app feed entry (always). */
  segmentCount: number
  /** Likely to receive a push. null = couldn't be computed. */
  pushReach: number | null
  smsReach: number | null
  sample: { name: string | null; phone: string | null }[]
}

export interface ResolveResult {
  matched: { id: string; name: string | null; phone: string | null; email: string | null; hasFcmToken?: boolean }[]
  notFound: string[]
}

// ---------- Campaigns ----------

export interface CampaignListItem {
  id: string
  title: string
  templateKey: string
  category: BroadcastCategory
  channels: DeliveryChannel[]
  segmentType: SegmentType
  segmentFilter: Record<string, unknown>
  status: BroadcastStatus
  totalRecipients: number | null
  sentCount: number
  createdById: string | null
  createdByName: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface CampaignListResponse {
  data: CampaignListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CampaignFilters {
  search: string
  status: 'all' | BroadcastStatus
  segmentType: 'all' | SegmentType
  page: number
  pageSize: number
}

export interface DeliveryBreakdownRow {
  channel: string
  status: string
  count: number
}

export interface CampaignDetail extends CampaignListItem {
  templateData: Record<string, unknown>
  deliveries: DeliveryBreakdownRow[]
  feed: { total: number; read: number; withDelivery: number }
  errors: { channel: string; error: string | null; count: number }[]
}

export interface NotificationKpis {
  campaigns30d: number
  sending: number
  failed30d: number
  recipients30d: number
  /** SENT / (SENT + FAILED) for campaign deliveries, last 30 days. null = nothing attempted yet. */
  deliveryRate30d: number | null
}