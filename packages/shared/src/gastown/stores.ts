/**
 * Reactive GT event stores backed by real-time Nostr subscriptions.
 *
 * No polling. No timeouts. Events arrive via the host bridge's
 * `nostr:subscribe` action, which pushes `nostr:subscription:event`
 * messages as they arrive from relay subscriptions.
 */

import type { WidgetBridge } from 'budabit-sdk';
import type { NostrFilter } from './filters.js';
import type { GTNostrEvent, ParsedGTEvent } from './types.js';
import type {
  LifecycleContent,
  LogStatusContent,
  ConvoyStateContent,
  BeadsIssueStateContent,
  ProtocolEventContent,
  WorkItemContent,
  QueueDefContent,
  GroupDefContent,
  ChannelDefContent,
  DirectMessage,
  ChannelMessage,
  ChannelMetadata,
} from './types.js';
import { parseGTEvent, deduplicateReplaceable } from './parser.js';
import {
  activityLogFilter,
  protocolFilter,
  workItemFilter,
  allStateFilter,
  dmGiftWrapFilter,
  channelMessageFilter,
  allChannelMetaFilter,
} from './filters.js';
import {
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_CONVOY_STATE,
  KIND_GT_BEADS_ISSUE_STATE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_WORK_ITEM,
  KIND_GT_QUEUE_DEF,
  KIND_GT_GROUP_DEF,
  KIND_GT_CHANNEL_DEF,
  KIND_DM,
  KIND_CHANNEL_CREATE,
  KIND_CHANNEL_META,
  KIND_CHANNEL_MESSAGE,
} from './kinds.js';

export type StoreListener<T> = (value: T) => void;

/**
 * Minimal reactive store compatible with Svelte's store contract.
 */
export class GTStore<T> {
  private value: T;
  private listeners = new Set<StoreListener<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): void {
    this.value = newValue;
    for (const listener of this.listeners) {
      listener(newValue);
    }
  }

  subscribe(listener: StoreListener<T>): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }
}

// --- Subscription-based store manager ---

export interface GTStoreManager {
  /** Activity log entries (kind 30315). */
  logs: GTStore<ParsedGTEvent<LogStatusContent>[]>;
  /** Agent lifecycle states (kind 30316). */
  agents: GTStore<ParsedGTEvent<LifecycleContent>[]>;
  /** Convoy states (kind 30318). */
  convoys: GTStore<ParsedGTEvent<ConvoyStateContent>[]>;
  /** Issue mirrors (kind 30319). */
  issues: GTStore<ParsedGTEvent<BeadsIssueStateContent>[]>;
  /** Protocol events (kind 30320). */
  protocol: GTStore<ParsedGTEvent<ProtocolEventContent>[]>;
  /** Work items (kind 30325). */
  workItems: GTStore<ParsedGTEvent<WorkItemContent>[]>;
  /** Queue definitions (kind 30322). */
  queues: GTStore<ParsedGTEvent<QueueDefContent>[]>;
  /** Group definitions (kind 30321). */
  groups: GTStore<ParsedGTEvent<GroupDefContent>[]>;
  /** Channel definitions (kind 30323). */
  channels: GTStore<ParsedGTEvent<ChannelDefContent>[]>;
  /** NIP-17 direct messages (kind 14, unwrapped from gift wraps). */
  directMessages: GTStore<DirectMessage[]>;
  /** NIP-28 channel metadata (kind 40/41). */
  channelMeta: GTStore<ChannelMetadata[]>;
  /** NIP-28 channel messages (kind 42), keyed by channel ID. */
  channelMessages: GTStore<Map<string, ChannelMessage[]>>;
  /** Currently selected channel ID for message subscription. */
  activeChannelId: GTStore<string | null>;
  /** Whether initial EOSE has been received. */
  ready: GTStore<boolean>;
  /** Last error. */
  error: GTStore<string | null>;

  /** Open relay subscriptions. Call once on mount. */
  connect(opts?: { rig?: string; userPubkey?: string }): Promise<void>;
  /** Close all relay subscriptions. Call on unmount. */
  disconnect(): void;
  /** Subscribe to messages for a specific NIP-28 channel. */
  openChannel(channelId: string): Promise<void>;
  /** Close the channel message subscription. */
  closeChannel(): void;
  /** Send a DM via NIP-17 (publishes through bridge). */
  sendDM(recipientPubkey: string, content: string): Promise<void>;
  /** Send a message to a NIP-28 channel (publishes through bridge). */
  sendChannelMessage(channelId: string, content: string): Promise<void>;
}

/** Max append-only events to retain per store (prevents unbounded growth). */
const MAX_LOG_EVENTS = 500;
const MAX_PROTOCOL_EVENTS = 200;
const MAX_WORK_ITEMS = 500;
const MAX_DM_MESSAGES = 500;
const MAX_CHANNEL_MESSAGES = 200;

/** Parse a raw event into a DirectMessage. */
function parseDM(raw: GTNostrEvent): DirectMessage | null {
  if (raw.kind !== KIND_DM) return null;
  const pTag = raw.tags.find(t => t[0] === 'p');
  const rootTag = raw.tags.find(t => t[0] === 'e' && t[3] === 'root');
  const replyTag = raw.tags.find(t => t[0] === 'e' && t[3] === 'reply');
  const subjectTag = raw.tags.find(t => t[0] === 'subject');

  return {
    id: raw.id,
    pubkey: raw.pubkey,
    content: raw.content,
    created_at: raw.created_at,
    recipientPubkey: pTag?.[1],
    rootId: rootTag?.[1],
    replyToId: replyTag?.[1],
    subject: subjectTag?.[1],
  };
}

/** Parse a raw event into a ChannelMessage. */
function parseChannelMessage(raw: GTNostrEvent): ChannelMessage | null {
  if (raw.kind !== KIND_CHANNEL_MESSAGE) return null;
  // Root 'e' tag points to the channel creation event
  const rootTag = raw.tags.find(t => t[0] === 'e' && (t[3] === 'root' || !t[3]));
  if (!rootTag) return null;
  const channelId = rootTag[1];
  if (!channelId) return null;
  const replyTag = raw.tags.find(t => t[0] === 'e' && t[3] === 'reply');

  return {
    id: raw.id,
    pubkey: raw.pubkey,
    content: raw.content,
    created_at: raw.created_at,
    channelId,
    replyToId: replyTag?.[1],
  };
}

/** Parse a kind 40 or 41 event into ChannelMetadata. */
function parseChannelMeta(raw: GTNostrEvent): ChannelMetadata | null {
  if (raw.kind !== KIND_CHANNEL_CREATE && raw.kind !== KIND_CHANNEL_META) return null;

  let meta: { name?: string; about?: string; picture?: string };
  try {
    meta = JSON.parse(raw.content) as { name?: string; about?: string; picture?: string };
  } catch {
    return null;
  }

  if (raw.kind === KIND_CHANNEL_CREATE) {
    return {
      id: raw.id,
      name: meta.name ?? 'Unnamed Channel',
      about: meta.about,
      picture: meta.picture,
      creationEventId: raw.id,
      updatedAt: raw.created_at,
    };
  }

  // Kind 41 — metadata update; the 'e' tag references the creation event
  const eTag = raw.tags.find(t => t[0] === 'e');
  const creationEventId = eTag?.[1];
  if (!creationEventId) return null;

  return {
    id: creationEventId,
    name: meta.name ?? 'Unnamed Channel',
    about: meta.about,
    picture: meta.picture,
    creationEventId,
    updatedAt: raw.created_at,
  };
}

/**
 * Create a subscription-based GT store manager.
 *
 * Instead of polling, this opens persistent relay subscriptions via the host
 * bridge. Events stream in real-time via `nostr:subscription:event` push messages.
 */
export function createGTStores(bridge: WidgetBridge, relays: string[]): GTStoreManager {
  const logs = new GTStore<ParsedGTEvent<LogStatusContent>[]>([]);
  const agents = new GTStore<ParsedGTEvent<LifecycleContent>[]>([]);
  const convoys = new GTStore<ParsedGTEvent<ConvoyStateContent>[]>([]);
  const issues = new GTStore<ParsedGTEvent<BeadsIssueStateContent>[]>([]);
  const protocol = new GTStore<ParsedGTEvent<ProtocolEventContent>[]>([]);
  const workItems = new GTStore<ParsedGTEvent<WorkItemContent>[]>([]);
  const queues = new GTStore<ParsedGTEvent<QueueDefContent>[]>([]);
  const groups = new GTStore<ParsedGTEvent<GroupDefContent>[]>([]);
  const channels = new GTStore<ParsedGTEvent<ChannelDefContent>[]>([]);
  const directMessages = new GTStore<DirectMessage[]>([]);
  const channelMeta = new GTStore<ChannelMetadata[]>([]);
  const channelMessages = new GTStore<Map<string, ChannelMessage[]>>(new Map());
  const activeChannelId = new GTStore<string | null>(null);
  const ready = new GTStore<boolean>(false);
  const error = new GTStore<string | null>(null);

  const activeSubscriptions = new Map<string, () => Promise<unknown>>();
  const unsubHandlers: (() => void)[] = [];
  let channelSubIds: string[] = [];
  let readyTimeout: ReturnType<typeof setTimeout> | null = null;

  function ingestEvent(raw: GTNostrEvent): void {
    // --- NIP-17 DMs (kind 14) ---
    if (raw.kind === KIND_DM) {
      const dm = parseDM(raw);
      if (dm) {
        directMessages.update(prev => {
          // Deduplicate by ID
          if (prev.some(m => m.id === dm.id)) return prev;
          const next = [...prev, dm].sort((a, b) => a.created_at - b.created_at);
          return next.length > MAX_DM_MESSAGES ? next.slice(-MAX_DM_MESSAGES) : next;
        });
      }
      return;
    }

    // --- NIP-28 Channel metadata (kind 40/41) ---
    if (raw.kind === KIND_CHANNEL_CREATE || raw.kind === KIND_CHANNEL_META) {
      const meta = parseChannelMeta(raw);
      if (meta) {
        channelMeta.update(prev => {
          const existing = prev.findIndex(m => m.creationEventId === meta.creationEventId);
          if (existing >= 0) {
            // Keep newer metadata
            if ((meta.updatedAt ?? 0) > (prev[existing]?.updatedAt ?? 0)) {
              const next = [...prev];
              next[existing] = meta;
              return next;
            }
            return prev;
          }
          return [...prev, meta];
        });
      }
      return;
    }

    // --- NIP-28 Channel messages (kind 42) ---
    if (raw.kind === KIND_CHANNEL_MESSAGE) {
      const msg = parseChannelMessage(raw);
      if (msg) {
        channelMessages.update(prev => {
          const existing = prev.get(msg.channelId) ?? [];
          if (existing.some(m => m.id === msg.id)) return prev;
          const updated = [...existing, msg].sort((a, b) => a.created_at - b.created_at);
          const capped = updated.length > MAX_CHANNEL_MESSAGES
            ? updated.slice(-MAX_CHANNEL_MESSAGES)
            : updated;
          const next = new Map(prev);
          next.set(msg.channelId, capped);
          return next;
        });
      }
      return;
    }

    // --- GT protocol events (require #gt tag) ---
    const parsed = parseGTEvent(raw);
    if (!parsed) return;

    switch (parsed.kind) {
      case KIND_LOG_STATUS: {
        const typed = parsed as ParsedGTEvent<LogStatusContent>;
        logs.update(prev => {
          const next = [typed, ...prev];
          return next.length > MAX_LOG_EVENTS ? next.slice(0, MAX_LOG_EVENTS) : next;
        });
        break;
      }
      case KIND_LIFECYCLE: {
        const typed = parsed as ParsedGTEvent<LifecycleContent>;
        agents.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
      case KIND_GT_CONVOY_STATE: {
        const typed = parsed as ParsedGTEvent<ConvoyStateContent>;
        convoys.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
      case KIND_GT_BEADS_ISSUE_STATE: {
        const typed = parsed as ParsedGTEvent<BeadsIssueStateContent>;
        issues.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
      case KIND_GT_PROTOCOL_EVENT: {
        const typed = parsed as ParsedGTEvent<ProtocolEventContent>;
        protocol.update(prev => {
          const next = [typed, ...prev];
          return next.length > MAX_PROTOCOL_EVENTS ? next.slice(0, MAX_PROTOCOL_EVENTS) : next;
        });
        break;
      }
      case KIND_GT_WORK_ITEM: {
        const typed = parsed as ParsedGTEvent<WorkItemContent>;
        workItems.update(prev => {
          const next = [typed, ...prev];
          return next.length > MAX_WORK_ITEMS ? next.slice(0, MAX_WORK_ITEMS) : next;
        });
        break;
      }
      case KIND_GT_QUEUE_DEF: {
        const typed = parsed as ParsedGTEvent<QueueDefContent>;
        queues.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
      case KIND_GT_GROUP_DEF: {
        const typed = parsed as ParsedGTEvent<GroupDefContent>;
        groups.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
      case KIND_GT_CHANNEL_DEF: {
        const typed = parsed as ParsedGTEvent<ChannelDefContent>;
        channels.update(prev => deduplicateReplaceable([typed, ...prev]));
        break;
      }
    }
  }

  async function openSubscription(
    subLabel: string,
    filters: NostrFilter[],
  ): Promise<string[]> {
    const openedIds: string[] = [];

    for (const [index, filter] of filters.entries()) {
      const clientId = filters.length === 1 ? subLabel : `${subLabel}-${index + 1}`;

      try {
        const handle = await bridge.subscribe({
          subscriptionId: clientId,
          relays,
          filter: filter as Record<string, unknown>,
        });

        // Always track the host-assigned ID returned by nostr:subscribe.
        activeSubscriptions.set(handle.subscriptionId, handle.unsubscribe);
        openedIds.push(handle.subscriptionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error.set(`Subscription ${clientId} failed: ${message}`);
      }
    }

    return openedIds;
  }

  async function closeSubscription(subscriptionId: string): Promise<void> {
    const unsubscribe = activeSubscriptions.get(subscriptionId);
    if (!unsubscribe) return;

    activeSubscriptions.delete(subscriptionId);
    try {
      await unsubscribe();
    } catch {
      // Best-effort cleanup
    }
  }

  async function connect(opts?: { rig?: string; userPubkey?: string }) {
    error.set(null);

    // Listen for pushed events from the host
    const offEvent = bridge.onEvent('nostr:subscription:event', (push) => {
      if (activeSubscriptions.has(push.subscriptionId)) {
        ingestEvent(push.event as GTNostrEvent);
      }
    });
    unsubHandlers.push(offEvent);

    // Track successful subscriptions for accurate EOSE counting
    const successfulSubs: string[] = [];
    let eoseCount = 0;

    // Listen for EOSE to know when initial state is loaded
    const offEose = bridge.onEvent('nostr:eose', () => {
      eoseCount++;
      if (eoseCount >= successfulSubs.length && successfulSubs.length > 0) {
        if (readyTimeout) clearTimeout(readyTimeout);
        ready.set(true);
      }
    });
    unsubHandlers.push(offEose);

    // Set a fallback timeout to mark ready even if EOSE doesn't arrive
    readyTimeout = setTimeout(() => {
      if (!ready.get()) {
        ready.set(true);
      }
    }, 10000); // 10 second timeout

    // 1. All replaceable GT state (lifecycle, convoys, issues, defs)
    const stateSubs = await openSubscription('gt-state', [
      allStateFilter({ rig: opts?.rig }),
    ]);
    successfulSubs.push(...stateSubs);

    // 2. Append-only GT events (logs, protocol, work items) — limit initial backfill
    const since = Math.floor(Date.now() / 1000) - 86400; // last 24h
    const streamSubs = await openSubscription('gt-stream', [
      activityLogFilter({ rig: opts?.rig, visibility: ['feed', 'both'], since }),
      protocolFilter({ since }),
      workItemFilter({}),
    ]);
    successfulSubs.push(...streamSubs);

    // 3. NIP-28 channel metadata (kind 40 + 41)
    const channelsSubs = await openSubscription('gt-channels', [
      allChannelMetaFilter(),
    ]);
    successfulSubs.push(...channelsSubs);

    // 4. NIP-17 DMs (gift-wrapped, addressed to our pubkey)
    if (opts?.userPubkey) {
      const dmSubs = await openSubscription('gt-dms', [
        dmGiftWrapFilter({ recipientPubkey: opts.userPubkey, since }),
      ]);
      successfulSubs.push(...dmSubs);
    }

    // If no subscriptions succeeded, set error and mark ready anyway
    if (successfulSubs.length === 0) {
      error.set('All subscriptions failed');
      ready.set(true);
      if (readyTimeout) clearTimeout(readyTimeout);
    }
  }

  async function openChannel(channelId: string) {
    // Close any existing channel subscription
    closeChannel();

    activeChannelId.set(channelId);

    const since = Math.floor(Date.now() / 1000) - 86400 * 7; // last 7 days
    channelSubIds = await openSubscription(`gt-chan-${channelId.slice(0, 8)}`, [
      channelMessageFilter({ channelId, since, limit: MAX_CHANNEL_MESSAGES }),
    ]);
  }

  function closeChannel() {
    for (const subscriptionId of channelSubIds) {
      void closeSubscription(subscriptionId);
    }
    channelSubIds = [];
    activeChannelId.set(null);
  }

  async function sendDM(recipientPubkey: string, content: string) {
    const event = {
      kind: KIND_DM,
      content,
      tags: [['p', recipientPubkey]],
      created_at: Math.floor(Date.now() / 1000),
    };

    const result = await bridge.request('nostr:publish', event);
    if (result && typeof result === 'object' && 'error' in result) {
      throw new Error((result as { error: string }).error);
    }
  }

  async function sendChannelMessage(channelId: string, content: string) {
    const event = {
      kind: KIND_CHANNEL_MESSAGE,
      content,
      tags: [['e', channelId, '', 'root']],
      created_at: Math.floor(Date.now() / 1000),
    };

    const result = await bridge.request('nostr:publish', event);
    if (result && typeof result === 'object' && 'error' in result) {
      throw new Error((result as { error: string }).error);
    }
  }

  function disconnect() {
    // Clear ready timeout if active
    if (readyTimeout) {
      clearTimeout(readyTimeout);
      readyTimeout = null;
    }

    // Close channel sub if active
    closeChannel();

    // Unsubscribe from bridge events
    for (const unsub of unsubHandlers) {
      unsub();
    }
    unsubHandlers.length = 0;

    // Close relay subscriptions through their bridge handles so the bridge's
    // own subscription registry stays in sync.
    for (const subscriptionId of [...activeSubscriptions.keys()]) {
      void closeSubscription(subscriptionId);
    }
  }

  return {
    logs,
    agents,
    convoys,
    issues,
    protocol,
    workItems,
    queues,
    groups,
    channels,
    directMessages,
    channelMeta,
    channelMessages,
    activeChannelId,
    ready,
    error,
    connect,
    disconnect,
    openChannel,
    closeChannel,
    sendDM,
    sendChannelMessage,
  };
}
