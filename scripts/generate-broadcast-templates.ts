// scripts/generate-broadcast-templates.ts
// Usage:  npx tsx scripts/generate-broadcast-templates.ts <path-to>/notification-service/src/templates
// With no argument it writes to ./generated-templates so you can review first.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CATALOG, templateKey, type TemplateLanguage } from '../lib/notification-catalog'
import { CUSTOM_TEMPLATE_KEY } from '../lib/notification-constants'

const out = resolve(process.argv[2] ?? './generated-templates')
const pushDir = join(out, 'push')
const smsDir = join(out, 'sms')
mkdirSync(pushDir, { recursive: true })
mkdirSync(smsDir, { recursive: true })

// {{x}} -> {{{x}}} (no HTML escaping inside push/SMS text)
const raw = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, '{{{$1}}}')
const writeJson = (file: string, data: object) =>
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')

let files = 0

for (const t of CATALOG) {
  for (const lang of Object.keys(t.copy) as TemplateLanguage[]) {
    const key = templateKey(t.id, lang)
    const c = t.copy[lang]
    writeJson(join(pushDir, `${key}.json`), {
      title: raw(c.title),
      body: raw(c.body),
      deep_link: t.deepLink,
    })
    writeFileSync(join(smsDir, `${key}.hbs`), `TaskLync: ${raw(c.body)}\n`, 'utf8')
    files += 2
  }
}

// Generic template for admin-written messages.
writeJson(join(pushDir, `${CUSTOM_TEMPLATE_KEY}.json`), {
  title: '{{{title}}}',
  body: '{{{body}}}',
  deep_link: '{{{deepLink}}}',
})
writeFileSync(join(smsDir, `${CUSTOM_TEMPLATE_KEY}.hbs`), 'TaskLync: {{{body}}}\n', 'utf8')
files += 2

console.log(`Wrote ${files} template files to ${out}`)
console.log('Copy push/ and sms/ into services/notification-service/src/templates and restart the service.')