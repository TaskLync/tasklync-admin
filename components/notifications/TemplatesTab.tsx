// components/notifications/TemplatesTab.tsx
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { CATALOG, LANGUAGE_LABEL, previewTemplate, type TemplateKind } from '@/lib/notification-catalog'
import { CATEGORY_LABEL, KIND_LABEL } from './notification-ui'
import type { ComposeSeed } from './ComposeTab'

const KINDS: (TemplateKind | 'all')[] = ['all', 'operational', 'promo', 'greeting', 'seasonal']

export default function TemplatesTab({ onUse }: { onUse: (seed: ComposeSeed) => void }) {
  const [kind, setKind] = useState<TemplateKind | 'all'>('all')
  const items = CATALOG.filter((t) => kind === 'all' || t.kind === kind)

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-4 text-sm text-gray-600">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sending respectfully</h2>
        <ul className="list-disc pl-5 text-xs">
          <li>Muharram / Ashura: no promotions. Send nothing, or at most a respectful non-commercial message.</li>
          <li>Defence Day, Kashmir Day, Youm-e-Takbeer: greeting only, no discounts.</li>
          <li>Religious occasions: keep it simple and avoid festive tone.</li>
          <li>Ramadan, both Eids, Chand Raat and 12 Rabi ul Awwal follow the moon. Send them manually on the day.</li>
          <li>Marketing is opt-in: expect a push to reach a minority of the audience. Everyone still sees it in the app.</li>
        </ul>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm transition-colors duration-150',
              kind === k
                ? 'border-[#1F6F5F] font-medium text-[#1F6F5F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {k === 'all' ? 'All' : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((t) => (
          <Card key={t.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                <p className="text-xs text-gray-500">{t.description}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onUse({ templateId: t.id, language: 'en' })}
              >
                Use in composer
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge tone={t.category === 'platform' ? 'info' : 'warning'}>{CATEGORY_LABEL[t.category]}</Badge>
              <Badge tone="neutral">{KIND_LABEL[t.kind]}</Badge>
              {t.audience !== 'anyone' && <Badge tone="neutral">For {t.audience}</Badge>}
              {t.greetingOnly && <Badge tone="danger">No discounts</Badge>}
              {t.variables.map((v) => (
                <Badge key={v.key} tone="neutral">
                  {`{{${v.key}}}`}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['en', 'ur'] as const).map((lang) => {
                const p = previewTemplate(t, lang, {})
                return (
                  <div key={lang} className="rounded-md bg-gray-50 px-3 py-2">
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {LANGUAGE_LABEL[lang]}
                    </p>
                    <p className="text-xs font-semibold text-gray-800">{p.title}</p>
                    <p className="text-xs text-gray-600">{p.body}</p>
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Templates live in <code>lib/notification-catalog.ts</code>. To add or edit one, change the catalog, run
        <code> npx tsx scripts/generate-broadcast-templates.ts</code>, copy the files into notification-service and redeploy it.
      </p>
    </div>
  )
}