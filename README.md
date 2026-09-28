# Autobase MCP

A local stdio MCP server for reading Autobase Console projects, clusters,
operations, PostgreSQL versions, and extensions. It is designed to be forked
and configured for any Autobase Console instance. It has no Isle of TAS
configuration or defaults.

## Requirements

- Bun 1.4 or later
- Autobase Console API access
- A Console API token configured by the Console operator
- HTTPS for remote API connections. Plain HTTP is accepted only for loopback
  addresses such as `localhost`

This MCP server currently uses the Autobase Console Swagger contract version
2.11.0. The deployed API version is available through the
`autobase_get_api_version` tool. Check that version before relying on results
from a different Console release. The pinned Swagger revision and endpoint
list are in [`docs/api-contract.md`](docs/api-contract.md).

## Configure

Clone or fork this repository, then install dependencies:

```sh
bun install
```

Set these environment variables in your MCP client configuration:

| Variable | Description |
| --- | --- |
| `AUTOBASE_API_BASE_URL` | Console origin, for example `https://console.example.com`. The client adds `/api/v1`. |
| `AUTOBASE_API_TOKEN` | Console API bearer token. Keep it in the MCP client's secret or environment configuration, not in this repository. |

The server rejects remote HTTP URLs and URLs containing credentials, query
parameters, or fragments. It does not print the token or raw API error bodies.

For an MCP client that supports stdio servers, configure:

```json
{
  "mcpServers": {
    "autobase": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/autobase-mcp/src/index.ts"],
      "env": {
        "AUTOBASE_API_BASE_URL": "https://console.example.com",
        "AUTOBASE_API_TOKEN": "set-this-in-your-client"
      }
    }
  }
}
```

Replace the example values in your local client configuration. Do not commit
real tokens or a `.env` file.

## Read-only tools

- `autobase_get_api_version`
- `autobase_list_projects`
- `autobase_list_clusters`
- `autobase_get_cluster`
- `autobase_list_operations`
- `autobase_get_operation_log`
- `autobase_list_postgres_versions`
- `autobase_list_extensions`

List tools accept a maximum page size of 100. Cluster responses omit
`connection_info`, Ansible `extra_vars`, and inventory. Operation logs are
capped at 20,000 characters and redact common credential fields and the API
token. This redaction is a safety measure, not a guarantee that every custom
secret format can be detected.

The server exposes no write tools, arbitrary HTTP requests, SQL, shell, Docker,
or Ansible inputs. It does not create or delete clusters.

## Development

```sh
bun run check
bun run test
bun run lint
bun run format:check
```

The tests use mocked API responses and do not require a live Console token.
