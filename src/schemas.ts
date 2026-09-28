import { z } from "zod";

export const paginationSchema = z
  .object({
    offset: z.number().int().nullable().optional(),
    limit: z.number().int().nullable().optional(),
    count: z.number().int().nullable().optional(),
  })
  .passthrough();

export const versionResponseSchema = z
  .object({
    version: z.string(),
  })
  .passthrough();

export const projectSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const environmentSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

const deploymentInstanceTypeSchema = z
  .object({
    code: z.string(),
    cpu: z.number().nullable().optional(),
    shared_cpu: z.boolean().nullable().optional(),
    ram: z.number().nullable().optional(),
    price_hourly: z.number().nullable().optional(),
    price_monthly: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
  })
  .passthrough();

export const deploymentSchema = z
  .object({
    code: z.string(),
    description: z.string().optional(),
    avatar_url: z.string().optional(),
    cloud_regions: z
      .array(
        z
          .object({
            code: z.string(),
            name: z.string().optional(),
            datacenters: z
              .array(
                z
                  .object({
                    code: z.string(),
                    location: z.string().optional(),
                    cloud_image: z
                      .object({
                        arch: z.string().optional(),
                        os_name: z.string().optional(),
                        os_version: z.string().optional(),
                        updated_at: z.string().optional(),
                      })
                      .passthrough()
                      .optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
    instance_types: z
      .object({
        small: z.array(deploymentInstanceTypeSchema).nullable().optional(),
        medium: z.array(deploymentInstanceTypeSchema).nullable().optional(),
        large: z.array(deploymentInstanceTypeSchema).nullable().optional(),
      })
      .passthrough()
      .optional(),
    volumes: z
      .array(
        z
          .object({
            volume_type: z.string(),
            volume_description: z.string().optional(),
            min_size: z.number().optional(),
            max_size: z.number().optional(),
            price_monthly: z.number().optional(),
            currency: z.string().optional(),
            is_default: z.boolean().nullable().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const clusterDefaultNameSchema = z
  .object({ name: z.string() })
  .passthrough();

export const projectCreateInputSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const projectUpdateInputSchema = z.strictObject({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export const environmentCreateInputSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const clusterCreateInputSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  projectId: z.number().int().positive(),
  environmentId: z.number().int().positive().optional(),
  secretId: z.number().int().positive().optional(),
  envs: z.array(z.string()).optional(),
  extraVars: z.record(z.string(), z.unknown()).optional(),
  existingCluster: z.boolean().optional(),
});

export const clusterCreateResponseSchema = z
  .object({
    cluster_id: z.number().int(),
    operation_id: z.number().int().optional(),
  })
  .passthrough();

const clusterManageNodeSchema = z.strictObject({
  hostname: z.string().min(1),
  ipAddress: z.string().min(1),
  sshPort: z.number().int().min(1).max(65535).optional(),
  location: z.string().optional(),
});

export const clusterManageInputSchema = z.strictObject({
  authInfo: z
    .strictObject({
      cloudSecretId: z.number().int().positive().optional(),
      serverSecretId: z.number().int().positive().optional(),
    })
    .optional(),
  playbook: z.string().min(1).optional(),
  tags: z.string().optional(),
  inventory: z.record(z.string(), z.unknown()).optional(),
  envs: z.array(z.string()).optional(),
  extraVars: z.record(z.string(), z.unknown()).optional(),
  runtimeExtraVars: z.record(z.string(), z.unknown()).optional(),
  newNodes: z.array(clusterManageNodeSchema).min(1).optional(),
});

export const clusterAccessInputSchema = z.strictObject({
  authInfo: z
    .strictObject({
      cloudSecretId: z.number().int().positive().optional(),
      serverSecretId: z.number().int().positive().optional(),
    })
    .refine(
      ({ cloudSecretId, serverSecretId }) =>
        cloudSecretId !== undefined || serverSecretId !== undefined,
      "Provide a cloud or server secret ID.",
    ),
});

export const postgresParameterSchema = z
  .object({
    name: z.string().optional(),
    setting: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    restart: z.boolean(),
    changed: z.boolean().nullable(),
  })
  .passthrough();

export const postgresParametersResponseSchema = z
  .object({
    data: z.array(postgresParameterSchema),
    meta: z.object({
      source: z.enum(["patroni", "extra_vars", "defaults"]),
    }),
  })
  .passthrough();

export const clusterBackupSchema = z
  .object({
    id: z.string().optional(),
    started_at: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    duration_seconds: z.number().nullable().optional(),
    type: z.string().optional(),
    size_bytes: z.number().nullable().optional(),
  })
  .passthrough();

export const clusterBackupListSchema = z
  .object({
    data: z.array(clusterBackupSchema),
  })
  .passthrough();

export const clusterServerSchema = z
  .object({
    id: z.number().int().optional(),
    name: z.string().optional(),
    ip: z.string().optional(),
    status: z.string().optional(),
    role: z.string().optional(),
    timeline: z.number().int().nullable().optional(),
    lag: z.number().int().nullable().optional(),
    pending_restart: z.boolean().nullable().optional(),
  })
  .passthrough();

export const clusterSchema = z
  .object({
    id: z.number().int(),
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    creation_time: z.string().optional(),
    environment: z.string().optional(),
    servers: z.array(clusterServerSchema).optional(),
    postgres_version: z.number().int().optional(),
    cluster_location: z.string().optional(),
    project_name: z.string().optional(),
    cloud_secret_id: z.number().int().nullable().optional(),
    server_secret_id: z.number().int().nullable().optional(),
  })
  .passthrough();

export const operationSchema = z
  .object({
    id: z.number().int(),
    cluster_name: z.string().optional(),
    started: z.string().optional(),
    finished: z.string().nullable().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    environment: z.string().optional(),
    user: z.string().nullable().optional(),
  })
  .passthrough();

export const extensionSchema = z
  .object({
    name: z.string(),
    description: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    postgres_min_version: z.string().nullable().optional(),
    postgres_max_version: z.string().nullable().optional(),
    contrib: z.boolean().optional(),
  })
  .passthrough();

export const postgresVersionSchema = z
  .object({
    major_version: z.number().int(),
    release_date: z.string().optional(),
    end_of_life: z.string().optional(),
  })
  .passthrough();

export function listResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      data: z.array(itemSchema),
      meta: paginationSchema.optional(),
    })
    .passthrough();
}

export const versionResponseListSchema = z
  .object({
    data: z.array(postgresVersionSchema),
  })
  .passthrough();

export type Cluster = z.infer<typeof clusterSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type PostgresVersion = z.infer<typeof postgresVersionSchema>;
export type PostgresParameter = z.infer<typeof postgresParameterSchema>;
export type ClusterBackup = z.infer<typeof clusterBackupSchema>;
