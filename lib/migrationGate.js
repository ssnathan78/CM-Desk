const fs = require("node:fs")
const path = require("node:path")
const pg = require("pg")

/**
 * Drizzle applies a migration when the newest stored created_at is less than
 * that migration's journal `when`. Pending means the database is behind the
 * journal. This does not apply SQL.
 */
function pendingMigrationTags(entries, appliedMillis) {
  const list = Array.isArray(entries) ? entries : []
  const applied = (appliedMillis || [])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value))
  if (!applied.length) return list.map(entry => entry.tag)
  const last = Math.max(...applied)
  return list.filter(entry => Number(entry.when) > last).map(entry => entry.tag)
}

function readJournal(migrationsFolder) {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json")
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"))
  return Array.isArray(journal.entries) ? journal.entries : []
}

async function appliedMigrationMillis(pool) {
  const reg = await pool.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`)
  if (!reg.rows[0]?.name) return []
  const rows = await pool.query(`SELECT created_at FROM drizzle.__drizzle_migrations`)
  return rows.rows.map(row => Number(row.created_at))
}

/** Same host remap as scripts/migrate.mjs so a laptop .env that says @postgres still reaches Compose. */
function hostReachableDatabaseUrl(raw) {
  if (!raw) return raw
  if (fs.existsSync("/.dockerenv")) return raw
  if (raw.includes("@db:") || raw.includes("@postgres:")) {
    return "postgresql://postgres:postgres@localhost:5432/trading_db"
  }
  try {
    const parsed = new URL(raw)
    if (parsed.hostname === "db" || parsed.hostname === "postgres") {
      return "postgresql://postgres:postgres@localhost:5432/trading_db"
    }
  } catch {
    // keep the original url
  }
  return raw
}

async function assertMigrationsCurrent(options = {}) {
  const url = hostReachableDatabaseUrl(
    (options.databaseUrl || process.env.DATABASE_URL || "").trim()
  )
  if (!url) {
    throw new Error("DATABASE_URL is not set. Refusing to start workers.")
  }
  const folder = options.migrationsFolder || path.join(__dirname, "..", "drizzle")
  const entries = readJournal(folder)
  const pool = new pg.Pool({ connectionString: url })
  try {
    const applied = await appliedMigrationMillis(pool)
    const pending = pendingMigrationTags(entries, applied)
    if (pending.length) {
      throw new Error(
        `Refusing to trade. Pending migrations: ${pending.join(", ")}. Run yarn migrate before start.`
      )
    }
    return pending
  } finally {
    await pool.end()
  }
}

module.exports = {
  pendingMigrationTags,
  readJournal,
  assertMigrationsCurrent,
}
