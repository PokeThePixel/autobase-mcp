import type { z } from "zod";
import {
  clusterDefaultNameSchema,
  clusterSchema,
  deploymentSchema,
  environmentSchema,
  extensionSchema,
  listResponseSchema,
  operationSchema,
  projectSchema,
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
}
