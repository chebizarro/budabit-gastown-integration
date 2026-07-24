import { test, expect } from '@playwright/test';

test.describe('Gas Town Dashboard', () => {
  test('should render the dashboard with Gas Town branding', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Gas Town');
    await expect(page.locator('.status-indicator')).toBeVisible();
  });

  test('should show all navigation tabs', async ({ page }) => {
    await page.goto('/');

    const expectedTabs = [
      'Activity',
      'Agents',
      'Chat',
      'Channels',
      'Convoys',
      'Issues',
      'Groups',
      'Work Queue',
      'Protocol',
    ];
    for (const label of expectedTabs) {
      await expect(page.locator(`.tab:has-text("${label}")`)).toBeVisible();
    }
  });

  test('should show connecting state initially', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.status-indicator')).toContainText('Waiting for host context');
  });

  test('should show error state when no relays provided', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'event',
          action: 'context:repoUpdate',
          payload: {
            contextId: 'test',
            userPubkey: 'pk-123',
            relays: [],
          },
        },
        '*'
      );
    });

    await expect(page.locator('.status-indicator.error')).toBeVisible();
    await expect(page.locator('.error-banner')).toContainText('No relays provided');
  });

  test('should attempt subscription when relays are provided', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      (window as any).__bridgeRequests = [];
      window.addEventListener('message', (event) => {
        const data = event.data as any;
        if (!data || typeof data !== 'object' || data.type !== 'request') return;
        (window as any).__bridgeRequests.push(data);
      });

      window.postMessage(
        {
          type: 'event',
          action: 'context:repoUpdate',
          payload: {
            contextId: 'test-room',
            userPubkey: 'pk-abc',
            relays: ['wss://relay.example.com'],
          },
        },
        '*'
      );
    });

    await page.waitForFunction(
      () => {
        const reqs = (window as any).__bridgeRequests;
        return Array.isArray(reqs) && reqs.some((m: any) => m.action === 'nostr:subscribe');
      },
      undefined,
      { timeout: 5000 }
    );

    const subRequest = await page.evaluate(() => {
      const reqs = (window as any).__bridgeRequests as any[];
      return reqs.find((m) => m.action === 'nostr:subscribe') ?? null;
    });

    expect(subRequest).not.toBeNull();
    expect(subRequest.action).toBe('nostr:subscribe');
    expect(subRequest.payload.relays).toContain('wss://relay.example.com');
    expect(subRequest.payload.subscriptionId).toBeTruthy();
  });

  test('should switch tabs on click', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.addEventListener('message', (event) => {
        const data = event.data as any;
        if (!data || data.type !== 'request' || data.action !== 'nostr:subscribe') return;

        const subscriptionId = `host-${data.payload.subscriptionId}`;
        window.postMessage(
          {
            type: 'response',
            id: data.id,
            action: data.action,
            payload: { status: 'ok', subscriptionId },
          },
          '*'
        );
        setTimeout(() => {
          window.postMessage(
            { type: 'event', action: 'nostr:eose', payload: { subscriptionId } },
            '*'
          );
        }, 50);
      });

      window.postMessage(
        {
          type: 'event',
          action: 'context:repoUpdate',
          payload: { relays: ['wss://r.example.com'] },
        },
        '*'
      );
    });

    await expect(page.locator('.status-indicator')).toContainText('live', { timeout: 5000 });

    await page.locator('.tab:has-text("Issues")').click();
    await expect(page.locator('.view-header h2')).toContainText('Issues');

    await page.locator('.tab:has-text("Activity")').click();
    await expect(page.locator('.view-header h2')).toContainText('Activity');

    await page.locator('.tab:has-text("Chat")').click();
    await expect(page.locator('.view-header h2')).toContainText('Direct Messages');

    await page.locator('.tab:has-text("Channels")').click();
    await expect(page.locator('.view-header h2')).toContainText('Channels');

    await page.locator('.tab:has-text("Groups")').click();
    await expect(page.locator('.view-header h2')).toContainText('Groups');
  });
});
