# Gas Town Flotilla Extension

> Renders Gas Town's Nostr telemetry inside Flotilla via a Smart Widget (kind 30033) iframe dashboard.

## Overview

This extension subscribes to Gas Town's custom Nostr event kinds and renders them as interactive dashboards inside Flotilla. It uses the Smart Widget scaffold (`tool` type) with the `WidgetBridge` for host communication.

### Dashboards

| Tab | GT Kind(s) | Description |
|-----|-----------|-------------|
| **Activity** | 30315 (`LOG_STATUS`) | Real-time activity feed replacing `.events.jsonl` |
| **Agents** | 30316 (`LIFECYCLE`) | Agent presence cards with heartbeat/stale detection |
| **Convoys** | 30318 (`GT_CONVOY_STATE`) | Convoy progress with tracked issue breakdown |
| **Issues** | 30319 (`GT_BEADS_ISSUE_STATE`) | Beads issue mirror with status/priority filters |
| **Work Queue** | 30325 (`GT_WORK_ITEM`) + 30322 (`GT_QUEUE_DEF`) | Claimable work items and queue definitions |
| **Protocol** | 30320 (`GT_PROTOCOL_EVENT`) | Machine-to-machine protocol events (MERGE_READY, etc.) |

### Event Filtering

All queries include `#gt: ["1"]` to scope to Gas Town protocol events. Additional tag filters (`#rig`, `#status`, `#type`, `#visibility`, etc.) are applied per-view.

Replaceable events (kinds 30316, 30318, 30319, 30321-30323) are deduplicated by `d` tag, keeping the latest version.

### Blossom References

Issue events (30319) may include `blobs[]` arrays referencing content-addressed artifacts on Blossom servers. The Issues view surfaces blob counts; consumers can fetch blobs on-demand from the URLs.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Flotilla Host                   │
│  ┌────────────────────────────────────────┐  │
│  │  ExtensionRegistry + ExtensionBridge   │  │
│  │  - nostr:query (SimplePool)            │  │
│  │  - nostr:publish (publishThunk)        │  │
│  │  - storage:* (localStorage scoped)     │  │
│  │  - ui:toast                            │  │
│  └──────────┬─────────────────────────────┘  │
│             │ postMessage                     │
└─────────────┼────────────────────────────────┘
              │
┌─────────────┼────────────────────────────────┐
│  Sandboxed iframe (Gas Town Dashboard)       │
│  ┌──────────▼────────────────────────────┐   │
│  │  WidgetBridge → GTStoreManager        │   │
│  │  - createGTStores(bridge, relays)     │   │
│  │  - Reactive stores per event kind     │   │
│  │  - Auto-refresh every 30s            │   │
│  └──────────┬────────────────────────────┘   │
│             │                                 │
│  ┌──────────▼────────────────────────────┐   │
│  │  Svelte 5 Dashboard Views             │   │
│  │  Activity | Agents | Convoys |        │   │
│  │  Issues | Work Queue | Protocol       │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

## Package Structure

```
packages/
├── shared/src/
│   ├── gastown/
│   │   ├── kinds.ts      # Event kind constants
│   │   ├── types.ts      # Payload type definitions
│   │   ├── filters.ts    # Nostr filter builders
│   │   ├── parser.ts     # Event parsing + dedup
│   │   ├── stores.ts     # Reactive GT stores
│   │   └── index.ts      # Re-exports
│   ├── bridge.ts         # WidgetBridge
│   ├── types.ts          # Wire protocol types + WidgetActionMap
│   ├── signaling.ts      # GT event creation helpers
│   └── index.ts          # Package exports
├── iframe-app/src/
│   ├── App.svelte         # Dashboard router (tabs)
│   ├── main.ts            # Entry point
│   ├── lib/utils.ts       # Formatting helpers
│   └── views/
│       ├── ActivityView.svelte
│       ├── AgentsView.svelte
│       ├── ConvoysView.svelte
│       ├── IssuesView.svelte
│       ├── WorkQueueView.svelte
│       └── ProtocolView.svelte
├── manifest/src/
│   ├── generator.ts       # Smart Widget event generator
│   ├── gastown-defaults.ts # GT-specific defaults
│   └── cli.ts             # CLI tool
├── worker/src/            # Headless bridge (future)
└── test-utils/src/        # Test mocks
```

## Permissions

The extension requests these permissions from the Flotilla host:

| Permission | Purpose |
|-----------|---------|
| `nostr:query` | Fetch GT events from relays |
| `nostr:publish` | Publish GT events (future: work item claims) |
| `storage:get` | Read extension-scoped localStorage |
| `storage:set` | Write extension-scoped localStorage |
| `storage:remove` | Remove extension-scoped localStorage |
| `storage:keys` | List extension-scoped localStorage keys |
| `ui:toast` | Show toast notifications |

## Environment & Relay Configuration

The extension receives relay URLs from the host via `context:update`. If no context arrives within 3 seconds, it falls back to default relays.

Gas Town's Go-side Nostr publisher uses these env vars (documented in `gastown/docs/NOSTR.md`):

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

# Generate Smart Widget manifest
pnpm manifest:generate \
  --title "Gas Town Dashboard" \
  --app-url "https://your-cdn.example.com/gastown/index.html" \
  --icon "https://your-cdn.example.com/gastown/icon.png" \
  --image "https://your-cdn.example.com/gastown/preview.png" \
  --identifier "gastown-dashboard" \
  --permissions "nostr:publish,nostr:query,storage:get,storage:set,storage:remove,storage:keys,ui:toast"
```

## Flotilla Slot Integration

The extension can surface GT data in Flotilla's extension slots:

| Slot ID | Use Case |
|---------|----------|
| `space:sidebar:widgets` | Agent status summary in sidebar |
| `chat:message:actions` | Protocol event cards in channel messages |
| `chat:composer:actions` | GT command shortcuts in chat composer |

These are rendered by Flotilla's `SlotRenderer` component when the extension is loaded.

## Related Documentation

- [Gas Town Nostr Protocol Spec](../../gastown/docs/design/nostr-protocol.md)
- [Gas Town Nostr Architecture](../../gastown/docs/design/nostr-architecture.md)
- [Flotilla Extension Developer Guide](../../flotilla/docs/extensions/README.md)
- [Host Bridge Integration](./host-bridge.md)
- [Smart Widget Manifest](./manifest.md)
