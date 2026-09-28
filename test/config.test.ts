import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("requires the Console origin and token", () => {
    expect(() => loadConfig({})).toThrow("AUTOBASE_API_BASE_URL is required.");
    expect(() =>
      loadConfig({ AUTOBASE_API_BASE_URL: "https://console.example.com" }),
    ).toThrow("AUTOBASE_API_TOKEN is required.");
  });

  test("adds the API path to a secure Console origin", () => {
    expect(
      loadConfig({
        AUTOBASE_API_BASE_URL: "https://console.example.com/",
        AUTOBASE_API_TOKEN: "secret",
      }),
    ).toEqual({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "secret",
      enableWriteTools: false,
    });
  });

  test("enables write tools only with the explicit true setting", () => {
    const env = {
      AUTOBASE_API_BASE_URL: "https://console.example.com",
      AUTOBASE_API_TOKEN: "secret",
    };

    expect(loadConfig(env).enableWriteTools).toBe(false);
    expect(
      loadConfig({ ...env, AUTOBASE_ENABLE_WRITE_TOOLS: "false" })
        .enableWriteTools,
    ).toBe(false);
    expect(
      loadConfig({ ...env, AUTOBASE_ENABLE_WRITE_TOOLS: "true" })
        .enableWriteTools,
    ).toBe(true);
  });

  test("allows the MCP command args to set write tools on or off", () => {
    const env = {
      AUTOBASE_API_BASE_URL: "https://console.example.com",
      AUTOBASE_API_TOKEN: "secret",
      AUTOBASE_ENABLE_WRITE_TOOLS: "true",
    };

    expect(
      loadConfig(env, ["--enable-write-tools=false"]).enableWriteTools,
    ).toBe(false);
    expect(
      loadConfig(env, ["--enable-write-tools", "true"]).enableWriteTools,
    ).toBe(true);
    expect(
      loadConfig({ ...env, AUTOBASE_ENABLE_WRITE_TOOLS: "false" }, [
        "--enable-write-tools=true",
      ]).enableWriteTools,
    ).toBe(true);
  });

  test("rejects invalid or repeated write tool arguments", () => {
    const env = {
      AUTOBASE_API_BASE_URL: "https://console.example.com",
      AUTOBASE_API_TOKEN: "secret",
    };

    expect(() => loadConfig(env, ["--enable-write-tools=maybe"])).toThrow(
      "--enable-write-tools requires exactly true or false.",
    );
    expect(() =>
      loadConfig(env, [
        "--enable-write-tools=true",
        "--enable-write-tools=false",
      ]),
    ).toThrow("--enable-write-tools may be specified only once.");
    expect(() => loadConfig(env, ["--unknown"])).toThrow(
      "Unknown argument: --unknown",
    );
  });

  test("rejects ambiguous write tool settings", () => {
    expect(() =>
      loadConfig({
        AUTOBASE_API_BASE_URL: "https://console.example.com",
        AUTOBASE_API_TOKEN: "secret",
        AUTOBASE_ENABLE_WRITE_TOOLS: "yes",
      }),
    ).toThrow("AUTOBASE_ENABLE_WRITE_TOOLS must be exactly true or false.");
  });

  test("accepts a Console URL that already includes the API path", () => {
    expect(
      loadConfig({
        AUTOBASE_API_BASE_URL: "https://console.example.com/api/v1",
        AUTOBASE_API_TOKEN: "secret",
      }).apiBaseUrl,
    ).toBe("https://console.example.com/api/v1/");
  });

  test("allows HTTP only on loopback", () => {
    expect(
      loadConfig({
        AUTOBASE_API_BASE_URL: "http://localhost:8080",
        AUTOBASE_API_TOKEN: "secret",
      }).apiBaseUrl,
    ).toBe("http://localhost:8080/api/v1/");

    expect(() =>
      loadConfig({
        AUTOBASE_API_BASE_URL: "http://console.example.com",
        AUTOBASE_API_TOKEN: "secret",
      }),
    ).toThrow("Use HTTPS for remote Console connections.");
  });

  test("rejects credentials and unexpected URL paths", () => {
    expect(() =>
      loadConfig({
        AUTOBASE_API_BASE_URL: "https://user:password@console.example.com",
        AUTOBASE_API_TOKEN: "secret",
      }),
    ).toThrow("must not contain credentials");

    expect(() =>
      loadConfig({
        AUTOBASE_API_BASE_URL: "https://console.example.com/private",
        AUTOBASE_API_TOKEN: "secret",
      }),
    ).toThrow("optionally ending in /api/v1");
  });
});
