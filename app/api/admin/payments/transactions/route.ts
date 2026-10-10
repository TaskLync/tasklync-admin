// app/api/admin/payments/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/rbac-guard'
import {
  FEE_SQL,
  GROSS_SQL,
  TXN_COLUMNS_SQL,
  TXN_FROM_SQL,
  WORKER_SQL,
  buildTransactionWhere,
  mapTransactionRow,
  num,
  pagedResponse,
  parsePaging,
  paymentsErrorResponse,
} from '@/lib/payments-api'
import type { TransactionList } from '@/types/payment'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermission('payments:view')
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const { whereSql, params } = buildTransactionWhere(sp)
  const { page, pageSize, offset } = parsePaging(sp)

  const listSql = `
    SELECT ${TXN_COLUMNS_SQL}
    ${TXN_FROM_SQL}
    ${whereSql}
    ORDER BY txn_at DESC, b.id
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  const aggSql = `
    SELECT count(*)::int AS total,
           COALESCE(sum(${GROSS_SQL}), 0)  AS gross,
           COALESCE(sum(${FEE_SQL}), 0)    AS fees,
           COALESCE(sum(${WORKER_SQL}), 0) AS worker
    ${TXN_FROM_SQL}
    ${whereSql}
  `

  try {
    const [listRes, aggRes] = await Promise.all([
      db.query(listSql, [...params, pageSize, offset]),
      db.query(aggSql, params),
    ])
    const a = aggRes.rows[0]
    const body: TransactionList = {
      ...pagedResponse(listRes.rows.map(mapTransactionRow), a.total, page, pageSize),
      totals: { gross: num(a.gross), platformFee: num(a.fees), workerAmount: num(a.worker) },
    }
    return NextResponse.json(body)
  } catch (err) {
    return paymentsErrorResponse(err, '[GET /api/admin/payments/transactions]')
  }
}