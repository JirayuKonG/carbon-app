import { formatFriendlyErrorMessage } from '@/lib/friendly-text'

export interface QueryErrorItem {
  label: string
  error: unknown
}

export interface QueryIssue {
  label: string
  message: string
  isConnectionIssue: boolean
}

export function getQueryErrorMessage(error: unknown) {
  if (error instanceof Error) return formatFriendlyErrorMessage(error.message)
  if (typeof error === 'string') return formatFriendlyErrorMessage(error)
  return 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
}

export function looksLikeConnectionError(message: string) {
  return /failed to fetch|network|timeout|timed out|econn|socket|connect|connection|database|postgres|prisma|query engine|server/i.test(message)
}

export function collectQueryIssues(items: QueryErrorItem[]): QueryIssue[] {
  return items
    .filter((item) => Boolean(item.error))
    .map((item) => {
      const message = getQueryErrorMessage(item.error)
      return {
        label: item.label,
        message,
        isConnectionIssue: looksLikeConnectionError(message),
      }
    })
}
