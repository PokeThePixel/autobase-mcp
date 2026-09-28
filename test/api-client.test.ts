import { describe, expect, test } from "bun:test";
import { AutobaseApiClient } from "../src/api-client";

describe("AutobaseApiClient", () => {
  test("sends the bearer token and validates project responses", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe("/api/v1/projects");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer private-token",
        );
        return Response.json({
          data: [{ id: 3, name: "production" }],
          meta: { count: 1, limit: 20, offset: 0 },
        });
      },
    });

    await expect(client.listProjects({ limit: 20 })).resolves.toMatchObject({
      data: [{ id: 3, name: "production" }],
      meta: { count: 1, limit: 20, offset: 0 },
    });
  });

  test("sends the required project and date filters for operations", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/operations");
        expect(url.searchParams.get("project_id")).toBe("5");
        expect(url.searchParams.get("start_date")).toBe("2026-09-01T00:00:00Z");
        expect(url.searchParams.get("end_date")).toBe("2026-09-30T00:00:00Z");
        return Response.json({ data: [] });
      },
    });

    await expect(
      client.listOperations({
        projectId: 5,
        startDate: "2026-09-01T00:00:00Z",
        endDate: "2026-09-30T00:00:00Z",
      }),
    ).resolves.toMatchObject({ data: [] });
  });

  test("sends cluster discovery filters and sort order", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/clusters");
        expect(url.searchParams.get("project_id")).toBe("5");
        expect(url.searchParams.get("status")).toBe("healthy");
        expect(url.searchParams.get("server_count")).toBe("3");
        expect(url.searchParams.get("created_at_from")).toBe(
          "2026-09-01T00:00:00Z",
        );
        expect(url.searchParams.get("sort_by")).toBe("-created_at");
        return Response.json({ data: [] });
      },
    });

    await expect(
      client.listClusters(5, {
        status: "healthy",
        serverCount: 3,
        createdAtFrom: "2026-09-01T00:00:00Z",
        sortBy: "-created_at",
      }),
    ).resolves.toMatchObject({ data: [] });
  });

  test("reads environment lists with pagination", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/environments");
        expect(url.searchParams.get("limit")).toBe("25");
        return Response.json({
          data: [{ id: 2, name: "production" }],
          meta: { count: 1, limit: 25, offset: 0 },
        });
      },
    });

    await expect(client.listEnvironments({ limit: 25 })).resolves.toMatchObject(
      {
        data: [{ id: 2, name: "production" }],
        meta: { count: 1, limit: 25, offset: 0 },
      },
    );
  });

  test("reads paginated deployment options", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        expect(url.pathname).toBe("/api/v1/external/deployments");
        expect(url.searchParams.get("offset")).toBe("10");
        return Response.json({
          data: [{ code: "aws", cloud_regions: [] }],
          meta: { count: 11, limit: 10, offset: 10 },
        });
      },
    });

    await expect(
      client.listDeployments({ limit: 10, offset: 10 }),
    ).resolves.toMatchObject({
      data: [{ code: "aws" }],
      meta: { count: 11, limit: 10, offset: 10 },
    });
  });

  test("reads the Console's suggested cluster name", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        expect(new URL(String(input)).pathname).toBe(
          "/api/v1/clusters/default_name",
        );
        return Response.json({ name: "postgres-cluster-01" });
      },
    });

    await expect(client.getClusterDefaultName()).resolves.toEqual({
      name: "postgres-cluster-01",
    });
  });

  test("does not include API error response bodies in errors", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async () =>
        Response.json(
          { description: "Authorization: Bearer private-token" },
          { status: 401 },
        ),
    });

    await expect(client.getVersion()).rejects.toMatchObject({
      message: "Autobase Console API returned HTTP 401.",
    });
  });

  test("rejects malformed API responses without echoing response values", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async () => Response.json({ data: [{ id: "private-token" }] }),
    });

    await expect(client.listProjects()).rejects.toThrow(
      "Autobase Console API returned an invalid response for projects.",
    );
  });

  test("returns operation log completion metadata", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo) => {
        expect(new URL(String(input)).pathname).toBe(
          "/api/v1/operations/8/log",
        );
        return new Response("operation output", {
          headers: { "x-log-completed": "true" },
        });
      },
    });

    await expect(client.getOperationLog(8)).resolves.toEqual({
      log: "operation output",
      completed: true,
    });
  });
});
