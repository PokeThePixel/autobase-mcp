import { describe, expect, test } from "bun:test";
import { clusterSchema, deploymentSchema } from "../src/schemas";
import {
  clusterForTool,
  deploymentForTool,
  paginationForTool,
} from "../src/tools";

describe("cluster tool projection", () => {
  test("omits connection details, Ansible variables, and inventory", () => {
    const cluster = clusterSchema.parse({
      id: 4,
      name: "primary",
      connection_info: { password: "do-not-return" },
      extra_vars: "secret: do-not-return",
      inventory: "do-not-return",
      servers: [{ id: 9, name: "db-1", role: "leader" }],
    });

    const result = clusterForTool(cluster);
    const encoded = JSON.stringify(result);

    expect(result).toMatchObject({
      id: 4,
      name: "primary",
      servers: [{ id: 9, name: "db-1", role: "leader" }],
    });
    expect(encoded).not.toContain("connection_info");
    expect(encoded).not.toContain("extra_vars");
    expect(encoded).not.toContain("inventory");
    expect(encoded).not.toContain("do-not-return");
  });
});

describe("pagination tool metadata", () => {
  test("provides the next offset when the count shows more results", () => {
    expect(
      paginationForTool(
        { count: 45, limit: 20, offset: 20 },
        { limit: 20, offset: 20 },
        20,
      ),
    ).toEqual({
      count: 45,
      limit: 20,
      offset: 20,
      hasMore: true,
      nextOffset: 40,
    });
  });

  test("uses the requested page size when the API omits pagination metadata", () => {
    expect(paginationForTool(undefined, { limit: 20, offset: 40 }, 5)).toEqual({
      count: null,
      limit: 20,
      offset: 40,
      hasMore: false,
      nextOffset: null,
    });
  });

  test("does not claim another page when the count has been reached", () => {
    expect(
      paginationForTool(
        { count: 40, limit: 20, offset: 20 },
        { limit: 20, offset: 20 },
        20,
      ),
    ).toMatchObject({ hasMore: false, nextOffset: null });
  });
});

describe("deployment tool projection", () => {
  test("returns deployment choices but omits raw cloud image configuration", () => {
    const deployment = deploymentSchema.parse({
      code: "aws",
      description: "Amazon Web Services",
      cloud_regions: [
        {
          code: "north_america",
          name: "North America",
          datacenters: [
            {
              code: "ca-central-1",
              location: "Canada (central)",
              cloud_image: {
                image: { server_image: "internal-image-id" },
                arch: "amd64",
                os_name: "Ubuntu",
                os_version: "22.04 LTS",
              },
            },
          ],
        },
      ],
      instance_types: {
        small: [{ code: "m5.large", cpu: 2, ram: 8 }],
      },
    });

    const result = deploymentForTool(deployment);
    const encoded = JSON.stringify(result);

    expect(result).toMatchObject({
      code: "aws",
      regions: [
        {
          code: "north_america",
          datacenters: [
            {
              code: "ca-central-1",
              cloudImage: { architecture: "amd64", osName: "Ubuntu" },
            },
          ],
        },
      ],
      instanceTypes: { small: [{ code: "m5.large", cpu: 2, ramGb: 8 }] },
    });
    expect(encoded).not.toContain("server_image");
    expect(encoded).not.toContain("internal-image-id");
  });
});
