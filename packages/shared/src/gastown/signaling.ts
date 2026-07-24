import { createEvent, validateEvent as validateSdkEvent, type UnsignedEvent } from 'budabit-sdk';
import {
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_WORK_ITEM,
  GT_PROTOCOL_VERSION,
  GT_STATE_KINDS,
} from './kinds.js';
import type { AgentRole, LogEventType, ProtocolMsgType } from './types.js';

/**
 * Signaling helpers for creating Gas Town Nostr events.
 *
 * All GT events include the `["gt", "1"]` protocol version tag.
 */

/**
 * Build the base GT tags included on every Gas Town event.
 */
function gtBaseTags(rig: string, role: string, actor: string): string[][] {
  return [
    ['gt', GT_PROTOCOL_VERSION],
    ['rig', rig],
    ['role', role],
    ['actor', actor],
  ];
}

/**
 * Create a Gas Town activity log event (kind 30315).
 */
export function createLogStatusEvent(
  rig: string,
  role: AgentRole,
  actor: string,
  eventType: LogEventType,
  visibility: 'audit' | 'feed' | 'both',
  payload: Record<string, unknown>,
  correlations?: {
    issueId?: string;
    convoyId?: string;
    sessionId?: string;
    branch?: string;
    mr?: string;
  },
): UnsignedEvent {
  const tags = [
    ...gtBaseTags(rig, role, actor),
    ['type', eventType],
    ['visibility', visibility],
  ];

  if (correlations?.issueId) tags.push(['t', correlations.issueId]);
  if (correlations?.convoyId) tags.push(['convoy', correlations.convoyId]);
  if (correlations?.sessionId) tags.push(['session', correlations.sessionId]);
  if (correlations?.branch) tags.push(['branch', correlations.branch]);
  if (correlations?.mr) tags.push(['mr', correlations.mr]);

  const content = JSON.stringify({
    schema: 'gt/log@1',
    type: eventType,
    source: 'gt',
    payload,
  });

  return createEvent(KIND_LOG_STATUS, content, tags);
}

/**
 * Create a Gas Town agent lifecycle event (kind 30316).
 */
export function createLifecycleEvent(
  rig: string,
  role: AgentRole,
  actor: string,
  instance: string,
  status: 'ready' | 'busy' | 'retiring' | 'dead',
  opts?: {
    cwd?: string;
    currentIssue?: string;
    model?: string;
  },
): UnsignedEvent {
  const dTag = `${rig}/${role}/${instance}`;
  const tags = [
    ...gtBaseTags(rig, role, actor),
    ['d', dTag],
    ['instance', instance],
    ['status', status],
  ];

  if (opts?.currentIssue) tags.push(['t', opts.currentIssue]);
  if (opts?.model) tags.push(['model', opts.model]);

  const content = JSON.stringify({
    schema: 'gt/lifecycle@1',
    status,
    role,
    rig,
    instance,
    cwd: opts?.cwd,
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
    current_issue: opts?.currentIssue,
    model: opts?.model,
  });

  return createEvent(KIND_LIFECYCLE, content, tags);
}

/**
 * Create a Gas Town protocol event (kind 30320).
 */
export function createProtocolEvent(
  rig: string,
  role: AgentRole,
  actor: string,
  msgType: ProtocolMsgType,
  to: string,
  body: Record<string, unknown>,
  correlations?: {
    issueId?: string;
    branch?: string;
    mr?: string;
    convoyId?: string;
  },
): UnsignedEvent {
  const tags = [
    ...gtBaseTags(rig, role, actor),
    ['msg_type', msgType],
    ['from', actor],
    ['to', to],
  ];

  if (correlations?.issueId) tags.push(['t', correlations.issueId]);
  if (correlations?.branch) tags.push(['branch', correlations.branch]);
  if (correlations?.mr) tags.push(['mr', correlations.mr]);
  if (correlations?.convoyId) tags.push(['convoy', correlations.convoyId]);

  const content = JSON.stringify({
    schema: 'gt/protocol@1',
    msg_type: msgType,
    body,
  });

  return createEvent(KIND_GT_PROTOCOL_EVENT, content, tags);
}

/**
 * Create a Gas Town work item event (kind 30325).
 */
export function createWorkItemEvent(
  rig: string,
  role: AgentRole,
  actor: string,
  queue: string,
  subject: string,
  body: Record<string, unknown>,
  opts?: {
    issueId?: string;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
  },
): UnsignedEvent {
  const tags = [
    ...gtBaseTags(rig, role, actor),
    ['queue', queue],
    ['from', actor],
    ['status', 'available'],
  ];

  if (opts?.issueId) tags.push(['t', opts.issueId]);
  if (opts?.priority) tags.push(['priority', opts.priority]);

  const content = JSON.stringify({
    schema: 'gt/work_item@1',
    queue,
    subject,
    body,
    claimed_by: null,
    claimed_at: null,
  });

  return createEvent(KIND_GT_WORK_ITEM, content, tags);
}

/**
 * Validate a Gas Town event before publishing.
 */
export function validateEvent(event: UnsignedEvent, allowedKinds?: number[]): boolean {
  return validateSdkEvent(event, allowedKinds ?? [...GT_STATE_KINDS, 1]);
}
