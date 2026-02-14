/**
 * Parse raw Nostr events into typed Gas Town event wrappers.
 */

import type { GTNostrEvent, ParsedGTEvent } from './types.js';

function getTagValue(tags: string[][], name: string): string | undefined {
  return tags.find(t => t[0] === name)?.[1];
}

/**
 * Parse a raw Nostr event into a typed GT event wrapper.
 * Returns null if the event is not a valid GT event (missing #gt tag).
 */
export function parseGTEvent<T = unknown>(raw: GTNostrEvent): ParsedGTEvent<T> | null {
  const gtTag = getTagValue(raw.tags, 'gt');
  if (!gtTag) return null;

  let data: T;
  try {
    data = JSON.parse(raw.content) as T;
  } catch {
    data = raw.content as unknown as T;
  }

  return {
    raw,
    kind: raw.kind,
    dTag: getTagValue(raw.tags, 'd'),
    data,
    tags: {
      gt: gtTag,
      rig: getTagValue(raw.tags, 'rig'),
      role: getTagValue(raw.tags, 'role'),
      actor: getTagValue(raw.tags, 'actor'),
      type: getTagValue(raw.tags, 'type'),
      status: getTagValue(raw.tags, 'status'),
      visibility: getTagValue(raw.tags, 'visibility'),
      issueId: getTagValue(raw.tags, 't'),
      convoyId: getTagValue(raw.tags, 'convoy'),
      sessionId: getTagValue(raw.tags, 'session'),
      branch: getTagValue(raw.tags, 'branch'),
      mr: getTagValue(raw.tags, 'mr'),
      queue: getTagValue(raw.tags, 'queue'),
      msgType: getTagValue(raw.tags, 'msg_type'),
      from: getTagValue(raw.tags, 'from'),
      to: getTagValue(raw.tags, 'to'),
      priority: getTagValue(raw.tags, 'priority'),
    },
    timestamp: new Date(raw.created_at * 1000).toISOString(),
  };
}

/**
 * Deduplicate replaceable events by `d` tag, keeping the latest.
 */
export function deduplicateReplaceable<T>(events: ParsedGTEvent<T>[]): ParsedGTEvent<T>[] {
  const map = new Map<string, ParsedGTEvent<T>>();
  for (const e of events) {
    const key = `${e.kind}:${e.dTag ?? e.raw.id}`;
    const existing = map.get(key);
    if (!existing || e.raw.created_at > existing.raw.created_at) {
      map.set(key, e);
    }
  }
  return Array.from(map.values());
}

/**
 * Sort events by created_at descending (newest first).
 */
export function sortByTimestamp<T>(events: ParsedGTEvent<T>[]): ParsedGTEvent<T>[] {
  return [...events].sort((a, b) => b.raw.created_at - a.raw.created_at);
}
