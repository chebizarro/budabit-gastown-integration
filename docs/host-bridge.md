# Host Bridge Integration

Guide for Flotilla host developers integrating **Smart Widgets**.

## Overview

Flotilla Smart Widgets are represented on Nostr as **kind `30033` addressable events**. The host discovers widget events, renders metadata, and loads an **iframe UI** that communicates via an **action-based postMessage protocol**:

- Widget → Host **request**: `{ type: "request", id, action, payload }`
- Host → Widget **response**: `{ type: "response", id, action, payload }`
- Host → Widget **event**: `{ type: "event", action, payload }`

## Architecture

```
┌─────────────────────────────────────┐
│         Flotilla Host               │
│  ┌───────────────────────────────┐  │
│  │      Host Widget Bridge       │  │
│  │  - Validates origin + schema  │  │
│  │  - Routes via welshman relay  │  │
│  │    pool (not SimplePool)      │  │
│  │  - Enforces nostrKinds        │  │
│  │  - Manages subscriptions      │  │
│  │  - Enforces permissions       │  │
│  └──────────┬────────────────────┘  │
│             │ postMessage            │
└─────────────┼────────────────────────┘
              │
┌─────────────┼────────────────────────┐
│  Sandboxed iframe (Widget UI)        │
│  ┌──────────▼────────────────────┐   │
│  │   WidgetBridge (nostr-tools)  │   │
│  │  - request(action, payload)   │   │
│  │  - onEvent(action, handler)   │   │
│  │  - signalReady()              │   │
│  │  - subscribe()                │   │
│  └───────────────────────────────┘   │
└──────────────────────────────────────┘
```

**Dependency boundary**: Extensions use only `nostr-tools`. The host uses `welshman` for relay operations. Extensions never manage relay connections directly.

## Bridge Actions

| Action | Direction | Description |
|--------|-----------|-------------|
| `nostr:query` | Request/Response | One-shot event query (EOSE-based) |
| `nostr:subscribe` | Request/Response | Open persistent relay subscription |
| `nostr:unsubscribe` | Request/Response | Close a subscription |
| `nostr:publish` | Request/Response | Sign and publish a Nostr event |
| `nostr:subscription:event` | Host → Widget | Real-time event from a subscription |
| `nostr:eose` | Host → Widget | End-of-stored-events signal |
| `storage:get/set/remove/keys` | Request/Response | Extension-scoped localStorage |
| `ui:toast` | Request/Response | Show toast notification |
| `ui:resize` | Request/Response | Request iframe height change |
| `context:getRepo` | Request/Response | Get current repo context |
| `widget:init` | Host → Widget | Lifecycle: pubkey, relays, hostVersion |
| `widget:mounted` | Host → Widget | Lifecycle: widget is fully mounted |
| `widget:unmounting` | Host → Widget | Lifecycle: widget is about to unload |
| `context:repoUpdate` | Host → Widget | Repo-scoped context update |

## nostrKinds Enforcement

Extensions must declare which Nostr event kinds they need via `nostrKinds` tags in their kind 30033 manifest. The host only allows queries/subscriptions for declared kinds plus universal read kinds (0, 10002).

```json
{
  "kind": 30033,
  "tags": [
    ["d", "gastown-dashboard"],
    ["nostrKinds", "30315"],
    ["nostrKinds", "30316"],
    ["nostrKinds", "30318"]
  ]
}
```

## Readiness Handshake

1. Host creates iframe, sends `widget:init`
2. Widget processes init, calls `signalReady()` → sends `{ type: "event", action: "widget:ready" }`
3. Host receives ready signal, sends `widget:mounted`
4. If no ready signal within 5s, host sends `widget:mounted` anyway (backward compat)

## Subscription Flow

```
Widget                              Host (welshman)
  │                                     │
  │ request nostr:subscribe             │
  │ {subscriptionId, relays, filter}    │
  ├────────────────────────────────────>│
  │                                     │ Opens welshman request()
  │ response {status: "ok",             │ with AbortController
  │   subscriptionId}                   │
  │<────────────────────────────────────┤
  │                                     │
  │ event nostr:subscription:event                   │ Events arrive in real-time
  │ {subscriptionId, event}             │
  │<────────────────────────────────────┤
  │                                     │
  │ event nostr:eose                    │ End of stored events
  │ {subscriptionId, relay}             │
  │<────────────────────────────────────┤
  │                                     │
  │ request nostr:unsubscribe           │
  │ {subscriptionId}                    │
  ├────────────────────────────────────>│ Aborts AbortController
  │                                     │
```

## Security

### Origin + Source Validation

- `ev.origin === widgetOrigin` (from button/app URL)
- `ev.source === iframe.contentWindow`
- Message shape: `{ type, action, id }`

### Permission Enforcement

- Privileged: `nostr:*`, `storage:*` — checked against declared `permission` tags
- Non-privileged: `ui:*` — rate-limited (10 requests per 5 seconds)

### Subscription Safety

- Max 10 concurrent subscriptions per extension
- All subscriptions cleaned up on extension unload
- 30-second request timeout for all bridge requests

### Key Safety

Widgets must never receive private keys. All signing happens in the host.

## Resources

- [Flotilla Extension Developer Guide](../../flotilla/docs/extensions/README.md)
- [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
