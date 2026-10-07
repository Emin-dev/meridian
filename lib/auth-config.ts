/** A deployment with database access must never fall back to anonymous mode. */
export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

/**
 * Shared by the proxy, server actions and export routes. Only a deployment
 * without DATABASE_URL is a public demo. Invalid database-backed configuration
 * throws before a caller can read or mutate application data.
 */
export function isAuthEnabled(): boolean {
  if (!process.env.DATABASE_URL) return false;

  if (process.env.AUTH_ENABLED === "false") {
    throw new AuthConfigurationError(
      "AUTH_ENABLED=false is only supported without DATABASE_URL."
    );
  }

  if (!process.env.AUTH_SECRET?.trim()) {
    throw new AuthConfigurationError(
      "AUTH_SECRET is required when DATABASE_URL is configured."
    );
  }

  return true;
}
