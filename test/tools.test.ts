import { describe, expect, test } from "bun:test";
import { clusterSchema } from "../src/schemas";
import { clusterForTool } from "../src/tools";

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
