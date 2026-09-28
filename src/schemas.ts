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
export type Operation = z.infer<typeof operationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type PostgresVersion = z.infer<typeof postgresVersionSchema>;
