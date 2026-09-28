export type AutobaseConfig = {
  apiBaseUrl: string;
  apiToken: string;
  enableWriteTools: boolean;
};

export function loadConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  args: readonly string[] = [],
): AutobaseConfig {
  const rawBaseUrl = env.AUTOBASE_API_BASE_URL?.trim();
  const apiToken = env.AUTOBASE_API_TOKEN?.trim();
  const writeToolsSetting = env.AUTOBASE_ENABLE_WRITE_TOOLS?.trim();

  if (!rawBaseUrl) {
    throw new Error("AUTOBASE_API_BASE_URL is required.");
  }
  if (!apiToken) {
    throw new Error("AUTOBASE_API_TOKEN is required.");
  }
  if (
    writeToolsSetting !== undefined &&
    writeToolsSetting !== "" &&
    writeToolsSetting !== "true" &&
    writeToolsSetting !== "false"
  ) {
    throw new Error(
      "AUTOBASE_ENABLE_WRITE_TOOLS must be exactly true or false.",
    );
  }
  const writeToolsArgument = parseWriteToolsArgument(args);

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
    enableWriteTools: writeToolsArgument ?? writeToolsSetting === "true",
  };
}

function parseWriteToolsArgument(args: readonly string[]): boolean | undefined {
  let value: boolean | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    let setting: string | undefined;
    if (argument === "--enable-write-tools") {
      index += 1;
      setting = args[index];
    } else if (argument.startsWith("--enable-write-tools=")) {
      setting = argument.slice("--enable-write-tools=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }

    if (setting !== "true" && setting !== "false") {
      throw new Error("--enable-write-tools requires exactly true or false.");
    }
    if (value !== undefined) {
      throw new Error("--enable-write-tools may be specified only once.");
    }

    value = setting === "true";
  }

  return value;
}
