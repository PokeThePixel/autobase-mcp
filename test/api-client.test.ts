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

  test("creates a cluster with provisioning variables and a stored secret reference", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe("/api/v1/clusters");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          name: "analytics",
          project_id: 5,
          environment_id: 2,
          auth_info: { secret_id: 9 },
          existing_cluster: false,
          extra_vars: {
            cloud_provider: "aws",
            server_count: 3,
            postgresql_version: 17,
          },
        });
        return Response.json({ cluster_id: 12, operation_id: 30 });
      },
    });

    await expect(
      client.createCluster({
        name: "analytics",
        projectId: 5,
        environmentId: 2,
        secretId: 9,
        existingCluster: false,
        extraVars: {
          cloud_provider: "aws",
          server_count: 3,
          postgresql_version: 17,
        },
      }),
    ).resolves.toEqual({ cluster_id: 12, operation_id: 30 });
  });

  test("maps project updates and validates the returned project", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe("/api/v1/projects/5");
        expect(init?.method).toBe("PATCH");
        expect(JSON.parse(String(init?.body))).toEqual({ name: "analytics" });
        return Response.json({ id: 5, name: "analytics" });
      },
    });

    await expect(
      client.updateProject({ projectId: 5, name: "analytics" }),
    ).resolves.toMatchObject({ id: 5, name: "analytics" });
  });

  test("creates projects and environments with POST", async () => {
    const requests: string[] = [];
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        requests.push(`${init?.method} ${path}`);
        if (path.endsWith("/projects")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            name: "analytics",
            description: "Analytics workloads",
          });
          return Response.json({
            id: 8,
            name: "analytics",
            description: "Analytics workloads",
          });
        }

        expect(JSON.parse(String(init?.body))).toEqual({
          name: "production",
          description: "Production workloads",
        });
        return Response.json({
          id: 3,
          name: "production",
          description: "Production workloads",
        });
      },
    });

    await client.createProject({
      name: "analytics",
      description: "Analytics workloads",
    });
    await client.createEnvironment({
      name: "production",
      description: "Production workloads",
    });

    expect(requests).toEqual([
      "POST /api/v1/projects",
      "POST /api/v1/environments",
    ]);
  });

  test("uses DELETE and requires the contract's 204 response", async () => {
    const requests: string[] = [];
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
        return new Response(null, { status: 204 });
      },
    });

    await client.deleteProject(4);
    await client.deleteEnvironment(3);
    await client.deleteCluster(2);
    await client.deleteServer(1);

    expect(requests).toEqual([
      "DELETE /api/v1/projects/4",
      "DELETE /api/v1/environments/3",
      "DELETE /api/v1/clusters/2",
      "DELETE /api/v1/servers/1",
    ]);
  });

  test("refreshes cluster data with POST and validates the result", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe(
          "/api/v1/clusters/12/refresh",
        );
        expect(init?.method).toBe("POST");
        return Response.json({ id: 12, name: "analytics" });
      },
    });

    await expect(client.refreshCluster(12)).resolves.toMatchObject({
      id: 12,
      name: "analytics",
    });
  });

  test("manages an existing cluster with persistent and runtime configuration", async () => {
    const client = new AutobaseApiClient({
      apiBaseUrl: "https://console.example.com/api/v1/",
      apiToken: "private-token",
      fetchImpl: async (input: URL | RequestInfo, init?: RequestInit) => {
        expect(new URL(String(input)).pathname).toBe(
          "/api/v1/clusters/12/manage",
        );
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          auth_info: { cloud_secret_id: 8, server_secret_id: 9 },
          playbook: "config_pgcluster.yml",
          tags: "postgresql_users",
          inventory: { all: { children: {} } },
          envs: ["ANSIBLE_FORCE_COLOR=1"],
          extra_vars: { postgresql_parameters: { work_mem: "64MB" } },
          runtime_extra_vars: { maintenance_window: "planned" },
          new_nodes: [
            {
              hostname: "db-2",
              ip_address: "192.0.2.20",
              ssh_port: 2222,
              location: "dc-west",
            },
          ],
        });
        return Response.json({ cluster_id: 12, operation_id: 35 });
      },
    });

    await expect(
      client.manageCluster(12, {
        authInfo: { cloudSecretId: 8, serverSecretId: 9 },
        playbook: "config_pgcluster.yml",
        tags: "postgresql_users",
        inventory: { all: { children: {} } },
        envs: ["ANSIBLE_FORCE_COLOR=1"],
        extraVars: { postgresql_parameters: { work_mem: "64MB" } },
        runtimeExtraVars: { maintenance_window: "planned" },
        newNodes: [
          {
            hostname: "db-2",
            ipAddress: "192.0.2.20",
            sshPort: 2222,
            location: "dc-west",
          },
        ],
      }),
    ).resolves.toEqual({ cluster_id: 12, operation_id: 35 });
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
