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
  } from '@flotilla/ext-shared';

  import ActivityView from './views/ActivityView.svelte';
  import AgentsView from './views/AgentsView.svelte';
  import ConvoysView from './views/ConvoysView.svelte';
  import IssuesView from './views/IssuesView.svelte';
  import WorkQueueView from './views/WorkQueueView.svelte';
  import ProtocolView from './views/ProtocolView.svelte';

  type Tab = 'activity' | 'agents' | 'convoys' | 'issues' | 'workqueue' | 'protocol';

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity', icon: '📋' },
    { id: 'agents', label: 'Agents', icon: '🤖' },
    { id: 'convoys', label: 'Convoys', icon: '🚢' },
    { id: 'issues', label: 'Issues', icon: '📝' },
    { id: 'workqueue', label: 'Work Queue', icon: '📥' },
    { id: 'protocol', label: 'Protocol', icon: '📡' },
  ];

  // State
  let stores = $state<GTStoreManager | null>(null);
  let activeTab = $state<Tab>('agents');
  let status = $state('Initializing...');
  let connected = $state(false);

  // Reactive store subscriptions
  let logs = $state<ParsedGTEvent<LogStatusContent>[]>([]);
  let agents = $state<ParsedGTEvent<LifecycleContent>[]>([]);
  let convoys = $state<ParsedGTEvent<ConvoyStateContent>[]>([]);
  let issues = $state<ParsedGTEvent<BeadsIssueStateContent>[]>([]);
  let protocol = $state<ParsedGTEvent<ProtocolEventContent>[]>([]);
  let workItems = $state<ParsedGTEvent<WorkItemContent>[]>([]);
  let queues = $state<ParsedGTEvent<QueueDefContent>[]>([]);
  let loading = $state(false);
  let storeError = $state<string | null>(null);

  // Default relays (overridden by host context)
  const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol'];

  function initStores(b: WidgetBridge, relays: string[]) {
    const s = createGTStores(b, relays);
    stores = s;

    // Subscribe to all stores
    s.logs.subscribe(v => { logs = v; });
    s.agents.subscribe(v => { agents = v; });
    s.convoys.subscribe(v => { convoys = v; });
    s.issues.subscribe(v => { issues = v; });
    s.protocol.subscribe(v => { protocol = v; });
    s.workItems.subscribe(v => { workItems = v; });
    s.queues.subscribe(v => { queues = v; });
    s.loading.subscribe(v => { loading = v; });
    s.error.subscribe(v => { storeError = v; });

    // Initial fetch
    void s.refresh();
  }

  // Initialize bridge
  $effect(() => {
    const b = createWidgetBridge({
      targetWindow: window.parent,
      targetOrigin: '*',
      timeoutMs: 15000,
    });

    status = 'Bridge ready. Waiting for host context...';

    const offContext = b.onEvent('context:update', (ctx) => {
      connected = true;

      const relays = Array.isArray(ctx?.relays) && ctx.relays.length > 0
        ? ctx.relays
        : DEFAULT_RELAYS;

      status = 'Connected to Gas Town';
      initStores(b, relays);
    });

    // If no context arrives within 3s, initialize with defaults
    const fallbackTimer = setTimeout(() => {
      if (!connected) {
        status = 'Using default relays (no host context)';
        initStores(b, DEFAULT_RELAYS);
        connected = true;
      }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimer);
      offContext();
      b.destroy();
    };
  });

  // Auto-refresh every 30s
  $effect(() => {
    if (!stores) return;
    const interval = setInterval(() => {
      stores?.refresh();
    }, 30000);
    return () => clearInterval(interval);
  });
</script>

<div class="dashboard">
  <header class="dash-header">
    <div class="brand">
      <span class="brand-icon">⛽</span>
      <h1>Gas Town</h1>
    </div>
    <div class="header-right">
      <span class="status-indicator" class:connected>
        <span class="dot"></span>
        {status}
      </span>
      {#if loading}
        <span class="loading-spinner"></span>
      {/if}
    </div>
  </header>

  {#if storeError}
    <div class="error-banner">
      <strong>Error:</strong> {storeError}
      <button class="btn-dismiss" onclick={() => { storeError = null; }}>✕</button>
    </div>
  {/if}

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
    {#if activeTab === 'activity'}
      <ActivityView events={logs} onRefresh={() => stores?.refreshLogs()} />
    {:else if activeTab === 'agents'}
      <AgentsView {agents} onRefresh={() => stores?.refreshAgents()} />
    {:else if activeTab === 'convoys'}
      <ConvoysView {convoys} onRefresh={() => stores?.refreshConvoys()} />
    {:else if activeTab === 'issues'}
      <IssuesView {issues} onRefresh={() => stores?.refreshIssues()} />
    {:else if activeTab === 'workqueue'}
      <WorkQueueView {workItems} {queues} onRefresh={() => { stores?.refreshWorkItems(); stores?.refreshQueues(); }} />
    {:else if activeTab === 'protocol'}
      <ProtocolView events={protocol} onRefresh={() => stores?.refreshProtocol()} />
    {/if}
  </main>
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

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #dee2e6;
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
