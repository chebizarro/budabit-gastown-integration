/**
 * Default manifest values for the Gas Town Flotilla extension.
 */

import type { SmartWidgetEventOptions } from 'budabit-sdk/manifest';
import type { WidgetPermission } from 'budabit-sdk';
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
  KIND_TASK,
  KIND_CONTROL,
  KIND_MCP_CALL,
  KIND_MCP_RESULT,
  KIND_DM,
  KIND_CHANNEL_CREATE,
  KIND_CHANNEL_META,
  KIND_CHANNEL_MESSAGE,
  KIND_GIFT_WRAP,
} from '@flotilla/ext-shared';

export const GT_WIDGET_IDENTIFIER = 'gastown-dashboard';

export const GT_WIDGET_PERMISSIONS: WidgetPermission[] = [
  'nostr:publish',
  'nostr:query',
  'nostr:subscribe',
  'nostr:unsubscribe',
  'storage:get',
  'storage:set',
  'storage:remove',
  'storage:keys',
  'ui:toast',
  'ui:resize',
];

/**
 * All Nostr event kinds that the Gas Town extension needs to read/subscribe to.
 * These are declared in the kind 30033 event via `nostrKinds` tags so the host
 * can grant access to these kinds through the bridge.
 */
export const GT_WIDGET_NOSTR_KINDS: number[] = [
  // GT protocol kinds
  KIND_LOG_STATUS,         // 30315
  KIND_LIFECYCLE,          // 30316
  KIND_GT_CONVOY_STATE,    // 30318
  KIND_GT_BEADS_ISSUE_STATE, // 30319
  KIND_GT_PROTOCOL_EVENT,  // 30320
  KIND_GT_GROUP_DEF,       // 30321
  KIND_GT_QUEUE_DEF,       // 30322
  KIND_GT_CHANNEL_DEF,     // 30323
  KIND_GT_WORK_ITEM,       // 30325
  // AI-Hub reused kinds
  KIND_TASK,               // 38383
  KIND_CONTROL,            // 38384
  KIND_MCP_CALL,           // 38385
  KIND_MCP_RESULT,         // 38386
  // Standard Nostr kinds for messaging features
  KIND_DM,                 // 14
  KIND_CHANNEL_CREATE,     // 40
  KIND_CHANNEL_META,       // 41
  KIND_CHANNEL_MESSAGE,    // 42
  KIND_GIFT_WRAP,          // 1059
];

/**
 * Generate the default Smart Widget event options for the Gas Town extension.
 *
 * @param appUrl - The deployed iframe app URL (e.g., from `pnpm build` output).
 * @param iconUrl - Icon URL for the widget.
 * @param imageUrl - Preview image URL for the widget.
 */
export function gastownWidgetDefaults(
  appUrl: string,
  iconUrl: string,
  imageUrl: string,
): SmartWidgetEventOptions {
  return {
    identifier: GT_WIDGET_IDENTIFIER,
    title: 'Gas Town Dashboard',
    widgetType: 'tool',
    appUrl,
    iconUrl,
    imageUrl,
    buttonTitle: 'Open Dashboard',
    permissions: GT_WIDGET_PERMISSIONS,
    nostrKinds: GT_WIDGET_NOSTR_KINDS,
    client: {
      name: 'gastown-flotilla-extension',
      originHint: new URL(appUrl).origin,
    },
  };
}
