/**
 * Reactive GT event stores for the iframe widget.
 *
 * These stores use the WidgetBridge to query the host for GT events
 * and maintain local state that Svelte components can subscribe to.
 */

import type { WidgetBridge } from '../bridge.js';
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
} from './types.js';
import { parseGTEvent, deduplicateReplaceable, sortByTimestamp } from './parser.js';
import {
  activityLogFilter,
  lifecycleFilter,
  convoyFilter,
  issueFilter,
  protocolFilter,
  workItemFilter,
  queueDefFilter,
} from './filters.js';

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

interface QueryResult {
  status: string;
  events?: GTNostrEvent[];
  error?: string;
}

/**
 * Query GT events via the host bridge's nostr:query action.
 */
async function queryGTEvents(
  bridge: WidgetBridge,
  relays: string[],
  filter: NostrFilter,
): Promise<GTNostrEvent[]> {
  const result = (await bridge.request('nostr:query', {
    relays,
    filter,
  })) as QueryResult;

  if (result?.error) {
    throw new Error(result.error);
  }

  return (result?.events ?? []) as GTNostrEvent[];
}

/**
 * Parse and deduplicate a batch of raw events for replaceable kinds.
 */
function parseAndDeduplicate<T>(
  rawEvents: GTNostrEvent[],
  replaceable = true,
): ParsedGTEvent<T>[] {
  const parsed = rawEvents
    .map(e => parseGTEvent<T>(e))
    .filter((e): e is ParsedGTEvent<T> => e !== null);

  if (replaceable) {
    return sortByTimestamp(deduplicateReplaceable(parsed));
  }
  return sortByTimestamp(parsed);
}

// --- Store factories ---

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
  /** Loading state. */
  loading: GTStore<boolean>;
  /** Last error. */
  error: GTStore<string | null>;

  /** Fetch all stores from relays. */
  refresh(opts?: { rig?: string; since?: number }): Promise<void>;
  /** Fetch a single store category. */
  refreshLogs(opts?: { rig?: string; since?: number; limit?: number }): Promise<void>;
  refreshAgents(opts?: { rig?: string }): Promise<void>;
  refreshConvoys(opts?: { convoyId?: string }): Promise<void>;
  refreshIssues(opts?: { rig?: string; status?: string; limit?: number }): Promise<void>;
  refreshProtocol(opts?: { since?: number; limit?: number }): Promise<void>;
  refreshWorkItems(opts?: { queue?: string; status?: string }): Promise<void>;
  refreshQueues(): Promise<void>;
}

/**
 * Create a GT store manager bound to a bridge and relay set.
 */
export function createGTStores(bridge: WidgetBridge, relays: string[]): GTStoreManager {
  const logs = new GTStore<ParsedGTEvent<LogStatusContent>[]>([]);
  const agents = new GTStore<ParsedGTEvent<LifecycleContent>[]>([]);
  const convoys = new GTStore<ParsedGTEvent<ConvoyStateContent>[]>([]);
  const issues = new GTStore<ParsedGTEvent<BeadsIssueStateContent>[]>([]);
  const protocol = new GTStore<ParsedGTEvent<ProtocolEventContent>[]>([]);
  const workItems = new GTStore<ParsedGTEvent<WorkItemContent>[]>([]);
  const queues = new GTStore<ParsedGTEvent<QueueDefContent>[]>([]);
  const loading = new GTStore<boolean>(false);
  const error = new GTStore<string | null>(null);

  async function refreshLogs(opts?: { rig?: string; since?: number; limit?: number }) {
    const raw = await queryGTEvents(bridge, relays, activityLogFilter({
      rig: opts?.rig,
      visibility: ['feed', 'both'],
      since: opts?.since,
      limit: opts?.limit ?? 100,
    }));
    logs.set(parseAndDeduplicate<LogStatusContent>(raw, false));
  }

  async function refreshAgents(opts?: { rig?: string }) {
    const raw = await queryGTEvents(bridge, relays, lifecycleFilter({ rig: opts?.rig }));
    agents.set(parseAndDeduplicate<LifecycleContent>(raw, true));
  }

  async function refreshConvoys(opts?: { convoyId?: string }) {
    const raw = await queryGTEvents(bridge, relays, convoyFilter({ convoyId: opts?.convoyId }));
    convoys.set(parseAndDeduplicate<ConvoyStateContent>(raw, true));
  }

  async function refreshIssues(opts?: { rig?: string; status?: string; limit?: number }) {
    const raw = await queryGTEvents(bridge, relays, issueFilter({
      rig: opts?.rig,
      status: opts?.status,
      limit: opts?.limit ?? 200,
    }));
    issues.set(parseAndDeduplicate<BeadsIssueStateContent>(raw, true));
  }

  async function refreshProtocol(opts?: { since?: number; limit?: number }) {
    const raw = await queryGTEvents(bridge, relays, protocolFilter({
      since: opts?.since,
      limit: opts?.limit ?? 50,
    }));
    protocol.set(parseAndDeduplicate<ProtocolEventContent>(raw, false));
  }

  async function refreshWorkItems(opts?: { queue?: string; status?: string }) {
    const raw = await queryGTEvents(bridge, relays, workItemFilter({
      queue: opts?.queue,
      status: opts?.status,
    }));
    workItems.set(parseAndDeduplicate<WorkItemContent>(raw, false));
  }

  async function refreshQueues() {
    const raw = await queryGTEvents(bridge, relays, queueDefFilter());
    queues.set(parseAndDeduplicate<QueueDefContent>(raw, true));
  }

  async function refresh(opts?: { rig?: string; since?: number }) {
    loading.set(true);
    error.set(null);
    try {
      await Promise.all([
        refreshLogs({ rig: opts?.rig, since: opts?.since }),
        refreshAgents({ rig: opts?.rig }),
        refreshConvoys(),
        refreshIssues({ rig: opts?.rig }),
        refreshProtocol({ since: opts?.since }),
        refreshWorkItems(),
        refreshQueues(),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error.set(msg);
    } finally {
      loading.set(false);
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
    loading,
    error,
    refresh,
    refreshLogs,
    refreshAgents,
    refreshConvoys,
    refreshIssues,
    refreshProtocol,
    refreshWorkItems,
    refreshQueues,
  };
}
