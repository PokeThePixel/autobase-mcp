import type { z } from "zod";
import {
  type clusterCreateInputSchema,
  clusterCreateResponseSchema,
  clusterDefaultNameSchema,
  type clusterManageInputSchema,
  clusterSchema,
  deploymentSchema,
  type environmentCreateInputSchema,
  environmentSchema,
  extensionSchema,
  listResponseSchema,
  operationSchema,
  type projectCreateInputSchema,
  projectSchema,
  type projectUpdateInputSchema,
  versionResponseListSchema,
  versionResponseSchema,
} from "./schemas";

const API_TIMEOUT_MS = 15_000;

export class AutobaseApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutobaseApiError";
  }
}

type ApiClientOptions = {
  apiBaseUrl: string;
  apiToken: string;
  fetchImpl?: FetchImplementation;
};

type FetchImplementation = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

export type PageOptions = {
  limit?: number;
  offset?: number;
};

export type OperationFilters = PageOptions & {
  projectId: number;
  startDate: string;
  endDate: string;
  clusterName?: string;
  type?: string;
  status?: string;
  environment?: string;
  sortBy?: string;
};

export type ClusterFilters = PageOptions & {
  name?: string;
  status?: string;
  location?: string;
  environment?: string;
  serverCount?: number;
  postgresVersion?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  sortBy?: string;
};

export type ExtensionFilters = PageOptions & {
  extensionType?: "all" | "contrib" | "third_party";
  postgresVersion?: string;
};

type ProjectCreateInput = z.infer<typeof projectCreateInputSchema>;
type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>;
type EnvironmentCreateInput = z.infer<typeof environmentCreateInputSchema>;
type ClusterCreateInput = z.infer<typeof clusterCreateInputSchema>;
type ClusterManageInput = z.infer<typeof clusterManageInputSchema>;

export class AutobaseApiClient {
  private readonly apiBaseUrl: URL;
  private readonly apiToken: string;
  private readonly fetchImpl: FetchImplementation;

  constructor(options: ApiClientOptions) {
    this.apiBaseUrl = new URL(options.apiBaseUrl);
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getVersion() {
    return this.get("version", versionResponseSchema);
  }

  listDeployments(options: PageOptions = {}) {
    return this.get(
      "external/deployments",
      listResponseSchema(deploymentSchema),
      options,
    );
  }

  listProjects(options: PageOptions = {}) {
    return this.get("projects", listResponseSchema(projectSchema), options);
  }

  listClusters(projectId: number, filters: ClusterFilters = {}) {
    return this.get("clusters", listResponseSchema(clusterSchema), {
      project_id: projectId,
      name: filters.name,
      status: filters.status,
      location: filters.location,
      environment: filters.environment,
      server_count: filters.serverCount,
      postgres_version: filters.postgresVersion,
      created_at_from: filters.createdAtFrom,
      created_at_to: filters.createdAtTo,
      sort_by: filters.sortBy,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  listEnvironments(options: PageOptions = {}) {
    return this.get(
      "environments",
      listResponseSchema(environmentSchema),
      options,
    );
  }

  getCluster(clusterId: number) {
    return this.get(`clusters/${clusterId}`, clusterSchema);
  }

  getClusterDefaultName() {
    return this.get("clusters/default_name", clusterDefaultNameSchema);
  }

  createProject(input: ProjectCreateInput) {
    return this.writeJson("POST", "projects", projectSchema, input);
  }

  updateProject(input: ProjectUpdateInput & { projectId: number }) {
    const { projectId, ...body } = input;
    return this.writeJson("PATCH", `projects/${projectId}`, projectSchema, {
      name: body.name,
      description: body.description,
    });
  }

  deleteProject(projectId: number) {
    return this.deleteResource(`projects/${projectId}`);
  }

  createEnvironment(input: EnvironmentCreateInput) {
    return this.writeJson("POST", "environments", environmentSchema, input);
  }

  deleteEnvironment(environmentId: number) {
    return this.deleteResource(`environments/${environmentId}`);
  }

  createCluster(input: ClusterCreateInput) {
    const {
      projectId,
      environmentId,
      secretId,
      envs,
      extraVars,
      existingCluster,
      ...body
    } = input;
    return this.writeJson("POST", "clusters", clusterCreateResponseSchema, {
      ...body,
      project_id: projectId,
      environment_id: environmentId,
      auth_info: secretId ? { secret_id: secretId } : undefined,
      envs,
      extra_vars: extraVars,
      existing_cluster: existingCluster,
    });
  }

  deleteCluster(clusterId: number) {
    return this.deleteResource(`clusters/${clusterId}`);
  }

  deleteServer(serverId: number) {
    return this.deleteResource(`servers/${serverId}`);
  }

  refreshCluster(clusterId: number) {
    return this.writeJson(
      "POST",
      `clusters/${clusterId}/refresh`,
      clusterSchema,
    );
  }

  manageCluster(clusterId: number, input: ClusterManageInput) {
    const { authInfo, extraVars, runtimeExtraVars, newNodes, ...body } = input;
    return this.writeJson(
      "POST",
      `clusters/${clusterId}/manage`,
      clusterCreateResponseSchema,
      {
        ...body,
        auth_info: authInfo
          ? {
              cloud_secret_id: authInfo.cloudSecretId,
              server_secret_id: authInfo.serverSecretId,
            }
          : undefined,
        extra_vars: extraVars,
        runtime_extra_vars: runtimeExtraVars,
        new_nodes: newNodes?.map((node) => ({
          hostname: node.hostname,
          ip_address: node.ipAddress,
          ssh_port: node.sshPort,
          location: node.location,
        })),
      },
    );
  }

  listOperations(filters: OperationFilters) {
    const {
      projectId,
      startDate,
      endDate,
      clusterName,
      type,
      status,
      environment,
      sortBy,
      limit,
      offset,
    } = filters;

    return this.get("operations", listResponseSchema(operationSchema), {
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      cluster_name: clusterName,
      type,
      status,
      environment,
      sort_by: sortBy,
      limit,
      offset,
    });
  }

  async getOperationLog(operationId: number) {
    const url = new URL(`operations/${operationId}/log`, this.apiBaseUrl);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Accept: "text/plain",
          Authorization: `Bearer ${this.apiToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new AutobaseApiError(
          `Autobase Console API returned HTTP ${response.status}.`,
        );
      }

      return {
        log: await response.text(),
        completed: response.headers.get("x-log-completed") === "true",
      };
    } catch (error) {
      if (error instanceof AutobaseApiError) {
        throw error;
      }
      throw new AutobaseApiError(
        "Autobase Console API could not return the operation log.",
      );
    }
  }

  listPostgresVersions() {
    return this.get("postgres_versions", versionResponseListSchema);
  }

  listExtensions(filters: ExtensionFilters = {}) {
    const { extensionType, postgresVersion, limit, offset } = filters;
    return this.get(
      "database/extensions",
      listResponseSchema(extensionSchema),
      {
        extension_type: extensionType,
        postgres_version: postgresVersion,
        limit,
        offset,
      },
    );
  }

  private async get<TSchema extends z.ZodType>(
    path: string,
    schema: TSchema,
    query: Record<string, string | number | undefined> = {},
  ): Promise<z.infer<TSchema>> {
    const url = new URL(path, this.apiBaseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch {
      throw new AutobaseApiError("Autobase Console API could not be reached.");
    }

    if (!response.ok) {
      throw new AutobaseApiError(
        `Autobase Console API returned HTTP ${response.status}.`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new AutobaseApiError("Autobase Console API returned invalid JSON.");
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AutobaseApiError(
        `Autobase Console API returned an invalid response for ${path}.`,
      );
    }

    return parsed.data;
  }

  private async writeJson<TSchema extends z.ZodType>(
    method: "POST" | "PATCH",
    path: string,
    schema: TSchema,
    body?: unknown,
  ): Promise<z.infer<TSchema>> {
    const response = await this.writeRequest(method, path, body);
    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new AutobaseApiError("Autobase Console API returned invalid JSON.");
    }

    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      throw new AutobaseApiError(
        `Autobase Console API returned an invalid response for ${path}.`,
      );
    }

    return parsed.data;
  }

  private async deleteResource(path: string): Promise<void> {
    const response = await this.writeRequest("DELETE", path);
    if (response.status !== 204) {
      throw new AutobaseApiError(
        `Autobase Console API returned an unexpected success status for ${path}.`,
      );
    }
  }

  private async writeRequest(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const url = new URL(path, this.apiBaseUrl);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch {
      throw new AutobaseApiError("Autobase Console API could not be reached.");
    }

    if (!response.ok) {
      throw new AutobaseApiError(
        `Autobase Console API returned HTTP ${response.status}.`,
      );
    }

    return response;
  }
}
