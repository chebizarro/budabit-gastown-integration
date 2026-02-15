import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GTStore, createGTStores, type GTStoreManager } from './stores.js';
import type { WidgetBridge } from '../bridge.js';

// --- GTStore unit tests ---

describe('GTStore', () => {
  it('stores initial value', () => {
    const store = new GTStore(42);
    expect(store.get()).toBe(42);
  });

  it('updates value via set()', () => {
    const store = new GTStore('hello');
    store.set('world');
    expect(store.get()).toBe('world');
  });

  it('notifies subscribers on set()', () => {
    const store = new GTStore(0);
    const values: number[] = [];
    store.subscribe(v => values.push(v));
    store.set(1);
    store.set(2);
    // subscribe fires immediately with current value, then on each set
    expect(values).toEqual([0, 1, 2]);
  });

  it('returns unsubscribe function', () => {
    const store = new GTStore(0);
    const values: number[] = [];
    const unsub = store.subscribe(v => values.push(v));
    store.set(1);
    unsub();
    store.set(2);
    expect(values).toEqual([0, 1]); // 2 should not be received
  });

  it('update() applies a transform function', () => {
    const store = new GTStore([1, 2, 3]);
    store.update(prev => [...prev, 4]);
    expect(store.get()).toEqual([1, 2, 3, 4]);
  });

  it('supports multiple subscribers', () => {
    const store = new GTStore('a');
    const valuesA: string[] = [];
    const valuesB: string[] = [];
    store.subscribe(v => valuesA.push(v));
    store.subscribe(v => valuesB.push(v));
    store.set('b');
    expect(valuesA).toEqual(['a', 'b']);
    expect(valuesB).toEqual(['a', 'b']);
  });

  it('unsubscribing one does not affect others', () => {
    const store = new GTStore(0);
    const valuesA: number[] = [];
    const valuesB: number[] = [];
    const unsubA = store.subscribe(v => valuesA.push(v));
    store.subscribe(v => valuesB.push(v));

    store.set(1);
    unsubA();
    store.set(2);

    expect(valuesA).toEqual([0, 1]);
    expect(valuesB).toEqual([0, 1, 2]);
  });
});

// --- createGTStores integration tests ---

/**
 * Create a mock WidgetBridge that captures requests and allows
 * simulating host-pushed events.
 */
function createMockBridge() {
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  const requests: { action: string; payload: unknown }[] = [];

  const bridge: WidgetBridge = {
    request: vi.fn(async (action: string, payload?: unknown) => {
      requests.push({ action, payload });
      if (action === 'nostr:subscribe') {
        const p = payload as { id: string };
        return { status: 'ok', subId: p?.id ?? 'sub-1' };
      }
      if (action === 'nostr:unsubscribe') {
        return { status: 'ok' };
      }
      if (action === 'nostr:publish') {
        return { status: 'ok' };
      }
      return { status: 'ok' };
    }),
    onEvent: vi.fn((action: string, handler: (payload: unknown) => void) => {
      if (!eventHandlers.has(action)) {
        eventHandlers.set(action, new Set());
      }
      eventHandlers.get(action)!.add(handler);
      return () => {
        eventHandlers.get(action)?.delete(handler);
      };
    }),
    onRequest: vi.fn(() => () => {}),
    destroy: vi.fn(),
  } as unknown as WidgetBridge;

  /** Simulate the host pushing an event. */
  function pushEvent(action: string, payload: unknown) {
    const handlers = eventHandlers.get(action);
    if (handlers) {
      for (const h of handlers) {
        h(payload);
      }
    }
  }

  return { bridge, requests, pushEvent };
}

function makeGTEvent(kind: number, content: object, tags: string[][], overrides?: Partial<{ id: string; pubkey: string; created_at: number }>) {
  return {
    id: overrides?.id ?? `evt-${Math.random().toString(36).slice(2)}`,
    kind,
    pubkey: overrides?.pubkey ?? 'pub1',
    created_at: overrides?.created_at ?? Math.floor(Date.now() / 1000),
    content: JSON.stringify(content),
    tags: [['gt', '1'], ...tags],
    sig: 'sig1',
  };
}

describe('createGTStores', () => {
  let mock: ReturnType<typeof createMockBridge>;
  let stores: GTStoreManager;

  beforeEach(() => {
    mock = createMockBridge();
    stores = createGTStores(mock.bridge, ['wss://relay.test']);
  });

  it('creates all stores with initial empty values', () => {
    expect(stores.logs.get()).toEqual([]);
    expect(stores.agents.get()).toEqual([]);
    expect(stores.convoys.get()).toEqual([]);
    expect(stores.issues.get()).toEqual([]);
    expect(stores.protocol.get()).toEqual([]);
    expect(stores.workItems.get()).toEqual([]);
    expect(stores.queues.get()).toEqual([]);
    expect(stores.groups.get()).toEqual([]);
    expect(stores.channels.get()).toEqual([]);
    expect(stores.directMessages.get()).toEqual([]);
    expect(stores.channelMeta.get()).toEqual([]);
    expect(stores.channelMessages.get()).toEqual(new Map());
    expect(stores.activeChannelId.get()).toBeNull();
    expect(stores.ready.get()).toBe(false);
    expect(stores.error.get()).toBeNull();
  });

  it('connect() opens relay subscriptions', async () => {
    await stores.connect();

    // Should register event handlers for nostr:event and nostr:eose
    expect(mock.bridge.onEvent).toHaveBeenCalledWith('nostr:event', expect.any(Function));
    expect(mock.bridge.onEvent).toHaveBeenCalledWith('nostr:eose', expect.any(Function));

    // Should open subscriptions (at least gt-state, gt-stream, gt-channels)
    const subRequests = mock.requests.filter(r => r.action === 'nostr:subscribe');
    expect(subRequests.length).toBeGreaterThanOrEqual(3);
  });

  it('connect() with userPubkey opens DM subscription', async () => {
    await stores.connect({ userPubkey: 'abc123' });

    const subRequests = mock.requests.filter(r => r.action === 'nostr:subscribe');
    expect(subRequests.length).toBe(4); // state + stream + channels + dms
  });

  it('ingests lifecycle events (kind 30316)', async () => {
    await stores.connect();

    const event = makeGTEvent(30316, {
      schema: 'gt/lifecycle@1',
      status: 'ready',
      role: 'crew',
      rig: 'main',
      instance: 'worker-1',
    }, [['d', 'main/crew/worker-1'], ['rig', 'main'], ['role', 'crew'], ['status', 'ready']]);

    mock.pushEvent('nostr:event', { subId: 'gt-state', event });

    expect(stores.agents.get()).toHaveLength(1);
    expect(stores.agents.get()[0].data.status).toBe('ready');
  });

  it('ingests activity log events (kind 30315)', async () => {
    await stores.connect();

    const event = makeGTEvent(30315, {
      schema: 'gt/log@1',
      type: 'spawn',
      source: 'gt',
      payload: { agent: 'worker-1' },
    }, [['type', 'spawn'], ['visibility', 'feed']]);

    mock.pushEvent('nostr:event', { subId: 'gt-stream', event });

    expect(stores.logs.get()).toHaveLength(1);
    expect(stores.logs.get()[0].data.type).toBe('spawn');
  });

  it('deduplicates replaceable events by d-tag', async () => {
    await stores.connect();

    const event1 = makeGTEvent(30316, {
      schema: 'gt/lifecycle@1',
      status: 'ready',
      role: 'crew',
      rig: 'main',
      instance: 'w1',
    }, [['d', 'main/crew/w1']], { created_at: 1000 });

    const event2 = makeGTEvent(30316, {
      schema: 'gt/lifecycle@1',
      status: 'busy',
      role: 'crew',
      rig: 'main',
      instance: 'w1',
    }, [['d', 'main/crew/w1']], { created_at: 2000 });

    mock.pushEvent('nostr:event', { subId: 'gt-state', event: event1 });
    mock.pushEvent('nostr:event', { subId: 'gt-state', event: event2 });

    expect(stores.agents.get()).toHaveLength(1);
    expect(stores.agents.get()[0].data.status).toBe('busy');
  });

  it('sets ready after EOSE from all expected subscriptions', async () => {
    await stores.connect();

    expect(stores.ready.get()).toBe(false);

    // 3 subscriptions expected (no userPubkey): state, stream, channels
    mock.pushEvent('nostr:eose', { subId: 'gt-state' });
    expect(stores.ready.get()).toBe(false);

    mock.pushEvent('nostr:eose', { subId: 'gt-stream' });
    expect(stores.ready.get()).toBe(false);

    mock.pushEvent('nostr:eose', { subId: 'gt-channels' });
    expect(stores.ready.get()).toBe(true);
  });

  it('ingests NIP-17 DMs (kind 14)', async () => {
    await stores.connect({ userPubkey: 'myPubkey' });

    const dmEvent = {
      id: 'dm-1',
      kind: 14,
      pubkey: 'agent-pub',
      created_at: Math.floor(Date.now() / 1000),
      content: 'Hello from agent!',
      tags: [['p', 'myPubkey']],
    };

    mock.pushEvent('nostr:event', { subId: 'gt-dms', event: dmEvent });

    expect(stores.directMessages.get()).toHaveLength(1);
    expect(stores.directMessages.get()[0].content).toBe('Hello from agent!');
    expect(stores.directMessages.get()[0].recipientPubkey).toBe('myPubkey');
  });

  it('deduplicates DMs by ID', async () => {
    await stores.connect({ userPubkey: 'myPubkey' });

    const dmEvent = {
      id: 'dm-dup',
      kind: 14,
      pubkey: 'agent-pub',
      created_at: 1000,
      content: 'Hello!',
      tags: [['p', 'myPubkey']],
    };

    mock.pushEvent('nostr:event', { subId: 'gt-dms', event: dmEvent });
    mock.pushEvent('nostr:event', { subId: 'gt-dms', event: dmEvent });

    expect(stores.directMessages.get()).toHaveLength(1);
  });

  it('ingests NIP-28 channel metadata (kind 40)', async () => {
    await stores.connect();

    const chanCreate = {
      id: 'chan-1',
      kind: 40,
      pubkey: 'creator-pub',
      created_at: 1000,
      content: JSON.stringify({ name: 'general', about: 'General chat' }),
      tags: [],
    };

    mock.pushEvent('nostr:event', { subId: 'gt-channels', event: chanCreate });

    expect(stores.channelMeta.get()).toHaveLength(1);
    expect(stores.channelMeta.get()[0].name).toBe('general');
    expect(stores.channelMeta.get()[0].about).toBe('General chat');
  });

  it('ingests NIP-28 channel messages (kind 42)', async () => {
    await stores.connect();

    const chanMsg = {
      id: 'msg-1',
      kind: 42,
      pubkey: 'user-pub',
      created_at: 1000,
      content: 'Hello channel!',
      tags: [['e', 'chan-1', '', 'root']],
    };

    mock.pushEvent('nostr:event', { subId: 'gt-channels', event: chanMsg });

    const msgs = stores.channelMessages.get().get('chan-1');
    expect(msgs).toHaveLength(1);
    expect(msgs![0].content).toBe('Hello channel!');
  });

  it('openChannel() subscribes to channel messages', async () => {
    await stores.connect();
    mock.requests.length = 0; // clear previous requests

    await stores.openChannel('chan-abc123');

    expect(stores.activeChannelId.get()).toBe('chan-abc123');
    const subReqs = mock.requests.filter(r => r.action === 'nostr:subscribe');
    expect(subReqs).toHaveLength(1);
  });

  it('closeChannel() clears active channel and unsubscribes', async () => {
    await stores.connect();
    await stores.openChannel('chan-abc');

    stores.closeChannel();

    expect(stores.activeChannelId.get()).toBeNull();
    const unsubReqs = mock.requests.filter(r => r.action === 'nostr:unsubscribe');
    expect(unsubReqs.length).toBeGreaterThanOrEqual(1);
  });

  it('sendDM() publishes via bridge', async () => {
    await stores.connect();
    mock.requests.length = 0;

    await stores.sendDM('recipient-pub', 'Hey there!');

    const publishReqs = mock.requests.filter(r => r.action === 'nostr:publish');
    expect(publishReqs).toHaveLength(1);
    const payload = publishReqs[0].payload as { kind: number; content: string; tags: string[][] };
    expect(payload.kind).toBe(14);
    expect(payload.content).toBe('Hey there!');
    expect(payload.tags).toEqual([['p', 'recipient-pub']]);
  });

  it('sendChannelMessage() publishes via bridge', async () => {
    await stores.connect();
    mock.requests.length = 0;

    await stores.sendChannelMessage('chan-1', 'Hello channel!');

    const publishReqs = mock.requests.filter(r => r.action === 'nostr:publish');
    expect(publishReqs).toHaveLength(1);
    const payload = publishReqs[0].payload as { kind: number; content: string; tags: string[][] };
    expect(payload.kind).toBe(42);
    expect(payload.content).toBe('Hello channel!');
    expect(payload.tags).toEqual([['e', 'chan-1', '', 'root']]);
  });

  it('disconnect() cleans up subscriptions and handlers', async () => {
    await stores.connect();

    stores.disconnect();

    // Should have sent unsubscribe requests for all active subs
    const unsubReqs = mock.requests.filter(r => r.action === 'nostr:unsubscribe');
    expect(unsubReqs.length).toBeGreaterThanOrEqual(3);
  });

  it('handles subscription errors gracefully', async () => {
    // Override request to fail
    (mock.bridge.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'ok', subId: 'gt-state'
    }).mockResolvedValueOnce({
      error: 'Relay unreachable'
    });

    await stores.connect();

    expect(stores.error.get()).toContain('Relay unreachable');
  });

  it('ignores events without #gt tag for GT-specific kinds', async () => {
    await stores.connect();

    // Event with kind 30316 but no 'gt' tag should be ignored
    const event = {
      id: 'no-gt-tag',
      kind: 30316,
      pubkey: 'pub1',
      created_at: 1000,
      content: JSON.stringify({ schema: 'gt/lifecycle@1', status: 'ready' }),
      tags: [['d', 'test']], // no ['gt', '1'] tag
    };

    mock.pushEvent('nostr:event', { subId: 'gt-state', event });

    expect(stores.agents.get()).toHaveLength(0);
  });
});
