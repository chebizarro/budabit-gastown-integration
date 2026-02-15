<script lang="ts">
  import {
    createWidgetBridge,
    createGTStores,
    type WidgetBridge,
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

    // Open relay subscriptions (events stream in via nostr:event push)
    void s.connect({ userPubkey: pubkey });
  }

  // Initialize bridge and wait for host context
  $effect(() => {
    const b = createWidgetBridge({
      targetWindow: window.parent,
      targetOrigin: '*',
    });

    statusMessage = 'Waiting for host context...';

    const offContext = b.onEvent('context:update', (ctx) => {
      const relays = Array.isArray(ctx?.relays) && ctx.relays.length > 0
        ? ctx.relays
        : null;

      if (!relays) {
        status = 'error';
        statusMessage = 'No relays provided by host';
        return;
      }

      userPubkey = typeof ctx?.userPubkey === 'string' ? ctx.userPubkey : undefined;
      connectStores(b, relays, userPubkey);
    });

    return () => {
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
      <p>Ensure the Flotilla host provides relay URLs via <code>context:update</code>.</p>
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
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
      sans-serif;
    background: #f5f5f5;
    color: #333;
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
    border-bottom: 1px solid #dee2e6;
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
    color: #222;
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
    color: #888;
  }

  .status-indicator .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffc107;
  }

  .status-indicator.connected .dot {
    background: #28a745;
  }

  .status-indicator.error .dot {
    background: #dc3545;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #888;
    gap: 1rem;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #dee2e6;
    border-top-color: #007bff;
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
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    color: #721c24;
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
    color: #721c24;
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
  }

  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #dee2e6;
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
    color: #666;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover { color: #333; }

  .tab.active {
    color: #007bff;
    border-bottom-color: #007bff;
    font-weight: 600;
  }

  .tab-icon { font-size: 1rem; }

  .tab-content {
    background: white;
    border-radius: 0 0 8px 8px;
    padding: 1.25rem;
    min-height: 400px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
</style>
