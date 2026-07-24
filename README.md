# Gas Town — Flotilla Extension

Real-time Gas Town telemetry dashboard for Flotilla, delivered as a Nostr Smart Widget (kind `30033`).

## What It Does

Subscribes to Gas Town's Nostr event kinds and renders live dashboards inside Flotilla's iframe extension system. Events stream in real-time via relay subscriptions — **no polling**.

### Dashboard Views

| Tab | Kind(s) | What You See |
|-----|---------|--------------|
| **Activity** | 30315 (`LOG_STATUS`) | Live activity feed (sling, done, merge, patrol, etc.) |
| **Agents** | 30316 (`LIFECYCLE`) | Agent cards with role, status, heartbeat, stale detection |
| **Chat** | 14 (NIP-17 DM) | Discord-like DM conversations with agents and humans |
| **Channels** | 40/41/42 (NIP-28) | Public channel list, real-time channel messages |
| **Convoys** | 30318 (`GT_CONVOY_STATE`) | Convoy progress bars, tracked issues, active workers |
| **Issues** | 30319 (`GT_BEADS_ISSUE_STATE`) | Issue table with status/priority filters, deps, Blossom blobs |
| **Groups** | 30321 (`GT_GROUP_DEF`) | Agent group definitions with member lists |
| **Work Queue** | 30325 + 30322 | Claimable work items, queue definitions and stats |
| **Protocol** | 30320 (`GT_PROTOCOL_EVENT`) | Machine protocol events (MERGE_READY, POLECAT_DONE, HELP) |

## Architecture

```
Flotilla Host
├── ExtensionBridge (postMessage)
│   ├── nostr:subscribe → opens relay subscriptions
│   ├── nostr:subscription:event ← pushes events as they arrive
│   ├── nostr:eose ← signals end-of-stored-events
│   └── nostr:publish → signs + publishes (DMs, channel messages)
│
└── Sandboxed iframe (this extension)
    ├── WidgetBridge → GTStoreManager
    │   ├── GT Protocol Stores (30315–30325, subscription-fed)
    │   ├── NIP-17 DM Store (kind 14, gift-wrapped)
    │   ├── NIP-28 Channel Store (kind 40/41/42)
    │   └── No polling — all stores are push-updated
    └── Svelte 5 Dashboard Views (9 tabs)
```

## Quick Start

```bash
# Install
pnpm install

# Dev server (iframe app at http://localhost:5173)
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# E2E tests
pnpm e2e
```

## Project Structure

```
packages/
├── shared/           # Bridge, types, GT event stores, filters, parser
│   └── src/gastown/  # GT-specific: kinds, types, filters, parser, reactive stores
├── iframe-app/       # Svelte 5 dashboard (the actual widget UI)
├── manifest/         # CLI to generate kind 30033 Smart Widget event
├── worker/           # Headless bridge stub (future background processing)
└── test-utils/       # Mock bridge and test helpers
```

## Generating the Smart Widget Event

```bash
pnpm manifest:generate \
  --title "Gas Town Dashboard" \
  --app-url "https://your-cdn.example.com/gastown/index.html" \
  --icon "https://your-cdn.example.com/gastown/icon.png" \
  --image "https://your-cdn.example.com/gastown/preview.png" \
  --identifier "gastown-dashboard" \
  --permissions "nostr:publish,nostr:query,nostr:subscribe,ui:toast"
```

## Relay Configuration

The extension receives relay URLs from the host via `widget:init` or `context:repoUpdate` (with an explicitly deprecated `context:update` fallback for older hosts). These must match the relays your Gas Town instance publishes to:

```bash
# In your Gas Town .env / Docker config:
GT_NOSTR_WRITE_RELAYS=ws://relay:7000
GT_NOSTR_READ_RELAYS=ws://relay:7000
```

## Permissions

| Permission | Purpose |
|-----------|---------|
| `nostr:subscribe` | Open persistent relay subscriptions |
| `nostr:unsubscribe` | Close subscriptions on teardown |
| `nostr:query` | One-shot relay queries (fallback) |
| `nostr:publish` | Publish events (future: work item claims) |
| `ui:toast` | Show toast notifications |

## Documentation

- [Gas Town Extension Architecture](docs/gastown-extension.md) — detailed design
- [Host Bridge Protocol](docs/host-bridge.md) — postMessage wire format
- [Security](docs/security.md) — sandboxing and permissions
- [Manifest Format](docs/manifest.md) — kind 30033 event structure

## Related

- [Gas Town Nostr Protocol Spec](../../gastown/docs/design/nostr-protocol.md)
- [Gas Town Docker Deployment](../../gastown/docs/DOCKER.md)
- [Flotilla Extension Developer Guide](../../flotilla/docs/extensions/README.md)

## License

MIT
