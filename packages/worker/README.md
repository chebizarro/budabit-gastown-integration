# @flotilla/ext-worker — Gas Town Worker Bridge

Headless worker bridge for Gas Town background processing. Uses the same Flotilla wire protocol
(`{ type, action, payload, id }`) as the iframe bridge but without DOM dependencies.

## Use Cases

- **Event aggregation**: Pre-process relay events before forwarding to the UI thread
- **Offline spool**: Queue events when relays are unreachable, drain when they reconnect
- **Headless agents**: Service-worker based agent coordination

## Usage

```typescript
import { createWorkerBridge } from '@flotilla/ext-worker';

declare const self: DedicatedWorkerGlobalScope;

const bridge = createWorkerBridge((message) => {
  self.postMessage(message);
});

self.addEventListener('message', (event) => {
  void bridge.handleMessage(event.data);
});

// Subscribe to nostr:event pushes
bridge.onEvent('nostr:event', (payload) => {
  // Process incoming relay events
});

// Send requests to host
await bridge.request('nostr:publish', { kind: 1, content: 'hello', tags: [], created_at: 0 });
```
