/**
 * Loads local environment files before anything reads process.env.
 *
 * Order matters: `.env.local` is loaded last so it wins, matching the
 * convention Vercel and Next.js use. Missing files are fine.
 */

const FILES = ['.env', '.env.local']

export const loadEnvFiles = () => {
  if (typeof process.loadEnvFile !== 'function') return []
  const loaded = []
  for (const file of FILES) {
    try {
      process.loadEnvFile(file)
      loaded.push(file)
    } catch {
      /* not present - rely on the real environment */
    }
  }
  return loaded
}

/** True when DATABASE_URL holds something usable. */
export const hasDatabaseUrl = () => {
  const value = process.env.DATABASE_URL
  return typeof value === 'string' && value.trim().length > 0 && !/^\[?SENSITIVE\]?$/i.test(value.trim())
}

export const MISSING_DATABASE_URL =
  'DATABASE_URL is not set.\n' +
  'Add it to .env in the project root, e.g.\n' +
  '  DATABASE_URL=postgresql://user:password@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require\n' +
  'It is git-ignored. Find the connection string in Neon -> Connection Details.'