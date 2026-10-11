// components/notifications/PhonePreview.tsx
'use client'

import { useState } from 'react'
import {
  Apple,
  Smartphone,
  MessageSquare,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  ImageIcon,
  Wifi,
  Battery,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type PreviewPlatform = 'ios' | 'android' | 'sms' | 'fcm'

interface Props {
  title: string
  body: string
  /** Show the SMS option. */
  sms?: boolean
  imageUrl?: string
  deepLink?: string
  templateKey?: string
}

export default function PhonePreview({
  title,
  body,
  sms = true,
  imageUrl,
  deepLink = 'tasklync://home',
  templateKey = 'admin_custom_message',
}: Props) {
  const [platform, setPlatform] = useState<PreviewPlatform>('ios')
  const [androidExpanded, setAndroidExpanded] = useState(true)
  const [copiedPayload, setCopiedPayload] = useState(false)

  const cleanTitle = title?.trim() || ''
  const cleanBody = body?.trim() || ''
  const cleanImage = imageUrl?.trim() || ''
  const smsText = `TaskLync: ${cleanBody || 'Your message appears here'}`

  // Linting / Quality Checks for Senior Push UX
  const titleOverLimit = cleanTitle.length > 50
  const bodyOverLimit = cleanBody.length > 120
  const hasUnreplacedVars = /\{\{|\}\}|\[|\]/.test(cleanTitle + cleanBody)

  // Construct Firebase FCM v1 HTTP API Payload
  const fcmPayload = {
    message: {
      notification: {
        title: cleanTitle || 'Notification Title',
        body: cleanBody || 'Notification body text',
        ...(cleanImage ? { image: cleanImage } : {}),
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'tasklync_general_notifications',
          icon: 'ic_notification',
          color: '#1F6F5F',
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          ...(cleanImage ? { image: cleanImage } : {}),
        },
      },
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
        payload: {
          aps: {
            alert: {
              title: cleanTitle || 'Notification Title',
              body: cleanBody || 'Notification body text',
            },
            sound: 'default',
            badge: 1,
            'mutable-content': cleanImage ? 1 : 0,
            category: 'TASKLYNC_ALERT',
          },
        },
        ...(cleanImage ? { fcm_options: { image: cleanImage } } : {}),
      },
      data: {
        deep_link: deepLink,
        template_key: templateKey,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
  }

  const fcmJson = JSON.stringify(fcmPayload, null, 2)

  function handleCopyFCM() {
    navigator.clipboard.writeText(fcmJson)
    setCopiedPayload(true)
    setTimeout(() => setCopiedPayload(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Platform Selector Segment */}
      <div className="flex items-center justify-between rounded-lg bg-gray-100 p-1 text-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
              platform === 'ios'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Apple size={13} /> iOS
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
              platform === 'android'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Smartphone size={13} /> Android
          </button>
          {sms && (
            <button
              type="button"
              onClick={() => setPlatform('sms')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors',
                platform === 'sms'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <MessageSquare size={13} /> SMS
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPlatform('fcm')}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-medium transition-colors',
            platform === 'fcm'
              ? 'bg-[#1F6F5F] text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          )}
          title="View Firebase FCM v1 Payload"
        >
          <Code2 size={12} /> FCM
        </button>
      </div>

      {/* ── 1. iOS Lockscreen Preview ── */}
      {platform === 'ios' && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-800 via-slate-900 to-black p-4 text-white shadow-md">
          {/* iOS Dynamic Island & Status Bar */}
          <div className="mb-6 flex items-center justify-between text-[11px] text-white/80">
            <span className="font-semibold tracking-tight">9:41</span>
            {/* Dynamic Island pill */}
            <div className="h-4.5 w-20 rounded-full bg-black/90 ring-1 ring-white/10" />
            <div className="flex items-center gap-1.5 text-white/70">
              <Wifi size={11} />
              <Battery size={13} />
            </div>
          </div>

          {/* Lock Screen Date & Time */}
          <div className="mb-4 text-center">
            <p className="text-[11px] font-medium tracking-wide text-white/60">Sunday, 11 October</p>
            <p className="text-3xl font-light tracking-tight text-white/90">09:41</p>
          </div>

          {/* Frosted Glass iOS Push Card */}
          <div className="rounded-2xl border border-white/20 bg-white/80 p-3.5 text-gray-900 shadow-xl backdrop-blur-xl">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1F6F5F] text-[10px] font-bold text-white shadow-xs">
                  T
                </div>
                <span className="text-[11px] font-semibold tracking-wider text-gray-600 uppercase">
                  TaskLync
                </span>
              </div>
              <span className="text-[11px] font-medium text-gray-500">now</span>
            </div>

            {/* Content */}
            <p className="text-[13px] font-semibold text-gray-900 leading-snug">
              {cleanTitle || <span className="text-gray-400 italic">Title goes here</span>}
            </p>
            <p className="mt-0.5 text-[12px] text-gray-700 leading-relaxed break-words">
              {cleanBody || (
                <span className="text-gray-400 italic">Your push message copy appears here</span>
              )}
            </p>

            {/* Rich Image (if attached) */}
            {cleanImage && (
              <div className="mt-2.5 overflow-hidden rounded-xl border border-gray-200/60 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cleanImage}
                  alt="Push Attachment"
                  className="h-32 w-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* iOS Action Buttons Pill */}
            <div className="mt-3 flex gap-2 border-t border-gray-200/60 pt-2.5">
              <button
                type="button"
                className="flex flex-1 items-center justify-center rounded-lg bg-gray-100/90 py-1.5 text-[11px] font-semibold text-gray-800 transition hover:bg-gray-200"
              >
                View
              </button>
              <button
                type="button"
                className="flex items-center justify-center rounded-lg bg-gray-100/90 px-3 py-1.5 text-[11px] font-semibold text-gray-500 transition hover:bg-gray-200"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center text-[10px] text-white/40">
            Swipe up to open
          </div>
        </div>
      )}

      {/* ── 2. Android 14 Material You Notification Shade ── */}
      {platform === 'android' && (
        <div className="rounded-2xl border border-gray-200 bg-[#F1F3F5] p-3 text-gray-900 shadow-sm">
          {/* Android Status Bar */}
          <div className="mb-2.5 flex items-center justify-between px-1 text-[11px] text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-800">09:41</span>
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#1F6F5F] text-[7px] text-white">
                T
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Wifi size={11} />
              <Battery size={13} />
            </div>
          </div>

          {/* Android Material You Notification Card */}
          <div className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs">
            {/* Header with expand toggle */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1F6F5F] text-[8px] font-bold text-white">
                  T
                </div>
                <span className="font-medium text-gray-700">TaskLync</span>
                <span>•</span>
                <span>2m</span>
              </div>
              <button
                type="button"
                onClick={() => setAndroidExpanded(!androidExpanded)}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title={androidExpanded ? 'Collapse view' : 'Expand view'}
              >
                {androidExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Collapsed / Expanded View */}
            <div className="mt-1.5">
              <p className="text-[13px] font-semibold text-gray-900 leading-snug">
                {cleanTitle || <span className="text-gray-400 italic">Title</span>}
              </p>

              {androidExpanded ? (
                <>
                  <p className="mt-0.5 text-[12px] text-gray-600 leading-relaxed break-words">
                    {cleanBody || (
                      <span className="text-gray-400 italic">Message body text</span>
                    )}
                  </p>

                  {/* Android BigPictureStyle banner */}
                  {cleanImage && (
                    <div className="mt-2.5 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cleanImage}
                        alt="Android Push Media"
                        className="h-32 w-full object-cover"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Android Quick Action Buttons */}
                  <div className="mt-3 flex items-center gap-2 pt-1 text-xs">
                    <span className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 font-medium text-[#1F6F5F]">
                      Open App
                    </span>
                    <span className="rounded-md px-2 py-1 font-medium text-gray-500 hover:bg-gray-100">
                      Remind Later
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-0.5 truncate text-[12px] text-gray-500">
                  {cleanBody || 'Collapsed one-line message preview...'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. SMS Preview ── */}
      {platform === 'sms' && (
        <Card className="p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-wide text-gray-700">
              SMS Message (TaskLync)
            </span>
            <span className="text-[11px] text-gray-400">Sender ID: TASKLYNC</span>
          </div>

          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-[13px] text-gray-800 break-words leading-relaxed">{smsText}</p>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>{smsText.length} characters</span>
            <span
              className={cn(
                'font-medium',
                smsText.length > 160 ? 'text-amber-600' : 'text-gray-400'
              )}
            >
              {smsText.length <= 160
                ? '1 SMS segment'
                : `${Math.ceil(smsText.length / 153)} SMS segments`}
            </span>
          </div>
        </Card>
      )}

      {/* ── 4. Firebase FCM v1 Payload Inspector ── */}
      {platform === 'fcm' && (
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Sparkles size={13} className="text-[#1F6F5F]" />
              <span>Firebase FCM v1 HTTP Payload</span>
            </div>
            <button
              type="button"
              onClick={handleCopyFCM}
              className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
            >
              {copiedPayload ? (
                <>
                  <Check size={11} className="text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy size={11} /> Copy JSON
                </>
              )}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-md bg-gray-950 p-2.5 font-mono text-[11px] text-emerald-400">
            <pre className="whitespace-pre-wrap">{fcmJson}</pre>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">
            Targeting endpoint: <code>/v1/projects/tasklync/messages:send</code>
          </p>
        </Card>
      )}

      {/* ── UX & Quality Warning Banners ── */}
      {(titleOverLimit || bodyOverLimit || hasUnreplacedVars) && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} className="shrink-0 text-amber-600" />
            <span>Push UX Recommendations</span>
          </div>
          <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-0.5">
            {titleOverLimit && (
              <li>
                Title is {cleanTitle.length} chars (over 50). It may truncate on smaller Android
                devices.
              </li>
            )}
            {bodyOverLimit && (
              <li>
                Body is {cleanBody.length} chars (over 120). Users will need to manually expand the
                notification shade on Android to read it all.
              </li>
            )}
            {hasUnreplacedVars && (
              <li>
                Unreplaced bracket tags found (e.g. <code>&#123;&#123;...&#125;&#125;</code> or{' '}
                <code>[...]</code>). Make sure all variables are filled.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}