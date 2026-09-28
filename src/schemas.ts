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
  existingCluster: z.boolean().optional(),
});

export const clusterCreateResponseSchema = z
  .object({
    cluster_id: z.number().int(),
    operation_id: z.number().int(),
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
