<script lang="ts">
  import type { ParsedGTEvent, WorkItemContent, QueueDefContent } from '@flotilla/ext-shared';
  import { statusColor, timeAgo } from '../lib/utils.js';

  type Props = {
    workItems: ParsedGTEvent<WorkItemContent>[];
    queues: ParsedGTEvent<QueueDefContent>[];
    onRefresh: () => void;
  };

  const { workItems, queues, onRefresh }: Props = $props();

  let selectedQueue = $state<string>('all');

  const filteredItems = $derived.by(() => {
    if (selectedQueue === 'all') return workItems;
    return workItems.filter(w => (w.data?.queue ?? w.tags.queue) === selectedQueue);
  });

  const queueNames = $derived.by(() => {
    const names = new Set<string>();
    for (const q of queues) {
      const name = q.data?.name ?? q.dTag;
      if (name) names.add(name);
    }
    for (const w of workItems) {
      const name = w.data?.queue ?? w.tags.queue;
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  });
</script>

<section class="view">
  <div class="view-header">
    <h2>Work Queue</h2>
    <div class="controls">
      <select bind:value={selectedQueue}>
        <option value="all">All queues ({workItems.length})</option>
        {#each queueNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
      <button class="btn-sm" onclick={onRefresh}>↻</button>
    </div>
  </div>

  {#if queues.length > 0}
    <div class="queue-defs">
      {#each queues as q (q.dTag ?? q.raw.id)}
        {@const d = q.data}
        {#if d}
          <div class="queue-card">
            <div class="queue-header">
              <span class="queue-name">{d.name}</span>
              <span
                class="status-badge"
                style="background:{statusColor(d.status)}"
              >{d.status}</span>
            </div>
            <div class="queue-stats">
              <span>📥 {d.counts.available} available</span>
              <span>⚙️ {d.counts.processing} processing</span>
              <span>✅ {d.counts.completed} done</span>
              {#if d.counts.failed > 0}
                <span class="failed">❌ {d.counts.failed} failed</span>
              {/if}
            </div>
            <div class="queue-meta">
              {d.scope} · max {d.max_concurrency} concurrent · {d.processing_order}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if filteredItems.length === 0}
    <p class="empty">No work items in queue.</p>
  {:else}
    <div class="items-list">
      {#each filteredItems as item (item.raw.id)}
        {@const d = item.data}
        <div class="item-row">
          <span
            class="item-status"
            style="color:{statusColor(d?.claimed_by ? 'claimed' : (item.tags.status ?? 'available'))}"
          >●</span>
          <div class="item-body">
            <div class="item-header">
              <span class="item-subject">{d?.subject ?? '(no subject)'}</span>
              <span class="item-queue">{d?.queue ?? item.tags.queue ?? '?'}</span>
            </div>
            {#if d?.claimed_by}
              <div class="item-claimed">
                Claimed by {d.claimed_by}
                {#if d.claimed_at}
                  · {timeAgo(Math.floor(new Date(d.claimed_at).getTime() / 1000))}
                {/if}
              </div>
            {/if}
            {#if item.tags.issueId}
              <span class="item-issue">🔗 {item.tags.issueId}</span>
            {/if}
          </div>
          <span class="item-time">{timeAgo(item.raw.created_at)}</span>
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
  .controls { display: flex; gap: 0.5rem; align-items: center; }
  select {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 0.85rem;
    background: white;
  }
  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.85rem;
    background: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 4px;
    cursor: pointer;
  }
  .btn-sm:hover { background: #dee2e6; }
  .empty { color: #999; text-align: center; padding: 2rem; }

  .queue-defs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .queue-card {
    background: #f8f9fa;
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 0.75rem;
  }
  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .queue-name { font-weight: 600; }
  .status-badge {
    padding: 0.1rem 0.4rem;
    border-radius: 8px;
    font-size: 0.65rem;
    color: white;
    font-weight: 600;
    text-transform: uppercase;
  }
  .queue-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #555;
    margin-bottom: 0.3rem;
  }
  .failed { color: #dc3545; }
  .queue-meta { font-size: 0.7rem; color: #999; }

  .items-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .item-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: #f8f9fa;
    border: 1px solid #eee;
    border-radius: 6px;
    align-items: flex-start;
  }
  .item-status { font-size: 0.7rem; margin-top: 0.2rem; }
  .item-body { flex: 1; min-width: 0; }
  .item-header { display: flex; justify-content: space-between; gap: 0.5rem; }
  .item-subject { font-weight: 500; }
  .item-queue {
    font-size: 0.7rem;
    padding: 0.1rem 0.3rem;
    background: #e2e3e5;
    border-radius: 3px;
    color: #383d41;
    flex-shrink: 0;
  }
  .item-claimed { font-size: 0.75rem; color: #e65100; margin-top: 0.2rem; }
  .item-issue { font-size: 0.75rem; color: #007bff; }
  .item-time { font-size: 0.75rem; color: #999; flex-shrink: 0; }
</style>
