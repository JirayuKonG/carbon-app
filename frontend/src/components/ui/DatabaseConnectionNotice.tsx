import { CircleAlert } from 'lucide-react'
import { collectQueryIssues, type QueryErrorItem } from '@/lib/query-errors'

interface DatabaseConnectionNoticeProps {
  items: QueryErrorItem[]
  className?: string
  onRetry?: () => void
}

export function DatabaseConnectionNotice({
  items,
  className = '',
  onRetry,
}: DatabaseConnectionNoticeProps) {
  const issues = collectQueryIssues(items)

  if (!issues.length) return null

  const affectedLabels = Array.from(new Set(issues.map((issue) => issue.label)))
  const connectionIssueCount = issues.filter((issue) => issue.isConnectionIssue).length

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">
              {connectionIssueCount > 0 ? 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ' : 'โหลดข้อมูลบางส่วนไม่สำเร็จ'}
            </div>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              {connectionIssueCount > 0
                ? 'ระบบยังติดต่อฐานข้อมูลหรือ API ไม่ได้บางส่วน จึงอาจแสดงข้อมูลไม่ครบ'
                : 'บางส่วนของข้อมูลอ้างอิงในหน้านี้ยังโหลดไม่สำเร็จ'}
            </p>
            <p className="mt-2 text-xs text-amber-700">
              ส่วนที่ได้รับผล: {affectedLabels.join(', ')}
            </p>
            <p className="mt-1 text-xs text-amber-700">
              รายละเอียด: {issues[0]?.message}
            </p>
          </div>
        </div>
        {onRetry && (
          <button
            type="button"
            className="btn-secondary btn-sm shrink-0 border-amber-200 bg-white/80 text-amber-900 hover:bg-white"
            onClick={onRetry}
          >
            ลองเชื่อมต่ออีกครั้ง
          </button>
        )}
      </div>
    </div>
  )
}
