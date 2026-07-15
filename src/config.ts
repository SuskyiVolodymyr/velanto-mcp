/** Runtime configuration, read from the environment. */
export interface Config {
  /** Base URL of the Velanto API, without a trailing slash. */
  apiUrl: string;
  /** A Velanto Personal Access Token (`vlt_pat_…`). */
  token: string;
}

export const DEFAULT_API_URL = "https://api.playvelanto.com";

/**
 * Build the config from environment variables. Throws a clear error if the
 * token is missing, since the server can't do anything useful without it.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const token = env.VELANTO_API_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "VELANTO_API_TOKEN is not set. Create a Personal Access Token in the " +
        "Velanto settings (API tokens) and set it as VELANTO_API_TOKEN.",
    );
  }
  const apiUrl = (env.VELANTO_API_URL?.trim() || DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );
  return { apiUrl, token };
}
