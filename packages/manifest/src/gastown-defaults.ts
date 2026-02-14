/**
 * Default manifest values for the Gas Town Flotilla extension.
 */

import type { SmartWidgetEventOptions } from './generator.js';
import type { WidgetPermission } from '@flotilla/ext-shared';

export const GT_WIDGET_IDENTIFIER = 'gastown-dashboard';

export const GT_WIDGET_PERMISSIONS: WidgetPermission[] = [
  'nostr:publish',
  'nostr:query',
  'storage:get',
  'storage:set',
  'storage:remove',
  'storage:keys',
  'ui:toast',
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
    client: {
      name: 'gastown-flotilla-extension',
      originHint: new URL(appUrl).origin,
    },
  };
}
