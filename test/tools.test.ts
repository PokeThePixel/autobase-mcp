import { describe, expect, test } from "bun:test";
import { clusterSchema } from "../src/schemas";
import { clusterForTool, paginationForTool } from "../src/tools";

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
