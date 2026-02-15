import { test, expect } from '@playwright/test';

test.describe('Gas Town Dashboard', () => {
  test('should render the dashboard with Gas Town branding', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Gas Town');
    await expect(page.locator('.status-indicator')).toBeVisible();
  });

  test('should show all navigation tabs', async ({ page }) => {
    await page.goto('/');

    const expectedTabs = ['Activity', 'Agents', 'Chat', 'Channels', 'Convoys', 'Issues', 'Groups', 'Work Queue', 'Protocol'];
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

    // Send context with no relays
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'event',
          action: 'context:update',
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

    // Track outgoing bridge requests
    await page.evaluate(() => {
      (window as any).__bridgeRequests = [];
      window.addEventListener('message', (event) => {
        const data = event.data as any;
        if (!data || typeof data !== 'object') return;
        if (data.type !== 'request') return;
        (window as any).__bridgeRequests.push(data);
      });
    });

    // Send context with relays
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'event',
          action: 'context:update',
          payload: {
            contextId: 'test-room',
            userPubkey: 'pk-abc',
            relays: ['wss://relay.example.com'],
          },
        },
        '*'
      );
    });

    // Wait for subscribe requests
    await page.waitForFunction(() => {
      const reqs = (window as any).__bridgeRequests;
      return Array.isArray(reqs) && reqs.some((m: any) => m.action === 'nostr:subscribe');
    }, undefined, { timeout: 5000 });

    const subRequest = await page.evaluate(() => {
      const reqs = (window as any).__bridgeRequests as any[];
      return reqs.find((m) => m.action === 'nostr:subscribe') ?? null;
    });

    expect(subRequest).not.toBeNull();
    expect(subRequest.action).toBe('nostr:subscribe');
    expect(subRequest.payload.relays).toContain('wss://relay.example.com');
  });

  test('should switch tabs on click', async ({ page }) => {
    await page.goto('/');

    // Provide context and simulate EOSE to get to ready state
    await page.evaluate(() => {
      window.postMessage(
        { type: 'event', action: 'context:update', payload: { relays: ['wss://r.example.com'] } },
        '*'
      );
    });

    // Respond to subscribe requests and send EOSE
    await page.evaluate(() => {
      window.addEventListener('message', (event) => {
        const data = event.data as any;
        if (!data || data.type !== 'request') return;

        if (data.action === 'nostr:subscribe') {
          window.postMessage(
            { type: 'response', id: data.id, action: data.action, payload: { status: 'ok', subId: data.payload.id } },
            '*'
          );
          // Send EOSE after short delay
          setTimeout(() => {
            window.postMessage(
              { type: 'event', action: 'nostr:eose', payload: { subId: data.payload.id } },
              '*'
            );
          }, 50);
        }
      });
    });

    // Wait for ready state
    await expect(page.locator('.status-indicator')).toContainText('live', { timeout: 5000 });

    // Click Issues tab
    await page.locator('.tab:has-text("Issues")').click();
    await expect(page.locator('.view-header h2')).toContainText('Issues');

    // Click Activity tab
    await page.locator('.tab:has-text("Activity")').click();
    await expect(page.locator('.view-header h2')).toContainText('Activity');

    // Click Chat tab
    await page.locator('.tab:has-text("Chat")').click();
    await expect(page.locator('.view-header h2')).toContainText('Direct Messages');

    // Click Channels tab
    await page.locator('.tab:has-text("Channels")').click();
    await expect(page.locator('.view-header h2')).toContainText('Channels');

    // Click Groups tab
    await page.locator('.tab:has-text("Groups")').click();
    await expect(page.locator('.view-header h2')).toContainText('Groups');
  });
});
