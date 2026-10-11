// components/notifications/PhonePreview.tsx
import { Card } from '@/components/ui/Card'

interface Props {
  title: string
  body: string
  /** Show the SMS version too. */
  sms?: boolean
}

export default function PhonePreview({ title, body, sms }: Props) {
  const smsText = `TaskLync: ${body}`
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-gray-100 p-3">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-[#1F6F5F] text-[9px] font-bold text-white">
              T
            </span>
            <span className="uppercase tracking-wide">Tasklync · now</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {title || <span className="text-gray-300">Title</span>}
          </p>
          <p className="mt-0.5 break-words text-sm text-gray-600">
            {body || <span className="text-gray-300">Your message appears here</span>}
          </p>
        </div>
      </div>

      {sms && (
        <Card className="p-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">SMS</p>
          <p className="break-words text-sm text-gray-700">{smsText}</p>
          <p className={`mt-1 text-[11px] ${smsText.length > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
            {smsText.length} characters{smsText.length > 160 ? ' · sends as more than one SMS segment' : ''}
          </p>
        </Card>
      )}
    </div>
  )
}