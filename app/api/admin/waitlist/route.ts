import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import { parseUserAgent } from '@/lib/parse-user-agent'
import type { WaitlistEntryEnriched, WaitlistListResponse } from '@/types/waitlist'

const ALLOWED_SORT = new Set(['created_at', 'position', 'email'])

export async function GET(request: Request) {
  const guard = await requirePermission('waitlist:view')
  if (!guard.ok) return guard.response

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') ?? 25)))
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')
  const utmSource = searchParams.get('utm_source')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const sortByRaw = searchParams.get('sortBy') ?? 'position'
  const sortColumn = ALLOWED_SORT.has(sortByRaw) ? sortByRaw : 'position'
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'DESC' : 'ASC'

  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(`email ILIKE $${params.length}`)
  }
  if (status && status !== 'all') {
    params.push(status)
    conditions.push(`status = $${params.length}`)
  }
  if (utmSource && utmSource !== 'all') {
    if (utmSource === 'direct') {
      conditions.push('utm_source IS NULL')
    } else {
      params.push(utmSource)
      conditions.push(`utm_source = $${params.length}`)
    }
  }
  if (dateFrom) {
    params.push(dateFrom)
    conditions.push(`created_at >= $${params.length}`)
  }
  if (dateTo) {
    params.push(dateTo)
    conditions.push(`created_at <= $${params.length}`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const countResult = await db.query(`SELECT COUNT(*) FROM waitlist ${whereClause}`, params)
    const total = Number(countResult.rows[0].count)

    const offset = (page - 1) * pageSize
    const dataParams = [...params, pageSize, offset]

    const dataResult = await db.query(
      `SELECT * FROM waitlist ${whereClause}
       ORDER BY ${sortColumn} ${sortDir}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    )

    const enriched: WaitlistEntryEnriched[] = dataResult.rows.map((row) => {
      const parsed = parseUserAgent(row.user_agent)
      return {
        ...row,
        is_bot: parsed.isBot,
        device_type: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
      }
    })

    const payload: WaitlistListResponse = { rows: enriched, total, page, pageSize }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[waitlist/list]', error)
    return NextResponse.json({ error: 'Failed to load waitlist entries' }, { status: 500 })
  }
}