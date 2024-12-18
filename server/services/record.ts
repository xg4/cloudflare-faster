import dayjs from 'dayjs'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { groupBy, isEmpty, map, max, min } from 'lodash-es'
import { db } from '../db'
import { latencyRecordTable } from '../db/schema'
import { calculateAverage, calculateStd } from '../utils/math'

export function filterRecords(
  records: {
    latency: number
    createdAt: Date
    id: string
    ipAddress: string
  }[],
) {
  const grouped = groupBy(records, 'ipAddress')

  const data = map(grouped, (items, label) => {
    const values = map(items, 'latency')
    const times = values.filter(i => i > 0)
    const packetLossRate = (values.length - times.length) / values.length
    const average = isEmpty(times) ? -1 : calculateAverage(times)
    const std = isEmpty(times) ? -1 : calculateStd(times, average)
    const [latest] = items

    return {
      label,
      values,
      packetLossRate,
      average,
      std,
      createdAt: latest?.createdAt.toISOString(),
      minValue: min(times) ?? Infinity,
      maxValue: max(times) ?? -Infinity,
    }
  })

  return data
}

export async function getRecords(params: { after?: string; before?: string; ip?: string }) {
  const filters = []
  if (params.before) filters.push(lte(latencyRecordTable.createdAt, dayjs(params.before).toDate()))
  if (params.after) filters.push(gte(latencyRecordTable.createdAt, dayjs(params.after).toDate()))
  if (params.ip) filters.push(eq(latencyRecordTable.ipAddress, params.ip))
  return db
    .select()
    .from(latencyRecordTable)
    .where(and(...filters))
    .orderBy(desc(latencyRecordTable.createdAt))
}

export async function deleteRecords(params: { before: string }) {
  return db.delete(latencyRecordTable).where(lte(latencyRecordTable.createdAt, dayjs(params.before).toDate()))
}
