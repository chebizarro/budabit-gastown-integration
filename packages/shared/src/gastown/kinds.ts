/**
 * Gas Town Nostr event kind constants.
 *
 * Matches the authoritative spec in gastown/docs/design/nostr-protocol.md.
 */

// --- Reused from AI-Hub ---
export const KIND_LOG_STATUS = 30315;
export const KIND_LIFECYCLE = 30316;
export const KIND_TASK = 38383;
export const KIND_CONTROL = 38384;
export const KIND_MCP_CALL = 38385;
export const KIND_MCP_RESULT = 38386;

// --- Gas Town Additions ---
export const KIND_GT_CONVOY_STATE = 30318;
export const KIND_GT_BEADS_ISSUE_STATE = 30319;
export const KIND_GT_PROTOCOL_EVENT = 30320;
export const KIND_GT_GROUP_DEF = 30321;
export const KIND_GT_QUEUE_DEF = 30322;
export const KIND_GT_CHANNEL_DEF = 30323;
export const KIND_GT_WORK_ITEM = 30325;

// --- Standard Nostr Kinds (reused as-is) ---
export const KIND_PROFILE = 0;
export const KIND_CHAT_MESSAGE = 9;
export const KIND_DM = 14;
export const KIND_FILE_DM = 15;
export const KIND_CHANNEL_CREATE = 40;
export const KIND_CHANNEL_META = 41;
export const KIND_CHANNEL_MESSAGE = 42;
export const KIND_GIFT_WRAP = 1059;
export const KIND_RELAY_LIST = 10002;
export const KIND_DM_RELAY_PREFS = 10050;

/** All GT-specific event kinds for subscription filters. */
export const GT_STATE_KINDS = [
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_CONVOY_STATE,
  KIND_GT_BEADS_ISSUE_STATE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_GROUP_DEF,
  KIND_GT_QUEUE_DEF,
  KIND_GT_CHANNEL_DEF,
  KIND_GT_WORK_ITEM,
] as const;

/** GT protocol version tag value. */
export const GT_PROTOCOL_VERSION = '1';
