# Autobase API contract

The client follows the Autobase Console Swagger 2.0 contract for the operations
listed below:

- Swagger `info.version`: `2.11.0`
- Source file: [`console/service/api/swagger.yaml`](https://github.com/autobase-tech/autobase/blob/a9233c04881aa0d72f9764c25ce2b60ef2862448/console/service/api/swagger.yaml)
- Autobase source revision: `a9233c04881aa0d72f9764c25ce2b60ef2862448`
- API base path: `/api/v1`

The deployed Console release has not been confirmed as part of this source
checkout. Call `autobase_get_api_version` against the configured Console before
using other tools, and compare the returned service version with the Swagger
version above. Do not assume that the latest Swagger on `main` matches an
older Console image.

The cluster management endpoint was added from the current Autobase API
reference. It is not present in the pinned Swagger source revision above.

## Exposed API operations

The MCP client calls these read endpoints:

- `GET /version`
- `GET /external/deployments`
- `GET /projects`
- `GET /environments`
- `GET /clusters`
- `GET /clusters/default_name`
- `GET /clusters/{id}`
- `GET /operations`
- `GET /operations/{id}/log`
- `GET /postgres_versions`
- `GET /database/extensions`

The MCP client also exposes these write endpoints:

- `POST /projects`
- `PATCH /projects/{id}`
- `DELETE /projects/{id}`
- `POST /environments`
- `DELETE /environments/{id}`
- `POST /clusters`
- `DELETE /clusters/{id}`
- `DELETE /servers/{id}`
- `POST /clusters/{id}/refresh`
- `POST /clusters/{id}/manage`

Every JSON response is parsed against a Zod schema. Tool results project API
objects onto an explicit field allowlist. In particular, cluster results omit
`connection_info`, `extra_vars`, and `inventory`.

List tools accept `limit` and `offset` and return `meta.hasMore` and
`meta.nextOffset`. When the API supplies a total count, the server uses it to
determine whether another page exists. Otherwise, it treats a full page as an
indication that another page may be available. Each tool call fetches one page.

Cluster listing passes through the documented `name`, `status`, `location`,
`environment`, `server_count`, `postgres_version`, `created_at_from`,
`created_at_to`, and `sort_by` query parameters. Operation listing supports
`sort_by` in addition to its project, date, and operation filters. Sort fields
are restricted to the values listed in the pinned Swagger contract.

Deployment responses project supported deployment, region, datacenter,
instance-type, and volume fields onto an explicit allowlist. The nested raw
cloud image configuration is not returned. The cluster default-name endpoint
returns only the suggested name.

`POST /clusters/{id}/manage` follows the current Autobase API reference for
[managing an existing cluster](https://autobase.readme.io/reference/post_clusters-id-manage).
It accepts playbook and tag selection, an optional inventory override,
environment values, persistent `extra_vars`, one-run `runtime_extra_vars`,
cloud and server secret IDs, and new nodes. Persistent variables replace the
saved cluster values only after a successful operation. Runtime variables are
not saved. The endpoint returns the cluster and operation IDs. Callers can pass
the operation ID to `GET /operations/{id}/log` to inspect its progress and
result.

Write tools require `confirm: true`. Cluster and server delete calls remove
records from the Console database and do not claim to delete running
infrastructure. Cluster creation accepts `extra_vars` and `envs` for
provisioning. Both fields are sent to Autobase, so credentials should go
through a stored Console secret ID instead. The `/settings` and `/secrets`
endpoints remain unavailable.
Write tools are not registered unless the operator sets
`AUTOBASE_ENABLE_WRITE_TOOLS=true` or passes
`--enable-write-tools=true` as a command argument. The argument overrides the
environment variable. Leaving both unset keeps the server read-only.
