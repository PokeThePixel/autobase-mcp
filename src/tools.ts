import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AutobaseApiClient } from "./api-client";
import { AutobaseApiError } from "./api-client";
import { redactOperationLog, redactText } from "./redaction";
import type { Cluster, Operation, Project } from "./schemas";

const API_SPEC_VERSION = "2.11.0";
const pageInput = {
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
};
const sensitiveKeyPattern =
  /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|authorization|connection_info|extra_vars|inventory)/i;

function jsonResult(
  value: unknown,
  apiToken: string,
): { content: [{ type: "text"; text: string }] } {
  const json =
    JSON.stringify(sanitizeToolValue(value, apiToken), null, 2) ?? "null";
  return {
    content: [{ type: "text", text: json }],
  };
}

function sanitizeToolValue(value: unknown, apiToken: string): unknown {
  if (typeof value === "string") {
    return redactText(value, apiToken);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolValue(item, apiToken));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKeyPattern.test(key))
        .map(([key, item]) => [key, sanitizeToolValue(item, apiToken)]),
    );
  }
  return value;
}

function registerReadTool<TInputShape extends z.ZodRawShape>(
  server: McpServer,
  apiToken: string,
  name: string,
  description: string,
  inputSchema: z.ZodObject<TInputShape>,
  run: (input: z.infer<z.ZodObject<TInputShape>>) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        return jsonResult(await run(input), apiToken);
      } catch (error) {
        if (error instanceof AutobaseApiError) {
          return {
            ...jsonResult({ error: error.message }, apiToken),
            isError: true,
          };
        }
        throw error;
      }
    },
  );
}

function projectForTool(project: Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

export function clusterForTool(cluster: Cluster) {
  return {
    id: cluster.id,
    name: cluster.name,
    description: cluster.description,
    status: cluster.status,
    creationTime: cluster.creation_time,
    environment: cluster.environment,
    postgresVersion: cluster.postgres_version,
    location: cluster.cluster_location,
    projectName: cluster.project_name,
    servers: cluster.servers?.map((server) => ({
      id: server.id,
      name: server.name,
      ip: server.ip,
      status: server.status,
      role: server.role,
      timeline: server.timeline,
      replicationLagBytes: server.lag,
      pendingRestart: server.pending_restart,
    })),
  };
}

function operationForTool(operation: Operation) {
  return {
    id: operation.id,
    clusterName: operation.cluster_name,
    startedAt: operation.started,
    finishedAt: operation.finished,
    type: operation.type,
    status: operation.status,
    environment: operation.environment,
  };
}

export function paginationForTool(
  meta:
    | { count?: number | null; limit?: number | null; offset?: number | null }
    | undefined,
  requestedPage: { limit?: number; offset?: number },
  returnedCount: number,
) {
  const offset = meta?.offset ?? requestedPage.offset ?? 0;
  const limit = meta?.limit ?? requestedPage.limit ?? null;
  const count = meta?.count ?? null;
  const hasMore =
    count !== null
      ? offset + returnedCount < count
      : limit !== null && returnedCount >= limit;

  return {
    count,
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + returnedCount : null,
  };
}

export function registerTools(
  server: McpServer,
  api: AutobaseApiClient,
  apiToken: string,
): void {
  registerReadTool(
    server,
    apiToken,
    "autobase_get_api_version",
    "Read the deployed Autobase Console API version and compare it with this server's Swagger contract version.",
    z.object({}),
    async () => ({
      version: (await api.getVersion()).version,
      swaggerContractVersion: API_SPEC_VERSION,
    }),
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_list_projects",
    "List Autobase projects. Use this to find a project ID before requesting its clusters or operations.",
    z.object(pageInput),
    async (input) => {
      const response = await api.listProjects(input);
      return {
        data: response.data.map(projectForTool),
        meta: paginationForTool(response.meta, input, response.data.length),
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_list_clusters",
    "List clusters for a project. Sensitive connection details, Ansible variables, and inventory are omitted.",
    z.object({
      projectId: z.number().int().positive(),
      ...pageInput,
    }),
    async ({ projectId, ...page }) => {
      const response = await api.listClusters(projectId, page);
      return {
        data: response.data.map(clusterForTool),
        meta: paginationForTool(response.meta, page, response.data.length),
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_get_cluster",
    "Read a cluster and its server status. Sensitive connection details, Ansible variables, and inventory are omitted.",
    z.object({ clusterId: z.number().int().positive() }),
    async ({ clusterId }) => clusterForTool(await api.getCluster(clusterId)),
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_list_operations",
    "List operations for a project within an ISO 8601 date range.",
    z.object({
      projectId: z.number().int().positive(),
      startDate: z.string().datetime({ offset: true }),
      endDate: z.string().datetime({ offset: true }),
      clusterName: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      environment: z.string().optional(),
      ...pageInput,
    }),
    async ({ projectId, startDate, endDate, ...filters }) => {
      const response = await api.listOperations({
        projectId,
        startDate,
        endDate,
        ...filters,
      });
      return {
        data: response.data.map(operationForTool),
        meta: paginationForTool(response.meta, filters, response.data.length),
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_get_operation_log",
    "Read an operation's log. Known credential formats and the Console API token are redacted; output is capped at 20,000 characters.",
    z.object({ operationId: z.number().int().positive() }),
    async ({ operationId }) => {
      const result = await api.getOperationLog(operationId);
      return {
        ...redactOperationLog(result.log, apiToken),
        completed: result.completed,
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_list_postgres_versions",
    "List PostgreSQL major versions supported by the deployed Console API.",
    z.object({}),
    async () => {
      const response = await api.listPostgresVersions();
      return {
        data: response.data.map((version) => ({
          majorVersion: version.major_version,
          releaseDate: version.release_date,
          endOfLife: version.end_of_life,
        })),
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_list_extensions",
    "List PostgreSQL extensions available through the deployed Console API.",
    z.object({
      extensionType: z.enum(["all", "contrib", "third_party"]).optional(),
      postgresVersion: z.string().optional(),
      ...pageInput,
    }),
    async ({ extensionType, postgresVersion, ...page }) => {
      const response = await api.listExtensions({
        extensionType,
        postgresVersion,
        ...page,
      });
      return {
        data: response.data.map((extension) => ({
          name: extension.name,
          description: extension.description,
          url: extension.url,
          postgresMinVersion: extension.postgres_min_version,
          postgresMaxVersion: extension.postgres_max_version,
          contrib: extension.contrib,
        })),
        meta: paginationForTool(response.meta, page, response.data.length),
      };
    },
  );
}
