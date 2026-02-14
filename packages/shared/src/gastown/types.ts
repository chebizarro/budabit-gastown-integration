/**
 * Gas Town Nostr event payload types.
 *
 * Mirrors the JSON content schemas from gastown/docs/design/nostr-protocol.md.
 */

// --- Agent Lifecycle (kind 30316) ---

export type AgentStatus = 'ready' | 'busy' | 'retiring' | 'dead';
export type AgentRole = 'mayor' | 'deacon' | 'witness' | 'refinery' | 'crew' | 'polecat' | 'dog';

export interface LifecycleContent {
  schema: string;
  status: AgentStatus;
  role: AgentRole;
  rig: string;
  instance: string;
  cwd?: string;
  started_at?: string;
  last_heartbeat?: string;
  current_issue?: string;
  model?: string;
}

// --- Activity Log (kind 30315) ---

export type LogVisibility = 'audit' | 'feed' | 'both';

export type LogEventType =
  | 'sling' | 'hook' | 'unhook' | 'handoff' | 'done' | 'mail'
  | 'spawn' | 'kill' | 'nudge' | 'boot' | 'halt'
  | 'session_start' | 'session_end' | 'session_death' | 'mass_death'
  | 'patrol_started' | 'polecat_checked' | 'polecat_nudged'
  | 'escalation_sent' | 'escalation_acked' | 'escalation_closed'
  | 'patrol_complete'
  | 'merge_started' | 'merged' | 'merge_failed' | 'merge_skipped';

export interface LogStatusContent {
  schema: string;
  type: LogEventType;
  source: string;
  payload: Record<string, unknown>;
}

// --- Convoy State (kind 30318) ---

export type ConvoyStatus = 'open' | 'landed' | 'cancelled';

export interface ConvoyTrackedIssue {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  rig?: string;
}

export interface ConvoyStateContent {
  schema: string;
  id: string;
  title: string;
  status: ConvoyStatus;
  created_at: string;
  created_by: string;
  tracked_issues: ConvoyTrackedIssue[];
  summary: {
    total: number;
    open: number;
    closed: number;
    blocked: number;
  };
  active_workers: string[];
  landed: boolean;
  landed_at: string | null;
  last_updated: string;
}

// --- Beads Issue State (kind 30319) ---

export type IssueStatus = 'open' | 'in_progress' | 'closed' | 'blocked';
export type IssueType = 'issue' | 'task' | 'bug' | 'epic' | 'convoy' | 'message';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export interface BlobReference {
  type: string;
  url: string;
  sha256: string;
  size: number;
}

export interface BeadsIssueStateContent {
  schema: string;
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  type: IssueType;
  created_at: string;
  created_by: string;
  updated_at: string;
  assignee?: string;
  labels: string[];
  rig: string;
  dependencies: {
    blocked_by: string[];
    blocks: string[];
    children: string[];
    parent: string | null;
  };
  branch?: string;
  molecule?: {
    id: string;
    status: string;
    wisp_count: number;
    wisps_completed: number;
  };
  blobs?: BlobReference[];
  source?: {
    repo?: string;
    nip34_event?: string | null;
  };
}

// --- Protocol Event (kind 30320) ---

export type ProtocolMsgType =
  | 'POLECAT_DONE' | 'MERGE_READY' | 'MERGED' | 'MERGE_FAILED'
  | 'REWORK_REQUEST' | 'HELP';

export interface ProtocolEventContent {
  schema: string;
  msg_type: ProtocolMsgType;
  body: Record<string, unknown>;
}

// --- Work Item (kind 30325) ---

export type WorkItemStatus = 'available' | 'claimed' | 'completed' | 'failed';

export interface WorkItemContent {
  schema: string;
  queue: string;
  subject: string;
  body: Record<string, unknown>;
  claimed_by: string | null;
  claimed_at: string | null;
}

// --- Group Definition (kind 30321) ---

export interface GroupDefContent {
  schema: string;
  name: string;
  members: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// --- Queue Definition (kind 30322) ---

export type QueueStatus = 'active' | 'paused' | 'closed';

export interface QueueDefContent {
  schema: string;
  name: string;
  status: QueueStatus;
  scope: 'town' | 'rig';
  rig: string;
  max_concurrency: number;
  processing_order: string;
  counts: {
    available: number;
    processing: number;
    completed: number;
    failed: number;
  };
  created_at: string;
  updated_at: string;
}

// --- Channel Definition (kind 30323) ---

export interface ChannelDefContent {
  schema: string;
  name: string;
  status: 'active' | 'closed';
  retention: {
    count: number;
    hours: number;
  };
  subscribers: string[];
  created_by: string;
  created_at: string;
}

// --- Parsed event wrappers (for store use) ---

export interface GTNostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
  sig?: string;
}

export interface ParsedGTEvent<T = unknown> {
  raw: GTNostrEvent;
  kind: number;
  /** The `d` tag value for replaceable events. */
  dTag?: string;
  /** Parsed JSON content. */
  data: T;
  /** Extracted tag values for quick access. */
  tags: {
    gt?: string;
    rig?: string;
    role?: string;
    actor?: string;
    type?: string;
    status?: string;
    visibility?: string;
    issueId?: string;
    convoyId?: string;
    sessionId?: string;
    branch?: string;
    mr?: string;
    queue?: string;
    msgType?: string;
    from?: string;
    to?: string;
    priority?: string;
  };
  /** ISO timestamp derived from created_at. */
  timestamp: string;
}
