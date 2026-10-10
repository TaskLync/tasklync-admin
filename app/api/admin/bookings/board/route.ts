// app/api/admin/bookings/board/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  BOARD_COLUMNS,
  BOARD_COLUMN_LIMIT,
  BOARD_TERMINAL_DAYS,
  type BoardColumn,
} from '@/lib/booking-constants'
import {
  BOARD_COLUMN_SQL,
  FROM_SQL,
  LIST_COLUMNS_SQL,
  buildBookingWhere,
  mapBookingRow,
  toWhereSql,
} from '@/lib/bookings-api'
import type { BookingBoard } from '@/types/booking'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('bookings:view')
  if (!guard.ok) return guard.response

  // The board columns ARE the statuses, so the status filter is ignored here.
  const { where, params } = buildBookingWhere(req.nextUrl.searchParams, { ignoreStatus: true })
  where.push(
    `(b.status::text IN ('PENDING','ACCEPTED','IN_PROGRESS','COMPLETED_BY_WORKER')
      OR b.updated_at >= now() - interval '${BOARD_TERMINAL_DAYS} days')`
  )

  const sql = `
    WITH c AS (
      SELECT ${LIST_COLUMNS_SQL}, ${BOARD_COLUMN_SQL} AS board_col
      ${FROM_SQL}
      ${toWhereSql(where)}
    ),
    r AS (
      SELECT c.*,
        row_number() OVER (
          PARTITION BY board_col
          ORDER BY (CASE WHEN board_col IN ('completed','cancelled_disputed') THEN -1 ELSE 1 END)
                   * extract(epoch FROM updated_at)
        ) AS rn,
        count(*) OVER (PARTITION BY board_col) AS col_total
      FROM c
    )
    SELECT * FROM r WHERE rn <= $${params.length + 1}
    ORDER BY board_col, rn
  `

  try {
    const { rows } = await db.query(sql, [...params, BOARD_COLUMN_LIMIT])

    const columns = Object.fromEntries(
      BOARD_COLUMNS.map((col) => [col, { total: 0, items: [] }])
    ) as unknown as BookingBoard['columns']

    for (const r of rows) {
      const col = r.board_col as BoardColumn
      columns[col].total = Number(r.col_total)
      columns[col].items.push(mapBookingRow(r))
    }

    return NextResponse.json({ columns } satisfies BookingBoard)
  } catch (err) {
    console.error('[GET /api/admin/bookings/board]', err)
    return NextResponse.json({ error: 'Failed to load the booking board' }, { status: 500 })
  }
}