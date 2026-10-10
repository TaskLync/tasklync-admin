import 'dotenv/config'
import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

async function prompt() {
  const rl = createInterface({ input, output })
  try {
    const email = (await rl.question('Super admin email: ')).trim()
    const fullName = (await rl.question('Full name: ')).trim()
    const password = await rl.question(
      'Temporary password (change after first login): '
    )
    return { email, fullName, password }
  } finally {
    rl.close()
  }
}

async function main() {
  const { hashPassword } = await import('../lib/auth/password')
  const { db } = await import('../lib/db')

  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM admin_users WHERE role = 'SUPER_ADMIN'`
  )
  if (rows[0].count >= 2) {
    console.error('Maximum of 2 super admins already exist.')
    console.error('Additional admins must be created through the admin panel.')
    return
  }

  const { email, fullName, password } = await prompt()

  if (!email || !fullName || !password) {
    console.error('Email, full name, and password are required.')
    return
  }

  const existing = await db.query(
    `SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  )
  if (existing.rows.length > 0) {
    console.error(`An admin account with ${email} already exists.`)
    return
  }

  const hash = await hashPassword(password)

  await db.query(
    `INSERT INTO admin_users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, 'SUPER_ADMIN', TRUE)`,
    [email, hash, fullName]
  )

  console.log(`\nSuper admin ${email} created successfully.`)
  console.log('MFA setup will be required on first login.')
}

main()
  .catch((e) => {
    console.error('Failed to create super admin:', e)
    process.exitCode = 1
  })
  .finally(() => process.exit())