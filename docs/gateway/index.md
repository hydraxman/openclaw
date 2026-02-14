---
summary: "Runbook for the Gateway service, lifecycle, and operations"
read_when:
  - Running or debugging the gateway process
title: "Gateway Runbook"
---

# Gateway runbook

Use this page for day-1 startup and day-2 operations of the Gateway service.

<CardGroup cols={2}>
  <Card title="Deep troubleshooting" icon="siren" href="/gateway/troubleshooting">
    Symptom-first diagnostics with exact command ladders and log signatures.
  </Card>
  <Card title="Configuration" icon="sliders" href="/gateway/configuration">
    Task-oriented setup guide + full configuration reference.
  </Card>
</CardGroup>

<<<<<<< HEAD
- The always-on process that owns channel connections and the control/event plane.
- Replaces the legacy `gateway` command. CLI entry point: `openclaw gateway`.
- Runs until stopped; exits non-zero on fatal errors so the supervisor restarts it.
=======
## 5-minute local startup
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627

<Steps>
  <Step title="Start the Gateway">

```bash
openclaw gateway --port 18789
# debug/trace mirrored to stdio
openclaw gateway --port 18789 --verbose
# force-kill listener on selected port, then start
openclaw gateway --force
```

  </Step>

  <Step title="Verify service health">

```bash
openclaw gateway status
openclaw status
openclaw logs --follow
```

Healthy baseline: `Runtime: running` and `RPC probe: ok`.

  </Step>

  <Step title="Validate channel readiness">

```bash
openclaw channels status --probe
```

  </Step>
</Steps>

<Note>
Gateway config reload watches the active config file path (resolved from profile/state defaults, or `OPENCLAW_CONFIG_PATH` when set).
Default mode is `gateway.reload.mode="hybrid"`.
</Note>

## Runtime model

- One always-on process for routing, control plane, and channel connections.
- Single multiplexed port for:
  - WebSocket control/RPC
  - HTTP APIs (OpenAI-compatible, Responses, tools invoke)
  - Control UI and hooks
- Default bind mode: `loopback`.
- Auth is required by default (`gateway.auth.token` / `gateway.auth.password`, or `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`).

### Port and bind precedence

| Setting      | Resolution order                                              |
| ------------ | ------------------------------------------------------------- |
| Gateway port | `--port` → `OPENCLAW_GATEWAY_PORT` → `gateway.port` → `18789` |
| Bind mode    | CLI/override → `gateway.bind` → `loopback`                    |

### Hot reload modes

| `gateway.reload.mode` | Behavior                                   |
| --------------------- | ------------------------------------------ |
| `off`                 | No config reload                           |
| `hot`                 | Apply only hot-safe changes                |
| `restart`             | Restart on reload-required changes         |
| `hybrid` (default)    | Hot-apply when safe, restart when required |

## Operator command set

```bash
openclaw gateway status
openclaw gateway status --deep
openclaw gateway status --json
openclaw gateway install
openclaw gateway restart
openclaw gateway stop
openclaw logs --follow
openclaw doctor
```

## Remote access

Preferred: Tailscale/VPN.
Fallback: SSH tunnel.

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

Then connect clients to `ws://127.0.0.1:18789` locally.

<Warning>
If gateway auth is configured, clients still must send auth (`token`/`password`) even over SSH tunnels.
</Warning>

See: [Remote Gateway](/gateway/remote), [Authentication](/gateway/authentication), [Tailscale](/gateway/tailscale).

## Supervision and service lifecycle

Use supervised runs for production-like reliability.

<Tabs>
  <Tab title="macOS (launchd)">

```bash
openclaw gateway install
openclaw gateway status
openclaw gateway restart
openclaw gateway stop
```

LaunchAgent labels are `ai.openclaw.gateway` (default) or `ai.openclaw.<profile>` (named profile). `openclaw doctor` audits and repairs service config drift.

  </Tab>

  <Tab title="Linux (systemd user)">

```bash
openclaw gateway install
systemctl --user enable --now openclaw-gateway[-<profile>].service
openclaw gateway status
```

For persistence after logout, enable lingering:

```bash
sudo loginctl enable-linger <user>
```

  </Tab>

  <Tab title="Linux (system service)">

Use a system unit for multi-user/always-on hosts.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

  </Tab>
</Tabs>

## Multiple gateways on one host

Most setups should run **one** Gateway.
Use multiple only for strict isolation/redundancy (for example a rescue profile).

Checklist per instance:

<<<<<<< HEAD
- unique `gateway.port`
- unique `OPENCLAW_CONFIG_PATH`
- unique `OPENCLAW_STATE_DIR`
- unique `agents.defaults.workspace`
- separate channel accounts if you need strict isolation

Service install per profile:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```
=======
- Unique `gateway.port`
- Unique `OPENCLAW_CONFIG_PATH`
- Unique `OPENCLAW_STATE_DIR`
- Unique `agents.defaults.workspace`
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627

Example:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

See: [Multiple gateways](/gateway/multiple-gateways).

<<<<<<< HEAD
- Full docs: [Gateway protocol](/gateway/protocol) and [Bridge protocol (legacy)](/gateway/bridge-protocol).
- Mandatory first frame from client: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`.
- Gateway replies `res {type:"res", id, ok:true, payload:hello-ok }` (or `ok:false` with an error, then closes).
- After handshake:
  - Requests: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Events: `{type:"event", event, payload, seq?, stateVersion?}`
- Structured presence entries: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }` (for WS clients, `instanceId` comes from `connect.client.instanceId`).
- `agent` responses are two-stage: first `res` ack `{runId,status:"accepted"}`, then a final `res` `{runId,status:"ok"|"error",summary}` after the run finishes; streamed output arrives as `event:"agent"`.

## Methods (initial set)

- `health` — full health snapshot (same shape as `openclaw health --json`).
- `status` — short summary.
- `system-presence` — current presence list.
- `system-event` — post a presence/system note (structured).
- `send` — send a message via the active channel(s).
- `agent` — run an agent turn (streams events back on same connection).
- `node.list` — list paired + currently-connected nodes (includes `caps`, `deviceFamily`, `modelIdentifier`, `paired`, `connected`, and advertised `commands`).
- `node.describe` — describe a node (capabilities + supported `node.invoke` commands; works for paired nodes and for currently-connected unpaired nodes).
- `node.invoke` — invoke a command on a node (e.g. `canvas.*`, `camera.*`).
- `node.pair.*` — pairing lifecycle (`request`, `list`, `approve`, `reject`, `verify`).

See also: [Presence](/concepts/presence) for how presence is produced/deduped and why a stable `client.instanceId` matters.

## Events

- `agent` — streamed tool/output events from the agent run (seq-tagged).
- `presence` — presence updates (deltas with stateVersion) pushed to all connected clients.
- `tick` — periodic keepalive/no-op to confirm liveness.
- `shutdown` — Gateway is exiting; payload includes `reason` and optional `restartExpectedMs`. Clients should reconnect.

## WebChat integration

- WebChat is a native SwiftUI UI that talks directly to the Gateway WebSocket for history, sends, abort, and events.
- Remote use goes through the same SSH/Tailscale tunnel; if a gateway token is configured, the client includes it during `connect`.
- macOS app connects via a single WS (shared connection); it hydrates presence from the initial snapshot and listens for `presence` events to update the UI.

## Typing and validation

- Server validates every inbound frame with AJV against JSON Schema emitted from the protocol definitions.
- Clients (TS/Swift) consume generated types (TS directly; Swift via the repo’s generator).
- Protocol definitions are the source of truth; regenerate schema/models with:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## Connection snapshot

- `hello-ok` includes a `snapshot` with `presence`, `health`, `stateVersion`, and `uptimeMs` plus `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` so clients can render immediately without extra requests.
- `health`/`system-presence` remain available for manual refresh, but are not required at connect time.

## Error codes (res.error shape)

- Errors use `{ code, message, details?, retryable?, retryAfterMs? }`.
- Standard codes:
  - `NOT_LINKED` — channel not authenticated.
  - `AGENT_TIMEOUT` — agent did not respond within the configured deadline.
  - `INVALID_REQUEST` — schema/param validation failed.
  - `UNAVAILABLE` — Gateway is shutting down or a dependency is unavailable.

## Keepalive behavior

- `tick` events (or WS ping/pong) are emitted periodically so clients know the Gateway is alive even when no traffic occurs.
- Send/agent acknowledgements remain separate responses; do not overload ticks for sends.

## Replay / gaps

- Events are not replayed. Clients detect seq gaps and should refresh (`health` + `system-presence`) before continuing. WebChat and macOS clients now auto-refresh on gap.

## Supervision (macOS example)

- Use launchd to keep the service alive:
  - Program: path to `openclaw`
  - Arguments: `gateway`
  - KeepAlive: true
  - StandardOut/Err: file paths or `syslog`
- On failure, launchd restarts; fatal misconfig should keep exiting so the operator notices.
- LaunchAgents are per-user and require a logged-in session; for headless setups use a custom LaunchDaemon (not shipped).
  - `openclaw gateway install` writes `~/Library/LaunchAgents/bot.molt.gateway.plist`
    (or `bot.molt.<profile>.plist`; legacy `com.openclaw.*` is cleaned up).
  - `openclaw doctor` audits the LaunchAgent config and can update it to current defaults.

## Gateway service management (CLI)

Use the Gateway CLI for install/start/stop/restart/status:
=======
### Dev profile quick path
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
openclaw --dev status
```

Defaults include isolated state/config and base gateway port `19001`.

## Protocol quick reference (operator view)

- First client frame must be `connect`.
- Gateway returns `hello-ok` snapshot (`presence`, `health`, `stateVersion`, `uptimeMs`, limits/policy).
- Requests: `req(method, params)` → `res(ok/payload|error)`.
- Common events: `connect.challenge`, `agent`, `chat`, `presence`, `tick`, `health`, `heartbeat`, `shutdown`.

Agent runs are two-stage:

1. Immediate accepted ack (`status:"accepted"`)
2. Final completion response (`status:"ok"|"error"`), with streamed `agent` events in between.

See full protocol docs: [Gateway Protocol](/gateway/protocol).

## Operational checks

### Liveness

- Open WS and send `connect`.
- Expect `hello-ok` response with snapshot.

### Readiness

```bash
openclaw gateway status
openclaw channels status --probe
openclaw health
```

### Gap recovery

Events are not replayed. On sequence gaps, refresh state (`health`, `system-presence`) before continuing.

## Common failure signatures

| Signature                                                      | Likely issue                             |
| -------------------------------------------------------------- | ---------------------------------------- |
| `refusing to bind gateway ... without auth`                    | Non-loopback bind without token/password |
| `another gateway instance is already listening` / `EADDRINUSE` | Port conflict                            |
| `Gateway start blocked: set gateway.mode=local`                | Config set to remote mode                |
| `unauthorized` during connect                                  | Auth mismatch between client and gateway |

For full diagnosis ladders, use [Gateway Troubleshooting](/gateway/troubleshooting).

## Safety guarantees

- Gateway protocol clients fail fast when Gateway is unavailable (no implicit direct-channel fallback).
- Invalid/non-connect first frames are rejected and closed.
- Graceful shutdown emits `shutdown` event before socket close.

---

<<<<<<< HEAD
- `openclaw gateway health|status` — request health/status over the Gateway WS.
- `openclaw message send --target <num> --message "hi" [--media ...]` — send via Gateway (idempotent).
- `openclaw agent --message "hi" --to <num>` — run an agent turn (waits for final by default).
- `openclaw gateway call <method> --params '{"k":"v"}'` — raw method invoker for debugging.
- `openclaw gateway stop|restart` — stop/restart the supervised gateway service (launchd/systemd).
- Gateway helper subcommands assume a running gateway on `--url`; they no longer auto-spawn one.
=======
Related:
>>>>>>> 3bbd29bef942ac6b8c81432b9c5e2d968b6e1627

- [Troubleshooting](/gateway/troubleshooting)
- [Background Process](/gateway/background-process)
- [Configuration](/gateway/configuration)
- [Health](/gateway/health)
- [Doctor](/gateway/doctor)
- [Authentication](/gateway/authentication)
