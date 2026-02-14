/**
 * Nostr filter builders for Gas Town event subscriptions.
 *
 * All filters include `#gt: ["1"]` to scope to GT protocol events.
 */

import {
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_CONVOY_STATE,
  KIND_GT_BEADS_ISSUE_STATE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_GROUP_DEF,
  KIND_GT_QUEUE_DEF,
  KIND_GT_CHANNEL_DEF,
  KIND_GT_WORK_ITEM,
  GT_PROTOCOL_VERSION,
} from './kinds.js';

export interface NostrFilter {
  kinds?: number[];
  authors?: string[];
  '#gt'?: string[];
  '#rig'?: string[];
  '#role'?: string[];
  '#d'?: string[];
  '#t'?: string[];
  '#status'?: string[];
  '#type'?: string[];
  '#visibility'?: string[];
  '#msg_type'?: string[];
  '#to'?: string[];
  '#from'?: string[];
  '#queue'?: string[];
  '#convoy'?: string[];
  '#session'?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: unknown;
}

const gtBase = (): Pick<NostrFilter, '#gt'> => ({ '#gt': [GT_PROTOCOL_VERSION] });

/** Activity log events (kind 30315). */
export function activityLogFilter(opts?: {
  rig?: string;
  visibility?: ('feed' | 'both')[];
  since?: number;
  limit?: number;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_LOG_STATUS],
  };
  if (opts?.rig) f['#rig'] = [opts.rig];
  if (opts?.visibility) f['#visibility'] = opts.visibility;
  if (opts?.since) f.since = opts.since;
  if (opts?.limit) f.limit = opts.limit;
  return f;
}

/** Agent lifecycle events (kind 30316). */
export function lifecycleFilter(opts?: {
  rig?: string;
  role?: string;
  authors?: string[];
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_LIFECYCLE],
  };
  if (opts?.rig) f['#rig'] = [opts.rig];
  if (opts?.role) f['#role'] = [opts.role];
  if (opts?.authors) f.authors = opts.authors;
  return f;
}

/** Convoy state events (kind 30318). */
export function convoyFilter(opts?: {
  convoyId?: string;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_CONVOY_STATE],
  };
  if (opts?.convoyId) f['#d'] = [opts.convoyId];
  return f;
}

/** Beads issue state events (kind 30319). */
export function issueFilter(opts?: {
  issueId?: string;
  rig?: string;
  status?: string;
  type?: string;
  limit?: number;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_BEADS_ISSUE_STATE],
  };
  if (opts?.issueId) f['#d'] = [opts.issueId];
  if (opts?.rig) f['#rig'] = [opts.rig];
  if (opts?.status) f['#status'] = [opts.status];
  if (opts?.type) f['#type'] = [opts.type];
  if (opts?.limit) f.limit = opts.limit;
  return f;
}

/** Protocol events (kind 30320). */
export function protocolFilter(opts?: {
  msgType?: string;
  to?: string;
  from?: string;
  since?: number;
  limit?: number;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_PROTOCOL_EVENT],
  };
  if (opts?.msgType) f['#msg_type'] = [opts.msgType];
  if (opts?.to) f['#to'] = [opts.to];
  if (opts?.from) f['#from'] = [opts.from];
  if (opts?.since) f.since = opts.since;
  if (opts?.limit) f.limit = opts.limit;
  return f;
}

/** Work item events (kind 30325). */
export function workItemFilter(opts?: {
  queue?: string;
  status?: string;
  limit?: number;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_WORK_ITEM],
  };
  if (opts?.queue) f['#queue'] = [opts.queue];
  if (opts?.status) f['#status'] = [opts.status];
  if (opts?.limit) f.limit = opts.limit;
  return f;
}

/** Group definition events (kind 30321). */
export function groupDefFilter(opts?: { name?: string }): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_GROUP_DEF],
  };
  if (opts?.name) f['#d'] = [opts.name];
  return f;
}

/** Queue definition events (kind 30322). */
export function queueDefFilter(opts?: { name?: string }): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_QUEUE_DEF],
  };
  if (opts?.name) f['#d'] = [opts.name];
  return f;
}

/** Channel definition events (kind 30323). */
export function channelDefFilter(opts?: { name?: string }): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [KIND_GT_CHANNEL_DEF],
  };
  if (opts?.name) f['#d'] = [opts.name];
  return f;
}

/** Combined filter for all GT replaceable state (lifecycle + convoy + issues + definitions). */
export function allStateFilter(opts?: {
  rig?: string;
  since?: number;
}): NostrFilter {
  const f: NostrFilter = {
    ...gtBase(),
    kinds: [
      KIND_LIFECYCLE,
      KIND_GT_CONVOY_STATE,
      KIND_GT_BEADS_ISSUE_STATE,
      KIND_GT_GROUP_DEF,
      KIND_GT_QUEUE_DEF,
      KIND_GT_CHANNEL_DEF,
    ],
  };
  if (opts?.rig) f['#rig'] = [opts.rig];
  if (opts?.since) f.since = opts.since;
  return f;
}
