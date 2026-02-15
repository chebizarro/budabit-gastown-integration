<script lang="ts">
  import type { ParsedGTEvent, BeadsIssueStateContent } from '@flotilla/ext-shared';
  import { statusColor, priorityColor, isoTimeAgo } from '../lib/utils.js';

  type Props = {
    issues: ParsedGTEvent<BeadsIssueStateContent>[];
  };

  const { issues }: Props = $props();

  let filterStatus = $state<string>('all');

  const filtered = $derived.by(() => {
    if (filterStatus === 'all') return issues;
    return issues.filter(i => (i.data?.status ?? i.tags.status) === filterStatus);
  });

  const counts = $derived.by(() => {
    const c = { open: 0, in_progress: 0, closed: 0, blocked: 0 };
    for (const i of issues) {
      const s = i.data?.status ?? i.tags.status ?? 'open';
      if (s in c) c[s as keyof typeof c]++;
    }
    return c;
  });
</script>

<section class="view">
  <div class="view-header">
    <h2>Issues</h2>
    <div class="controls">
      <select bind:value={filterStatus}>
        <option value="all">All ({issues.length})</option>
        <option value="open">Open ({counts.open})</option>
        <option value="in_progress">In Progress ({counts.in_progress})</option>
        <option value="blocked">Blocked ({counts.blocked})</option>
        <option value="closed">Closed ({counts.closed})</option>
      </select>
      <span class="live-badge">● live</span>
    </div>
  </div>

  {#if filtered.length === 0}
    <p class="empty">No issues match the current filter.</p>
  {:else}
    <div class="issue-table">
      <div class="table-header">
        <span class="col-id">ID</span>
        <span class="col-title">Title</span>
        <span class="col-status">Status</span>
        <span class="col-priority">Priority</span>
        <span class="col-assignee">Assignee</span>
        <span class="col-updated">Updated</span>
      </div>
      {#each filtered as issue (issue.dTag ?? issue.raw.id)}
        {@const d = issue.data}
        <div class="table-row">
          <span class="col-id mono">{d?.id ?? issue.dTag ?? '?'}</span>
          <span class="col-title">
            {d?.title ?? '(untitled)'}
            {#if d?.labels && d.labels.length > 0}
              <span class="labels">
                {#each d.labels.slice(0, 3) as label}
                  <span class="label-tag">{label}</span>
                {/each}
              </span>
            {/if}
          </span>
          <span class="col-status">
            <span
              class="status-dot"
              style="background:{statusColor(d?.status ?? 'open')}"
            ></span>
            {d?.status ?? issue.tags.status ?? 'open'}
          </span>
          <span class="col-priority">
            <span
              class="priority-dot"
              style="background:{priorityColor(d?.priority ?? 'medium')}"
            ></span>
            {d?.priority ?? 'medium'}
          </span>
          <span class="col-assignee">{d?.assignee ?? '—'}</span>
          <span class="col-updated">
            {d?.updated_at ? isoTimeAgo(d.updated_at) : '—'}
          </span>
        </div>
        {#if d?.dependencies}
          {#if d.dependencies.blocked_by.length > 0}
            <div class="dep-row blocked">
              Blocked by: {d.dependencies.blocked_by.join(', ')}
            </div>
          {/if}
        {/if}
        {#if d?.branch}
          <div class="dep-row branch">🌿 {d.branch}</div>
        {/if}
        {#if d?.blobs && d.blobs.length > 0}
          <div class="dep-row blobs">
            📎 {d.blobs.length} blob{d.blobs.length > 1 ? 's' : ''} on Blossom
          </div>
        {/if}
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
  .live-badge {
    font-size: 0.75rem;
    color: #28a745;
    font-weight: 600;
  }
  .empty { color: #999; text-align: center; padding: 2rem; }
  .issue-table { font-size: 0.85rem; }
  .table-header, .table-row {
    display: grid;
    grid-template-columns: 80px 1fr 100px 80px 120px 80px;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    align-items: center;
  }
  .table-header {
    font-weight: 600;
    color: #666;
    border-bottom: 2px solid #dee2e6;
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  .table-row {
    border-bottom: 1px solid #f0f0f0;
  }
  .table-row:hover { background: #f8f9fa; }
  .mono { font-family: monospace; font-size: 0.8rem; color: #007bff; }
  .col-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .col-status, .col-priority {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
  }
  .status-dot, .priority-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .col-assignee {
    font-size: 0.8rem;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-updated { font-size: 0.75rem; color: #999; }
  .labels { margin-left: 0.3rem; }
  .label-tag {
    display: inline-block;
    padding: 0 0.3rem;
    background: #e2e3e5;
    border-radius: 3px;
    font-size: 0.65rem;
    color: #383d41;
    margin-right: 0.15rem;
  }
  .dep-row {
    padding: 0.2rem 0.75rem 0.2rem 90px;
    font-size: 0.75rem;
    color: #666;
  }
  .dep-row.blocked { color: #dc3545; }
  .dep-row.branch { color: #28a745; }
  .dep-row.blobs { color: #6f42c1; }
</style>
