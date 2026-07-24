<script lang="ts">
  import { createWidgetBridge, type WidgetBridge } from 'budabit-sdk';
  import { watchHostTheme } from './lib/host-theme';
  import {
    createGTStores,
    type GTStoreManager,
    type ParsedGTEvent,
    type LogStatusContent,
    type LifecycleContent,
    type ConvoyStateContent,
    type BeadsIssueStateContent,
    type ProtocolEventContent,
    type WorkItemContent,
    type QueueDefContent,
    type GroupDefContent,
    type ChannelDefContent,
    type DirectMessage,
    type ChannelMessage,
    type ChannelMetadata,
  } from '@flotilla/ext-shared';

  import ActivityView from './views/ActivityView.svelte';
  import AgentsView from './views/AgentsView.svelte';
  import ConvoysView from './views/ConvoysView.svelte';
  import IssuesView from './views/IssuesView.svelte';
  import WorkQueueView from './views/WorkQueueView.svelte';
  import ProtocolView from './views/ProtocolView.svelte';
  import ChatView from './views/ChatView.svelte';
  import ChannelsView from './views/ChannelsView.svelte';
  import GroupsView from './views/GroupsView.svelte';

  type Tab = 'activity' | 'agents' | 'convoys' | 'issues' | 'workqueue' | 'protocol' | 'chat' | 'channels' | 'groups';

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity', icon: '📋' },
    { id: 'agents', label: 'Agents', icon: '🤖' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'channels', label: 'Channels', icon: '📢' },
    { id: 'convoys', label: 'Convoys', icon: '🚢' },
    { id: 'issues', label: 'Issues', icon: '📝' },
    { id: 'groups', label: 'Groups', icon: '👥' },
    { id: 'workqueue', label: 'Work Queue', icon: '📥' },
    { id: 'protocol', label: 'Protocol', icon: '📡' },
  ];

  // State
  let stores = $state<GTStoreManager | null>(null);
  let storeUnsubscribers = $state<(() => void)[]>([]);
  let activeTab = $state<Tab>('agents');
  let status = $state<'connecting' | 'connected' | 'error'>('connecting');
  let statusMessage = $state('Connecting...');
  let userPubkey = $state<string | undefined>(undefined);

  // Reactive store subscriptions
  let logs = $state<ParsedGTEvent<LogStatusContent>[]>([]);
  let agents = $state<ParsedGTEvent<LifecycleContent>[]>([]);
  let convoys = $state<ParsedGTEvent<ConvoyStateContent>[]>([]);
  let issues = $state<ParsedGTEvent<BeadsIssueStateContent>[]>([]);
  let protocol = $state<ParsedGTEvent<ProtocolEventContent>[]>([]);
  let workItems = $state<ParsedGTEvent<WorkItemContent>[]>([]);
  let queues = $state<ParsedGTEvent<QueueDefContent>[]>([]);
  let groupsList = $state<ParsedGTEvent<GroupDefContent>[]>([]);
  let directMessages = $state<DirectMessage[]>([]);
  let channelsMeta = $state<ChannelMetadata[]>([]);
  let channelMessages = $state<Map<string, ChannelMessage[]>>(new Map());
  let activeChannelId = $state<string | null>(null);
  let isReady = $state(false);
  let storeError = $state<string | null>(null);

  function connectStores(b: WidgetBridge, relays: string[], pubkey?: string) {
    // Clean up existing stores to prevent race condition
    if (stores) {
      stores.disconnect();
    }
    
    // Unsubscribe from previous store subscriptions to prevent memory leak
    for (const unsub of storeUnsubscribers) {
      unsub();
    }
    storeUnsubscribers = [];

    const s = createGTStores(b, relays);
    stores = s;

    // Subscribe to all reactive stores and store unsubscribe functions
    storeUnsubscribers.push(s.logs.subscribe(v => { logs = v; }));
    storeUnsubscribers.push(s.agents.subscribe(v => { agents = v; }));
    storeUnsubscribers.push(s.convoys.subscribe(v => { convoys = v; }));
    storeUnsubscribers.push(s.issues.subscribe(v => { issues = v; }));
    storeUnsubscribers.push(s.protocol.subscribe(v => { protocol = v; }));
    storeUnsubscribers.push(s.workItems.subscribe(v => { workItems = v; }));
    storeUnsubscribers.push(s.queues.subscribe(v => { queues = v; }));
    storeUnsubscribers.push(s.groups.subscribe(v => { groupsList = v; }));
    storeUnsubscribers.push(s.directMessages.subscribe(v => { directMessages = v; }));
    storeUnsubscribers.push(s.channelMeta.subscribe(v => { channelsMeta = v; }));
    storeUnsubscribers.push(s.channelMessages.subscribe(v => { channelMessages = v; }));
    storeUnsubscribers.push(s.activeChannelId.subscribe(v => { activeChannelId = v; }));
    storeUnsubscribers.push(s.ready.subscribe(v => {
      isReady = v;
      if (v) {
        status = 'connected';
        statusMessage = 'Connected — live';
      }
    }));
    storeUnsubscribers.push(s.error.subscribe(v => { storeError = v; }));

    // Open relay subscriptions (events stream via nostr:subscription:event).
    void s.connect({ userPubkey: pubkey });
  }

  // Initialize bridge and wait for host context
  $effect(() => {
    const b = createWidgetBridge({
      targetWindow: window.parent,
      targetOrigin: '*',
    });

    statusMessage = 'Waiting for host context...';

    // Match the host application's theme (light/dark + background)
    const offTheme = watchHostTheme(b);

    // Normalize both current widget:init payloads and repo-scoped updates.
    function handleContext(ctx: any, includeInitPubkey = false) {
      const nestedRepo = ctx?.repoContext && typeof ctx.repoContext === 'object'
        ? ctx.repoContext
        : null;
      const relayCandidate = ctx?.relays ?? ctx?.repoRelays
        ?? nestedRepo?.relays ?? nestedRepo?.repoRelays;
      const relays = Array.isArray(relayCandidate) && relayCandidate.length > 0
        ? relayCandidate
        : null;

      if (!relays) {
        status = 'error';
        statusMessage = 'No relays provided by host';
        return;
      }

      userPubkey = typeof ctx?.userPubkey === 'string'
        ? ctx.userPubkey
        : includeInitPubkey && typeof ctx?.pubkey === 'string'
          ? ctx.pubkey
          : userPubkey;
      connectStores(b, relays, userPubkey);
    }

    // Listen for the initial lifecycle context from current hosts.
    const offInit = b.onEvent('widget:init', (payload) => {
      handleContext(payload, true);
    });

    // Listen for context:repoUpdate (primary repo-scoped context event).
    const offRepoUpdate = b.onEvent('context:repoUpdate', (ctx) => {
      handleContext(ctx);
    });

    // Deprecated legacy fallback for pre-v2 hosts; remove with bridge API v2.0.
    const offContext = b.onEvent('context:update', (ctx) => {
      handleContext(ctx);
    });

    // Signal to the host that we're ready for lifecycle events.
    // This triggers faster widget:mounted delivery (host waits up to 5s otherwise).
    b.signalReady();

    return () => {
      offTheme();
      offInit();
      offRepoUpdate();
      offContext();

      // Clean up store subscriptions
      for (const unsub of storeUnsubscribers) {
        unsub();
      }
      storeUnsubscribers = [];

      stores?.disconnect();
      b.destroy();
    };
  });
</script>

<div class="dashboard">
  <header class="dash-header">
    <div class="brand">
      <span class="brand-icon">⛽</span>
      <h1>Gas Town</h1>
    </div>
    <div class="header-right">
      <span class="status-indicator" class:connected={status === 'connected'} class:error={status === 'error'}>
        <span class="dot"></span>
        {statusMessage}
      </span>
    </div>
  </header>

  {#if storeError}
    <div class="error-banner">
      <strong>Error:</strong> {storeError}
      <button class="btn-dismiss" onclick={() => { storeError = null; }}>✕</button>
    </div>
  {/if}

  {#if status === 'error'}
    <div class="error-banner">
      <strong>{statusMessage}</strong>
      <p>Ensure the Flotilla host provides relay URLs via <code>widget:init</code> or <code>context:repoUpdate</code>.</p>
    </div>
  {:else}
    <nav class="tab-bar">
      {#each TABS as tab (tab.id)}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          onclick={() => { activeTab = tab.id; }}
        >
          <span class="tab-icon">{tab.icon}</span>
          <span class="tab-label">{tab.label}</span>
        </button>
      {/each}
    </nav>

    <main class="tab-content">
      {#if !isReady}
        <div class="loading-state">
          <span class="loading-spinner"></span>
          <p>Loading initial state from relays...</p>
        </div>
      {:else if activeTab === 'activity'}
        <ActivityView events={logs} />
      {:else if activeTab === 'agents'}
        <AgentsView {agents} />
      {:else if activeTab === 'chat'}
        {#if stores}
          <ChatView messages={directMessages} {stores} {userPubkey} />
        {/if}
      {:else if activeTab === 'channels'}
        {#if stores}
          <ChannelsView {channelsMeta} {channelMessages} {activeChannelId} {stores} />
        {/if}
      {:else if activeTab === 'convoys'}
        <ConvoysView {convoys} />
      {:else if activeTab === 'issues'}
        <IssuesView {issues} />
      {:else if activeTab === 'groups'}
        <GroupsView groups={groupsList} />
      {:else if activeTab === 'workqueue'}
        <WorkQueueView {workItems} {queues} />
      {:else if activeTab === 'protocol'}
        <ProtocolView events={protocol} />
      {/if}
    </main>
  {/if}
</div>

<style>
  /* Theme tokens — lib/host-theme.ts sets `data-theme` on <html> from the
     host's widget:init / widget:themeChanged events. */
  :global(:root) {
    color-scheme: light;
    --ext-bg: #f5f5f5;
    --ext-surface: #ffffff;
    --ext-surface-2: #f8f9fa;
    --ext-surface-3: #e9ecef;
    --ext-border: #dee2e6;
    --ext-border-subtle: #eeeeee;
    --ext-text: #333333;
    --ext-text-strong: #222222;
    --ext-text-secondary: #555555;
    --ext-text-muted: #666666;
    --ext-text-faint: #999999;
    --ext-accent: #007bff;
    --ext-accent-hover: #0056b3;
    --ext-accent-text: #ffffff;
    --ext-success: #28a745;
    --ext-success-bg: #d4edda;
    --ext-success-text: #155724;
    --ext-danger: #dc3545;
    --ext-danger-bg: #f8d7da;
    --ext-danger-border: #f5c6cb;
    --ext-danger-text: #721c24;
    --ext-warning: #ffc107;
    --ext-warning-bg: #fff8e1;
    --ext-warning-text: #e65100;
    --ext-info-bg: #d1ecf1;
    --ext-info-border: #bee5eb;
    --ext-info-text: #0c5460;
    --ext-neutral-bg: #e2e3e5;
    --ext-neutral-text: #383d41;
    --ext-disabled: #cccccc;
    --ext-shadow: rgba(0, 0, 0, 0.08);
  }

  :global([data-theme='dark']) {
    color-scheme: dark;
    --ext-bg: #151c23;
    --ext-surface: #1e2831;
    --ext-surface-2: #232e39;
    --ext-surface-3: #2a3541;
    --ext-border: #33404c;
    --ext-border-subtle: #2c3947;
    --ext-text: #e6ebf0;
    --ext-text-strong: #f2f6fa;
    --ext-text-secondary: #c3ccd5;
    --ext-text-muted: #98a6b3;
    --ext-text-faint: #78889a;
    --ext-accent: #3b96ff;
    --ext-accent-hover: #63abff;
    --ext-accent-text: #ffffff;
    --ext-success: #34c759;
    --ext-success-bg: #14321f;
    --ext-success-text: #7fd6a0;
    --ext-danger: #ef5b67;
    --ext-danger-bg: #3b1d21;
    --ext-danger-border: #7a3a42;
    --ext-danger-text: #f1a7ad;
    --ext-warning: #e2b93b;
    --ext-warning-bg: #3f3520;
    --ext-warning-text: #e8c869;
    --ext-info-bg: #16323a;
    --ext-info-border: #275764;
    --ext-info-text: #8fd4e3;
    --ext-neutral-bg: #2b333c;
    --ext-neutral-text: #c3ccd5;
    --ext-disabled: #46525d;
    --ext-shadow: rgba(0, 0, 0, 0.45);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
      sans-serif;
    background: var(--host-background, var(--ext-bg));
    color: var(--ext-text);
  }

  .dashboard {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--ext-border);
    margin-bottom: 0;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .brand-icon { font-size: 1.5rem; }

  .brand h1 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--ext-text-strong);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--ext-text-faint);
  }

  .status-indicator .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ext-warning);
  }

  .status-indicator.connected .dot {
    background: var(--ext-success);
  }

  .status-indicator.error .dot {
    background: var(--ext-danger);
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: var(--ext-text-faint);
    gap: 1rem;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--ext-border);
    border-top-color: var(--ext-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--ext-danger-bg);
    border: 1px solid var(--ext-danger-border);
    border-radius: 4px;
    color: var(--ext-danger-text);
    font-size: 0.85rem;
    margin: 0.5rem 0;
  }

  .error-banner p {
    margin: 0;
    font-size: 0.8rem;
  }

  .error-banner code {
    background: rgba(0,0,0,0.05);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .btn-dismiss {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--ext-danger-text);
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
  }

  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--ext-border);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--ext-text-muted);
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover { color: var(--ext-text); }

  .tab.active {
    color: var(--ext-accent);
    border-bottom-color: var(--ext-accent);
    font-weight: 600;
  }

  .tab-icon { font-size: 1rem; }

  .tab-content {
    background: var(--ext-surface);
    border-radius: 0 0 8px 8px;
    padding: 1.25rem;
    min-height: 400px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
</style>
