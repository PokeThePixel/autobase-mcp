export type AutobaseConfig = {
  apiBaseUrl: string;
  apiToken: string;
};

export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AutobaseConfig {
  const rawBaseUrl = env.AUTOBASE_API_BASE_URL?.trim();
  const apiToken = env.AUTOBASE_API_TOKEN?.trim();

  if (!rawBaseUrl) {
    throw new Error("AUTOBASE_API_BASE_URL is required.");
  }
  if (!apiToken) {
    throw new Error("AUTOBASE_API_TOKEN is required.");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("AUTOBASE_API_BASE_URL must be a valid URL.");
  }

  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new Error(
      "AUTOBASE_API_BASE_URL must not contain credentials, a query, or a fragment.",
    );
  }

  const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(
    baseUrl.hostname,
  );
  if (
    baseUrl.protocol !== "https:" &&
    !(baseUrl.protocol === "http:" && isLocalHost)
  ) {
    throw new Error(
      "Use HTTPS for remote Console connections. HTTP is allowed only on loopback.",
    );
  }

  const path = baseUrl.pathname.replace(/\/+$/, "");
  if (path && path !== "/api/v1") {
    throw new Error(
      "AUTOBASE_API_BASE_URL must be the Console origin, optionally ending in /api/v1.",
    );
  }

  baseUrl.pathname = "/api/v1/";
  baseUrl.search = "";
  baseUrl.hash = "";

  return {
    apiBaseUrl: baseUrl.toString(),
    apiToken,
  };
}
