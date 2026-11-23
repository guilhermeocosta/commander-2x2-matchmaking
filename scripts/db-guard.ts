/**
 * Shared checks for the database scripts. They run with Node's own TypeScript support and load
 * `.env.local` with `--env-file-if-exists`, so the connection string is never printed.
 */

/** Returns DATABASE_URL or exits. Refuses to run in a Vercel production environment. */
export function requireDatabaseUrl(script: string): string {
  if (process.env.VERCEL_ENV === "production") {
    console.error(`${script}: refusing to run with VERCEL_ENV=production.`);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      `${script}: DATABASE_URL is not set. Put a Neon *development branch* connection string ` +
        "in .env.local (never the production branch)."
    );
    process.exit(1);
  }
  return url;
}
