# Autobase MCP

This MCP server connects GitHub Copilot to an Autobase Console. Copilot can
read cluster status, inspect PostgreSQL settings and backups, and run
documented cluster-management operations.

Start with read-only access. The server hides write tools unless you turn them
on, and each write or remote cluster action also requires `confirm: true`.

## Get started with GitHub Copilot

These steps are for GitHub Copilot CLI, including the Copilot CLI experience
in the GitHub Copilot app. GitHub's [MCP setup guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)
has details for other setup methods. You need a Console API token from your
Autobase Console operator. This is not a GitHub token.

### 1. Install Bun

On Windows, open PowerShell and run Bun's official installer:

```powershell
powershell -c "irm https://bun.sh/install.ps1 | iex"
```

Close and reopen PowerShell, then check the installation:

```powershell
bun --version
```

The server needs Bun 1.4 or later. See the [Bun installation guide](https://bun.sh/docs/installation)
for macOS, Linux, or other installation options.

### 2. Download and prepare this project

If `git` is not recognized in PowerShell, install
[Git for Windows](https://git-scm.com/download/win) first.

In PowerShell, run:

```powershell
git clone https://github.com/PokeThePixel/autobase-mcp.git
cd autobase-mcp
bun install
```

Keep this folder on your computer. Copilot needs its full path to start the
server. To print that path, run:

```powershell
(Resolve-Path .\src\index.ts).Path
```

Copy the path shown. You will use it in the next step.

### 3. Get your Autobase Console details

Ask your Console operator for:

- The Console address, such as `https://console.example.com`
- A Console API token with access to the projects and clusters you need

Use the Console's origin as the address. Do not add `/api/v1`. The server adds
that path itself. Remote Console connections must use HTTPS.

### 4. Add Autobase in Copilot

Open the GitHub Copilot CLI experience and enter:

```text
/mcp add
```

Fill in the form:

1. **Server name:** `autobase`
2. **Server type:** `STDIO`
3. **Command:** Enter this, replacing the example path with the path you
   copied in step 2:

   ```text
   bun run "C:\path\to\autobase-mcp\src\index.ts" --enable-write-tools=false
   ```

   Keep the quotation marks around the path if it contains spaces.
4. **Environment variables:**

   ```json
   {
     "AUTOBASE_API_BASE_URL": "https://console.example.com",
     "AUTOBASE_API_TOKEN": "paste-your-console-token-here",
     "AUTOBASE_ENABLE_WRITE_TOOLS": "false"
   }
   ```

Replace the example Console address, token, and script path with your values.
Press **Ctrl+S** to save. Copilot CLI starts the MCP server and lists its tools.

Copilot saves the token in your local MCP configuration, which may be plain
text. Use a dedicated Console token. Do not paste it into chat, commit it to
Git, or put it in this repository.

If `/mcp add` is not available, edit the user configuration file at
`%USERPROFILE%\.copilot\mcp-config.json`. Add this entry under `mcpServers`,
replacing the sample script path and credentials:

```json
{
  "mcpServers": {
    "autobase": {
      "type": "stdio",
      "command": "bun",
      "args": [
        "run",
        "C:\\path\\to\\autobase-mcp\\src\\index.ts",
        "--enable-write-tools=false"
      ],
      "env": {
        "AUTOBASE_API_BASE_URL": "https://console.example.com",
        "AUTOBASE_API_TOKEN": "paste-your-console-token-here",
        "AUTOBASE_ENABLE_WRITE_TOOLS": "false"
      }
    }
  }
}
```

### 5. Check that Copilot can reach Autobase

In Copilot CLI, check the server:

```text
/mcp show autobase
```

Then ask Copilot:

> Use `autobase_get_api_version` to check the Console connection. Then use
> `autobase_list_projects` with a limit of 5 and show each project's name and ID.

Copilot should call those tools and return the results. The version tool also
shows the API contract version this server was built against. Check it before
using the tools with a Console release you have not tested.

You can run local checks without a live Console token:

```powershell
bun run check
bun test
bun run lint
bun run format:check
```

## Before enabling write tools

Keep write tools off until read-only calls work. To enable them, edit the
`autobase` server with `/mcp edit autobase` and change the argument
`--enable-write-tools=false` to `--enable-write-tools=true`. You can also change
`AUTOBASE_ENABLE_WRITE_TOOLS` to `"true"`. Save the configuration.

Write tools can create cloud resources and incur charges, change cluster
configuration, or delete Console records. Every write tool requires
`confirm: true`. Test writes only against a Console and cluster you are allowed
to change. Cluster and server deletion remove Console records. They do not
delete the running infrastructure. Backup listing also starts a remote
Ansible task.

Cluster configuration values are sent to Autobase. Use existing secret
references for credentials. Do not put passwords or keys in `extraVars`,
`runtimeExtraVars`, inventory, or environment values.

## What Copilot can do

Read tools inspect projects, environments, clusters, operations, deployments,
PostgreSQL versions, parameters, and extensions. Cluster responses omit
connection details, Ansible variables, and inventory. With write tools
enabled, Copilot can also request backup records by running the Console's
backup-list playbook.

With write tools enabled, Copilot can create and update projects, create
environments and clusters, manage existing clusters with the Console's
documented playbooks, update stored cluster access references, refresh cluster
status, and remove project, environment, cluster, or server records.

`autobase_manage_cluster` returns an operation ID. Copilot can pass that ID to
`autobase_get_operation` to check its status or `autobase_get_operation_log` to
read the redacted, capped operation log.

The server does not expose Autobase's settings or secrets endpoints, arbitrary
HTTP requests, SQL, shell, or Docker.

## Troubleshooting

- **`bun` is not recognized:** close and reopen PowerShell after installing
  Bun. If it still fails, see Bun's PATH instructions in its installation
  guide.
- **Copilot cannot start the server:** check that the `src\index.ts` path in
  the MCP entry points to the file on your computer, and that `bun --version`
  reports 1.4 or later.
- **The Console rejects the request:** check the Console address and API token
  with your Console operator. Use HTTPS for a remote Console.
- **Write tools are missing:** check that both the command argument and
  environment setting do not set write tools to `false`. The command argument
  overrides the environment setting.
- **A tool returns an API version mismatch:** compare the deployed version
  from `autobase_get_api_version` with the version noted in
  [`docs/api-contract.md`](docs/api-contract.md).

## Development

GitHub Actions runs type-checking, tests, lint, and formatting checks on
Windows and Ubuntu for pushes and pull requests. The local tests use mocked
API responses and do not need a live Console token.
