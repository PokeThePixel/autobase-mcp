import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { AutobaseApiClient } from "./api-client";
import { loadConfig } from "./config";
import { registerTools } from "./tools";

async function start(): Promise<void> {
  const config = loadConfig();
  const api = new AutobaseApiClient(config);
  const server = new McpServer({
    name: "autobase-mcp",
    version: "0.1.0",
  });

  registerTools(server, api, config.apiToken);
  await server.connect(new StdioServerTransport());
}

try {
  await start();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown startup error.";
  console.error(`Autobase MCP failed to start: ${message}`);
  process.exitCode = 1;
}
