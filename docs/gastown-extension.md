# Gas Town Flotilla Extension

> Renders Gas Town's Nostr telemetry inside Flotilla via a Smart Widget (kind 30033) iframe dashboard.

## Overview

This extension subscribes to Gas Town's custom Nostr event kinds and renders them as interactive dashboards inside Flotilla. It uses the Smart Widget scaffold (`tool` type) with the `WidgetBridge` for host communication.

### Dashboards

| Tab | GT Kind(s) | Description |
|-----|-----------|-------------|
| **Activity** | 30315 (`LOG_STATUS`) | Real-time activity feed replacing `.events.jsonl` |
| **Agents** | 30316 (`LIFECYCLE`) | Agent presence cards with heartbeat/stale detection |
| **Chat** | 14 (`DM`) / 1059 (`GIFT_WRAP`) | NIP-17 direct messages |
| **Channels** | 40/41/42 (`CHANNEL_*`) | NIP-28 public channels |
| **Convoys** | 30318 (`GT_CONVOY_STATE`) | Convoy progress with tracked issue breakdown |
| **Issues** | 30319 (`GT_BEADS_ISSUE_STATE`) | Beads issue mirror with status/priority filters |
| **Groups** | 30321 (`GT_GROUP_DEF`) | Group definitions |
| **Work Queue** | 30325 (`GT_WORK_ITEM`) + 30322 (`GT_QUEUE_DEF`) | Claimable work items and queue definitions |
| **Protocol** | 30320 (`GT_PROTOCOL_EVENT`) | Machine-to-machine protocol events (MERGE_READY, etc.) |

### nostrKinds Declaration

The extension declares all the Nostr event kinds it needs in its kind 30033 manifest via `nostrKinds` tags. The host uses these to gate which kinds the extension can query/subscribe to through the bridge:

```
GT protocol kinds:  30315, 30316, 30318, 30319, 30320, 30321, 30322, 30323, 30325
AI-Hub reused:      38383, 38384, 38385, 38386
NIP-17 DMs:         14, 1059
NIP-28 Channels:    40, 41, 42
```

### Event Filtering

All GT queries include `#gt: ["1"]` to scope to Gas Town protocol events. Additional tag filters (`#rig`, `#status`, `#type`, `#visibility`, etc.) are applied per-view.

Replaceable events (kinds 30316, 30318, 30319, 30321-30323) are deduplicated by `d` tag, keeping the latest version.

### Subscription-Based Data Flow

The extension uses **persistent Nostr subscriptions** via the host bridge's `nostr:subscribe` action — no polling or timeouts. Events stream in real-time via `nostr:subscription:event` push messages from the host, and EOSE signals via `nostr:eose` indicate when historical data has been loaded.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Flotilla Host                   │
│  ┌────────────────────────────────────────┐  │
│  │  ExtensionRegistry + ExtensionBridge   │  │
│  │  - nostr:subscribe (welshman relay     │  │
│  │    pool, persistent subscriptions)     │  │
│  │  - nostr:query (welshman load, EOSE)   │  │
│  │  - nostr:publish (publishThunk)        │  │
│  │  - storage:* (localStorage scoped)     │  │
│  │  - ui:toast, ui:resize                 │  │
│  │  - nostrKinds enforcement              │  │
│  └──────────┬─────────────────────────────┘  │
│             │ postMessage                     │
└─────────────┼────────────────────────────────┘
              │
┌─────────────┼────────────────────────────────┐
│  Sandboxed iframe (Gas Town Dashboard)       │
│  ┌──────────▼────────────────────────────┐   │
│  │  WidgetBridge → GTStoreManager        │   │
│  │  - Persistent nostr:subscribe subs    │   │
│  │  - Real-time nostr:subscription:event ingestion    │   │
│  │  - EOSE-based readiness detection     │   │
│  │  - signalReady() on init              │   │
│  └──────────┬────────────────────────────┘   │
│             │                                 │
│  ┌──────────▼────────────────────────────┐   │
│  │  Svelte 5 Dashboard Views             │   │
│  │  Activity | Agents | Chat | Channels  │   │
│  │  Convoys | Issues | Groups |          │   │
│  │  Work Queue | Protocol                │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

**Dependency boundary**: The extension depends only on `nostr-tools` — never on `welshman`. All relay communication goes through the `WidgetBridge` postMessage protocol. The host fulfills requests using welshman's relay infrastructure.

## Package Structure

```
packages/
├── shared/src/
│   ├── gastown/
│   │   ├── kinds.ts      # Event kind constants
│   │   ├── types.ts      # Payload type definitions
│   │   ├── filters.ts    # Nostr filter builders
│   │   ├── parser.ts     # Event parsing + dedup
│   │   ├── stores.ts     # Subscription-based reactive GT stores
│   │   └── index.ts      # Re-exports
│   ├── bridge.ts         # WidgetBridge (signalReady, subscribe)
│   ├── types.ts          # Wire protocol types + full WidgetActionMap
│   ├── signaling.ts      # GT event creation helpers
│   └── index.ts          # Package exports
├── iframe-app/src/
│   ├── App.svelte         # Dashboard router (tabs)
│   ├── main.ts            # Entry point
│   ├── lib/utils.ts       # Formatting helpers
│   └── views/
│       ├── ActivityView.svelte
│       ├── AgentsView.svelte
│       ├── ChatView.svelte
│       ├── ChannelsView.svelte
│       ├── ConvoysView.svelte
│       ├── GroupsView.svelte
│       ├── IssuesView.svelte
│       ├── WorkQueueView.svelte
│       └── ProtocolView.svelte
├── manifest/src/
│   ├── generator.ts       # Smart Widget event generator (with nostrKinds)
│   ├── gastown-defaults.ts # GT-specific defaults (kinds, permissions)
│   └── cli.ts             # CLI tool (--nostr-kinds flag)
├── worker/src/            # Headless bridge (future)
└── test-utils/src/        # Test mocks
```

## Permissions

| Permission | Purpose |
|-----------|---------|
| `nostr:query` | One-shot fetch of GT events from relays |
| `nostr:subscribe` | Persistent subscriptions for real-time event streaming |
| `nostr:unsubscribe` | Close subscriptions |
| `nostr:publish` | Publish GT events (work item claims, DMs, channel messages) |
| `storage:get` | Read extension-scoped localStorage |
| `storage:set` | Write extension-scoped localStorage |
| `storage:remove` | Remove extension-scoped localStorage |
| `storage:keys` | List extension-scoped localStorage keys |
| `ui:toast` | Show toast notifications |
| `ui:resize` | Request iframe height changes |

## Lifecycle

1. Host loads extension iframe in sandbox
2. Extension creates `WidgetBridge` and calls `signalReady()`
3. Host sends `widget:init` with pubkey, relays, hostVersion
4. Extension also listens for `context:repoUpdate` (repo-scoped context)
5. Extension opens persistent `nostr:subscribe` subscriptions for GT kinds
6. Events stream in via `nostr:subscription:event` push messages
7. EOSE signals per-relay trigger readiness state
8. On unload: host cleans up all subscriptions automatically

## Environment & Relay Configuration

The extension receives relay URLs from the host via `widget:init` or `context:repoUpdate`. If no context arrives, a 10-second timeout marks the stores as ready with whatever data has arrived.

Gas Town's Go-side Nostr publisher uses these env vars:

| Env Var | Purpose |
|---------|---------|
| `GT_NOSTR_ENABLED` | Enable Nostr publishing (`1` to activate) |
| `GT_NOSTR_WRITE_RELAYS` | Comma-separated write relay URLs |
| `GT_NOSTR_READ_RELAYS` | Comma-separated read relay URLs |
| `GT_NOSTR_HEARTBEAT_INTERVAL` | Agent heartbeat interval (default: 60s) |

The extension's relay list should match the read relays configured on the Gas Town side.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (iframe app)
pnpm dev

# Build all packages
pnpm build

# Generate Smart Widget manifest (with nostrKinds for all GT kinds)
pnpm manifest:generate \
  --title "Gas Town Dashboard" \
  --app-url "https://your-cdn.example.com/gastown/index.html" \
  --icon "https://your-cdn.example.com/gastown/icon.png" \
  --image "https://your-cdn.example.com/gastown/preview.png" \
  --identifier "gastown-dashboard" \
  --nostr-kinds "30315,30316,30318,30319,30320,30321,30322,30323,30325,38383,38384,38385,38386,14,40,41,42,1059" \
  --permissions "nostr:publish,nostr:query,nostr:subscribe,nostr:unsubscribe,storage:get,storage:set,storage:remove,storage:keys,ui:toast,ui:resize"
```

## Related Documentation

- [Gas Town Nostr Protocol Spec](../../gastown/docs/design/nostr-protocol.md)
- [Gas Town Nostr Architecture](../../gastown/docs/design/nostr-architecture.md)
- [Flotilla Extension Developer Guide](../../flotilla/docs/extensions/README.md)
- [Host Bridge Integration](./host-bridge.md)
- [Smart Widget Manifest](./manifest.md)
