# Autobase API contract

The read-only client follows the Autobase Console Swagger 2.0 contract:

- Swagger `info.version`: `2.11.0`
- Source file: [`console/service/api/swagger.yaml`](https://github.com/autobase-tech/autobase/blob/a9233c04881aa0d72f9764c25ce2b60ef2862448/console/service/api/swagger.yaml)
- Autobase source revision: `a9233c04881aa0d72f9764c25ce2b60ef2862448`
- API base path: `/api/v1`

The deployed Console release has not been confirmed as part of this source
checkout. Call `autobase_get_api_version` against the configured Console before
using other tools, and compare the returned service version with the Swagger
version above. Do not assume that the latest Swagger on `main` matches an
older Console image.

## Exposed API operations

The MCP client calls only these GET endpoints:

- `GET /version`
- `GET /projects`
- `GET /clusters`
- `GET /clusters/{id}`
- `GET /operations`
- `GET /operations/{id}/log`
- `GET /postgres_versions`
- `GET /database/extensions`

Every JSON response is parsed against a Zod schema. Tool results project API
objects onto an explicit field allowlist. In particular, cluster results omit
`connection_info`, `extra_vars`, and `inventory`.

List tools accept `limit` and `offset` and return `meta.hasMore` and
`meta.nextOffset`. When the API supplies a total count, the server uses it to
determine whether another page exists. Otherwise, it treats a full page as an
indication that another page may be available. Each tool call fetches one page.

No write, scaling, secret-management, or arbitrary REST operation is exposed.
