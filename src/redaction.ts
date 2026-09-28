const privateKeyPattern =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi;
const authorizationPattern =
  /(authorization\s*[:=]\s*)(?:bearer\s+)?[^\r\n,;]+/gi;
const sensitiveValuePattern =
  /((?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(value: string, apiToken: string): string {
  let redacted = value.replace(privateKeyPattern, "[REDACTED PRIVATE KEY]");
  redacted = redacted.replace(authorizationPattern, "$1[REDACTED]");
  redacted = redacted.replace(sensitiveValuePattern, "$1[REDACTED]");

  if (apiToken) {
    redacted = redacted.replace(
      new RegExp(escapeRegExp(apiToken), "g"),
      "[REDACTED]",
    );
  }

  return redacted;
}

export function redactOperationLog(
  value: string,
  apiToken: string,
  maxCharacters = 20_000,
): { log: string; truncated: boolean } {
  const redacted = redactText(value, apiToken);
  if (redacted.length <= maxCharacters) {
    return { log: redacted, truncated: false };
  }

  return {
    log: `${redacted.slice(0, maxCharacters)}\n[Log truncated]`,
    truncated: true,
  };
}
