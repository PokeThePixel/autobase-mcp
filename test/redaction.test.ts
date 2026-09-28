import { describe, expect, test } from "bun:test";
import { redactOperationLog, redactText } from "../src/redaction";

describe("log redaction", () => {
  test("redacts the API token, sensitive fields, and private keys", () => {
    const result = redactText(
      [
        "Authorization: Bearer private-token",
        "password: hunter2",
        "-----BEGIN OPENSSH PRIVATE KEY-----",
        "private material",
        "-----END OPENSSH PRIVATE KEY-----",
      ].join("\n"),
      "private-token",
    );

    expect(result).not.toContain("private-token");
    expect(result).not.toContain("hunter2");
    expect(result).not.toContain("private material");
    expect(result).toContain("[REDACTED PRIVATE KEY]");
  });

  test("caps long operation logs after redacting them", () => {
    expect(redactOperationLog("password=secret;".repeat(10), "", 19)).toEqual({
      log: "password=[REDACTED]\n[Log truncated]",
      truncated: true,
    });
  });

  test("leaves ordinary log content unchanged", () => {
    expect(redactOperationLog("cluster is healthy", "private-token")).toEqual({
      log: "cluster is healthy",
      truncated: false,
    });
  });
});
