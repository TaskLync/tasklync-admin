import { db } from '../lib/db'
import { hashPassword } from '../lib/auth/password'
import readline from 'readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve))

async function main() {
  // Guard: refuse to run if a super admin already exists, unless explicitly forced
  const { rows } = await db.query(
    `SELECT id FROM admin_users WHERE role = 'SUPER_ADMIN' LIMIT 1`
  )
  if (rows.length > 0 && !process.argv.includes('--force')) {
    console.error('A super admin already exists. Use the admin panel to create additional admins,')
    console.error('   or re-run with --force if you really want to seed another one (e.g. fresh test env).')
    rl.close()
    process.exit(1)
  }

  const email = await ask('Super admin email: ')
  const fullName = await ask('Full name: ')
  const password = await ask('Temporary password (change after first login): ')

  const hash = await hashPassword(password)
  await db.query(
    `INSERT INTO admin_users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, 'SUPER_ADMIN', TRUE)`,
    [email, hash, fullName]
  )

  console.log(`Super admin ${email} created. MFA setup will be required on first login.`)
  rl.close()
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })