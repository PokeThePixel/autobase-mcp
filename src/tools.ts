import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AutobaseApiClient } from "./api-client";
import { AutobaseApiError } from "./api-client";
import { redactOperationLog, redactText } from "./redaction";
import type {
  Cluster,
  ClusterBackup,
  Deployment,
  Environment,
  Operation,
  PostgresParameter,
  Project,
} from "./schemas";
import {
  clusterAccessInputSchema,
  clusterCreateInputSchema,
  clusterManageInputSchema,
  environmentCreateInputSchema,
  projectCreateInputSchema,
  projectUpdateInputSchema,
} from "./schemas";

const API_SPEC_VERSION = "2.11.0";
const pageInput = {
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
};
const clusterSortBy = z
  .string()
  .regex(
    /^-?(id|name|created_at|updated_at|environment|project|status|location|server_count|postgres_version)(,-?(id|name|created_at|updated_at|environment|project|status|location|server_count|postgres_version))*$/,
  )
  .optional();
const operationSortBy = z
  .string()
  .regex(
    /^-?(id|cluster_name|type|status|started|finished|cluster|environment)(,-?(id|cluster_name|type|status|started|finished|cluster|environment))*$/,
  )
  .optional();
const writeConfirmation = z
  .literal(true)
  .describe("Set to true only after the user explicitly requests this write.");
const sensitiveKeyPattern =
  /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|authorization|connection_info|extra_vars|inventory)/i;
const sensitivePostgresParameterPattern =
  /(?:password|passwd|secret|token|credential|private|conninfo|command|key|passphrase)/i;

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

function registerWriteTool<TInputShape extends z.ZodRawShape>(
  server: McpServer,
  apiToken: string,
  name: string,
  description: string,
  inputSchema: z.ZodObject<TInputShape>,
  options: { destructive: boolean; idempotent: boolean },
  run: (input: z.infer<z.ZodObject<TInputShape>>) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: options.destructive,
        idempotentHint: options.idempotent,
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

function environmentForTool(environment: Environment) {
  return {
    id: environment.id,
    name: environment.name,
    description: environment.description,
    createdAt: environment.created_at,
    updatedAt: environment.updated_at,
  };
}

function backupForTool(backup: ClusterBackup) {
  return {
    id: backup.id,
    startedAt: backup.started_at,
    finishedAt: backup.finished_at,
    durationSeconds: backup.duration_seconds,
    type: backup.type,
    sizeBytes: backup.size_bytes,
  };
}

export function postgresParameterForTool(
  parameter: PostgresParameter,
  apiToken: string,
) {
  const setting =
    parameter.name && sensitivePostgresParameterPattern.test(parameter.name)
      ? null
      : typeof parameter.setting === "string"
        ? redactText(parameter.setting, apiToken)
        : parameter.setting;

  return {
    name: parameter.name,
    setting,
    description: parameter.description,
    category: parameter.category,
    context: parameter.context,
    restart: parameter.restart,
    changed: parameter.changed,
  };
}

export function deploymentForTool(deployment: Deployment) {
  return {
    code: deployment.code,
    description: deployment.description,
    avatarUrl: deployment.avatar_url,
    regions: deployment.cloud_regions?.map((region) => ({
      code: region.code,
      name: region.name,
      datacenters: region.datacenters?.map((datacenter) => ({
        code: datacenter.code,
        location: datacenter.location,
        cloudImage: datacenter.cloud_image
          ? {
              architecture: datacenter.cloud_image.arch,
              osName: datacenter.cloud_image.os_name,
              osVersion: datacenter.cloud_image.os_version,
              updatedAt: datacenter.cloud_image.updated_at,
            }
          : undefined,
      })),
    })),
    instanceTypes: deployment.instance_types
      ? {
          small: deployment.instance_types.small?.map(instanceTypeForTool),
          medium: deployment.instance_types.medium?.map(instanceTypeForTool),
          large: deployment.instance_types.large?.map(instanceTypeForTool),
        }
      : undefined,
    volumes: deployment.volumes?.map((volume) => ({
      type: volume.volume_type,
      description: volume.volume_description,
      minSizeGb: volume.min_size,
      maxSizeGb: volume.max_size,
      monthlyPrice: volume.price_monthly,
      currency: volume.currency,
      isDefault: volume.is_default,
    })),
  };
}

function instanceTypeForTool(
  instanceType: NonNullable<
    NonNullable<Deployment["instance_types"]>["small"]
  >[number],
) {
  return {
    code: instanceType.code,
    cpu: instanceType.cpu,
    sharedCpu: instanceType.shared_cpu,
    ramGb: instanceType.ram,
    hourlyPrice: instanceType.price_hourly,
    monthlyPrice: instanceType.price_monthly,
    currency: instanceType.currency,
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
    cloudAccessReferenceId: cluster.cloud_secret_id,
    serverAccessReferenceId: cluster.server_secret_id,
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
    user: operation.user,
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
  enableWriteTools = false,
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
    "autobase_list_deployments",
    "List cloud deployment options, regions, instance types, and volumes supported by the Console.",
    z.object(pageInput),
    async (input) => {
      const response = await api.listDeployments(input);
      return {
        data: response.data.map(deploymentForTool),
        meta: paginationForTool(response.meta, input, response.data.length),
      };
    },
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
    "autobase_list_environments",
    "List Autobase environments.",
    z.object(pageInput),
    async (input) => {
      const response = await api.listEnvironments(input);
      return {
        data: response.data.map(environmentForTool),
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
      name: z.string().optional(),
      status: z.string().optional(),
      location: z.string().optional(),
      environment: z.string().optional(),
      serverCount: z.number().int().min(0).optional(),
      postgresVersion: z.number().int().positive().optional(),
      createdAtFrom: z.string().datetime({ offset: true }).optional(),
      createdAtTo: z.string().datetime({ offset: true }).optional(),
      sortBy: clusterSortBy,
      ...pageInput,
    }),
    async ({ projectId, ...filters }) => {
      const response = await api.listClusters(projectId, filters);
      return {
        data: response.data.map(clusterForTool),
        meta: paginationForTool(response.meta, filters, response.data.length),
      };
    },
  );

  registerReadTool(
    server,
    apiToken,
    "autobase_get_cluster_default_name",
    "Get the default cluster name suggested by the Console.",
    z.object({}),
    async () => api.getClusterDefaultName(),
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
      sortBy: operationSortBy,
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
    "autobase_get_operation",
    "Read a single operation's status and metadata.",
    z.object({ operationId: z.number().int().positive() }),
    async ({ operationId }) =>
      operationForTool(await api.getOperation(operationId)),
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
    "autobase_list_postgres_parameters",
    "List PostgreSQL parameters and effective values for a cluster or PostgreSQL major version. Values for credential and command parameters are withheld.",
    z.object({
      clusterId: z.number().int().positive().optional(),
      postgresVersion: z.number().int().positive().optional(),
    }),
    async (input) => {
      const response = await api.listPostgresParameters(input);
      return {
        data: response.data.map((parameter) =>
          postgresParameterForTool(parameter, apiToken),
        ),
        meta: response.meta,
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

  if (!enableWriteTools) {
    return;
  }

  registerWriteTool(
    server,
    apiToken,
    "autobase_create_project",
    "Create an Autobase project. Requires an explicit user request and confirm: true.",
    projectCreateInputSchema.extend({ confirm: writeConfirmation }),
    { destructive: false, idempotent: false },
    async ({ confirm: _confirm, ...input }) => {
      void _confirm;
      return projectForTool(await api.createProject(input));
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_update_project",
    "Update an Autobase project's name or description. Requires an explicit user request and confirm: true.",
    projectUpdateInputSchema.extend({
      projectId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: false, idempotent: true },
    async ({ projectId, confirm: _confirm, ...input }) => {
      void _confirm;
      if (input.name === undefined && input.description === undefined) {
        throw new AutobaseApiError(
          "Provide a project name or description to update.",
        );
      }
      return projectForTool(await api.updateProject({ projectId, ...input }));
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_delete_project",
    "Delete an Autobase project from Console metadata. This cannot be undone. Requires an explicit user request and confirm: true.",
    z.object({
      projectId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: false },
    async ({ projectId }) => {
      await api.deleteProject(projectId);
      return { deleted: true, projectId };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_create_environment",
    "Create an Autobase environment. Requires an explicit user request and confirm: true.",
    environmentCreateInputSchema.extend({ confirm: writeConfirmation }),
    { destructive: false, idempotent: false },
    async ({ confirm: _confirm, ...input }) => {
      void _confirm;
      return environmentForTool(await api.createEnvironment(input));
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_delete_environment",
    "Delete an Autobase environment from Console metadata. This cannot be undone. Requires an explicit user request and confirm: true.",
    z.object({
      environmentId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: false },
    async ({ environmentId }) => {
      await api.deleteEnvironment(environmentId);
      return { deleted: true, environmentId };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_create_cluster",
    "Create and provision a cluster through Autobase Console. This may incur cloud charges. Configure the deployment with extraVars and envs, and use secretId to reference a secret already stored in Console. Do not put credentials in extraVars or envs because they are sent to Autobase. Requires an explicit user request and confirm: true.",
    clusterCreateInputSchema.extend({ confirm: writeConfirmation }),
    { destructive: true, idempotent: false },
    async ({ confirm: _confirm, ...input }) => {
      void _confirm;
      const result = await api.createCluster(input);
      return {
        clusterId: result.cluster_id,
        operationId: result.operation_id,
      };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_delete_cluster",
    "Delete a cluster record from Console metadata. This endpoint does not delete the running infrastructure. Verify this distinction before use. Requires an explicit user request and confirm: true.",
    z.object({
      clusterId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: false },
    async ({ clusterId }) => {
      await api.deleteCluster(clusterId);
      return { deleted: true, clusterId };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_delete_server",
    "Delete a server record from Console metadata. The API does not describe this as deleting the running server. Requires an explicit user request and confirm: true.",
    z.object({
      serverId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: false },
    async ({ serverId }) => {
      await api.deleteServer(serverId);
      return { deleted: true, serverId };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_refresh_cluster",
    "Refresh cluster information from the cluster's Patroni API. Requires an explicit user request and confirm: true.",
    z.object({
      clusterId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: false, idempotent: true },
    async ({ clusterId }) =>
      clusterForTool(await api.refreshCluster(clusterId)),
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_update_cluster_access",
    "Validate and store references to existing cloud-provider or server-access secrets for a cluster. Secret values are not accepted. Requires an explicit user request and confirm: true.",
    z.object({
      clusterId: z.number().int().positive(),
      ...clusterAccessInputSchema.shape,
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: true },
    async ({ clusterId, confirm: _confirm, authInfo }) => {
      void _confirm;
      return clusterForTool(
        await api.updateClusterAccess(clusterId, { authInfo }),
      );
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_list_cluster_backups",
    "Runs the Console backup-list playbook against the cluster and returns normalized backup records. This starts a remote Ansible task, so it requires an explicit user request and confirm: true.",
    z.object({
      clusterId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: false, idempotent: true },
    async ({ clusterId }) => {
      const response = await api.getClusterBackups(clusterId);
      return { data: response.data.map(backupForTool) };
    },
  );

  registerWriteTool(
    server,
    apiToken,
    "autobase_manage_cluster",
    "Run a maintenance playbook against an existing cluster. Supports persistent extraVars, per-run runtimeExtraVars, inventory, tags, environment variables, existing cloud/server secret IDs, and adding new nodes. Persistent extraVars replace the saved values only after success. runtimeExtraVars are not saved. Use secret IDs for credentials. Do not put credentials in extraVars, runtimeExtraVars, inventory, or envs because they are sent to Autobase. This can change cluster configuration or topology. Requires an explicit user request and confirm: true.",
    clusterManageInputSchema.extend({
      clusterId: z.number().int().positive(),
      confirm: writeConfirmation,
    }),
    { destructive: true, idempotent: false },
    async ({ clusterId, confirm: _confirm, ...input }) => {
      void _confirm;
      const result = await api.manageCluster(clusterId, input);
      return {
        clusterId: result.cluster_id,
        operationId: result.operation_id,
      };
    },
  );
}
