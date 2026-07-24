<script lang="ts">
  import type { ParsedGTEvent, LifecycleContent } from '@flotilla/ext-shared';
  import { timeAgo, statusColor, roleIcon } from '../lib/utils.js';

  type Props = {
    agents: ParsedGTEvent<LifecycleContent>[];
  };

  const { agents }: Props = $props();

  const agentsByStatus = $derived.by(() => {
    const groups: Record<string, ParsedGTEvent<LifecycleContent>[]> = {
      ready: [],
      busy: [],
      retiring: [],
      dead: [],
    };
    for (const a of agents) {
      const s = a.data?.status ?? a.tags.status ?? 'dead';
      const bucket = groups[s];
      if (bucket) bucket.push(a);
      else groups['dead']!.push(a);
    }
    return groups;
  });

  function isStale(agent: ParsedGTEvent<LifecycleContent>): boolean {
    const heartbeat = agent.data?.last_heartbeat;
    if (!heartbeat) return false;
    const hbTs = Math.floor(new Date(heartbeat).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const role = agent.data?.role;
    const interval = role === 'deacon' ? 30 : 60;
    return (now - hbTs) > interval * 3;
  }
</script>

<section class="view">
  <div class="view-header">
    <h2>Agents</h2>
    <div class="header-stats">
      <span class="stat">
        <span class="dot" style="background:{statusColor('ready')}"></span>
        {agentsByStatus.ready?.length ?? 0} ready
      </span>
      <span class="stat">
        <span class="dot" style="background:{statusColor('busy')}"></span>
        {agentsByStatus.busy?.length ?? 0} busy
      </span>
      <span class="stat">
        <span class="dot" style="background:{statusColor('dead')}"></span>
        {agentsByStatus.dead?.length ?? 0} dead
      </span>
      <span class="live-badge">● live</span>
    </div>
  </div>

  {#if agents.length === 0}
    <p class="empty">No agents registered.</p>
  {:else}
    <div class="agent-grid">
      {#each agents as agent (agent.dTag ?? agent.raw.id)}
        {@const data = agent.data}
        {@const stale = isStale(agent)}
        <div class="agent-card" class:stale>
          <div class="card-header">
            <span class="role-icon">{roleIcon(data?.role ?? '')}</span>
            <span class="agent-name">{data?.instance ?? agent.dTag ?? '?'}</span>
            <span
              class="status-badge"
              style="background:{statusColor(data?.status ?? 'dead')}"
            >
              {data?.status ?? 'unknown'}
            </span>
          </div>
          <div class="card-body">
            <div class="field">
              <span class="label">Role:</span>
              <span>{data?.role ?? '?'}</span>
            </div>
            <div class="field">
              <span class="label">Rig:</span>
              <span>{data?.rig ?? agent.tags.rig ?? '?'}</span>
            </div>
            {#if data?.current_issue}
              <div class="field">
                <span class="label">Working on:</span>
                <span class="issue-link">{data.current_issue}</span>
              </div>
            {/if}
            {#if data?.model}
              <div class="field">
                <span class="label">Model:</span>
                <span class="mono">{data.model}</span>
              </div>
            {/if}
            {#if data?.last_heartbeat}
              <div class="field">
                <span class="label">Heartbeat:</span>
                <span class:stale-text={stale}>
                  {timeAgo(Math.floor(new Date(data.last_heartbeat).getTime() / 1000))}
                  {#if stale} ⚠️ stale{/if}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .view { padding: 0; }
  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .view-header h2 { margin: 0; font-size: 1.2rem; }
  .header-stats { display: flex; gap: 0.75rem; align-items: center; }
  .stat { font-size: 0.8rem; color: var(--ext-text-secondary); display: flex; align-items: center; gap: 0.25rem; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .live-badge {
    font-size: 0.75rem;
    color: var(--ext-success);
    font-weight: 600;
  }
  .empty { color: var(--ext-text-faint); text-align: center; padding: 2rem; }
  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }
  .agent-card {
    background: var(--ext-surface-2);
    border: 1px solid var(--ext-border-subtle);
    border-radius: 8px;
    padding: 0.75rem;
    transition: border-color 0.2s;
  }
  .agent-card:hover { border-color: var(--ext-text-faint); }
  .agent-card.stale { border-color: var(--ext-warning); background: var(--ext-warning-bg); }
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .role-icon { font-size: 1.3rem; }
  .agent-name { font-weight: 600; flex: 1; }
  .status-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    color: var(--ext-accent-text);
    font-weight: 600;
    text-transform: uppercase;
  }
  .card-body { display: flex; flex-direction: column; gap: 0.25rem; }
  .field { display: flex; gap: 0.4rem; font-size: 0.8rem; }
  .label { color: var(--ext-text-faint); min-width: 80px; }
  .issue-link { color: var(--ext-accent); font-weight: 500; }
  .mono { font-family: monospace; font-size: 0.75rem; }
  .stale-text { color: var(--ext-warning-text); }
</style>
