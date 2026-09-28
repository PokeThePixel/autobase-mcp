# Autobase MCP

A local stdio MCP server for managing Autobase Console projects, clusters, and
environments, and for reading their status and supported deployment options.
It is designed to be forked and configured for any Autobase Console instance.
It has no Isle of TAS configuration or defaults.

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

## Read tools

- `autobase_get_api_version`
- `autobase_list_deployments`
- `autobase_list_projects`
- `autobase_list_environments`
- `autobase_list_clusters`
- `autobase_get_cluster_default_name`
- `autobase_get_cluster`
- `autobase_list_operations`
- `autobase_get_operation_log`
- `autobase_list_postgres_versions`
- `autobase_list_extensions`

## Write tools

- `autobase_create_project`
- `autobase_update_project`
- `autobase_delete_project`
- `autobase_create_environment`
- `autobase_delete_environment`
- `autobase_create_cluster`
- `autobase_delete_cluster`
- `autobase_delete_server`
- `autobase_refresh_cluster`

Every write tool requires `confirm: true` and should run only after the user
requests that specific change. Cluster creation may provision cloud resources
and incur charges. It accepts a reference to an existing Console secret, never
secret values. Arbitrary `extra_vars` are not accepted. The API's settings and
secrets endpoints are not exposed.
Cluster and server deletion remove Console database records, not the running
infrastructure.

List tools accept a maximum page size of 100 and return `meta.hasMore` and
`meta.nextOffset` so callers can request the next page without fetching an
unbounded result set. When the API omits its total count, `hasMore` is inferred
from whether the returned page fills the requested page size.

Cluster listing supports the Console's name, status, location, environment,
server-count, PostgreSQL-version, creation-date, and sort filters. Operation
listing also supports the Console's documented sort fields.

Deployment results include Console-supported regions, datacenters, instance
types, and volume options. Raw cloud image configuration is omitted.

Cluster responses omit
`connection_info`, Ansible `extra_vars`, and inventory. Operation logs are
capped at 20,000 characters and redact common credential fields and the API
token. This redaction is a safety measure, not a guarantee that every custom
secret format can be detected.

The server exposes no arbitrary HTTP requests, SQL, shell, Docker, or Ansible
inputs. It does not expose settings or secrets endpoints.

## Development

```sh
bun run check
bun run test
bun run lint
bun run format:check
```

GitHub Actions runs these checks on Ubuntu and Windows for pushes and pull
requests. The tests use mocked API responses and do not require a live Console
token.
