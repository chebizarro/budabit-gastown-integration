<script lang="ts">
  import type { ParsedGTEvent, ConvoyStateContent } from '@flotilla/ext-shared';
  import { statusColor, isoTimeAgo } from '../lib/utils.js';

  type Props = {
    convoys: ParsedGTEvent<ConvoyStateContent>[];
    onRefresh: () => void;
  };

  const { convoys, onRefresh }: Props = $props();
</script>

<section class="view">
  <div class="view-header">
    <h2>Convoys</h2>
    <button class="btn-sm" onclick={onRefresh}>↻ Refresh</button>
  </div>

  {#if convoys.length === 0}
    <p class="empty">No convoys found.</p>
  {:else}
    <div class="convoy-list">
      {#each convoys as convoy (convoy.dTag ?? convoy.raw.id)}
        {@const d = convoy.data}
        <div class="convoy-card">
          <div class="card-header">
            <span class="convoy-title">{d?.title ?? convoy.dTag ?? '?'}</span>
            <span
              class="status-badge"
              style="background:{statusColor(d?.status ?? 'open')}"
            >
              {d?.status ?? 'open'}
            </span>
          </div>

          {#if d?.summary}
            <div class="progress-bar">
              <div class="bar-fill closed" style="width:{(d.summary.closed / (d.summary.total || 1)) * 100}%"></div>
              <div class="bar-fill blocked" style="width:{(d.summary.blocked / (d.summary.total || 1)) * 100}%"></div>
            </div>
            <div class="summary-stats">
              <span>{d.summary.closed}/{d.summary.total} closed</span>
              {#if d.summary.blocked > 0}
                <span class="blocked-text">· {d.summary.blocked} blocked</span>
              {/if}
              <span>· {d.summary.open} open</span>
            </div>
          {/if}

          {#if d?.tracked_issues && d.tracked_issues.length > 0}
            <div class="issues-list">
              {#each d.tracked_issues as issue (issue.id)}
                <div class="issue-row">
                  <span
                    class="issue-status"
                    style="color:{statusColor(issue.status)}"
                  >●</span>
                  <span class="issue-id">{issue.id}</span>
                  <span class="issue-title">{issue.title}</span>
                  {#if issue.assignee}
                    <span class="issue-assignee">→ {issue.assignee}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if d?.active_workers && d.active_workers.length > 0}
            <div class="workers">
              Active: {d.active_workers.join(', ')}
            </div>
          {/if}

          {#if d?.last_updated}
            <div class="updated">Updated {isoTimeAgo(d.last_updated)}</div>
          {/if}
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
  }
  .view-header h2 { margin: 0; font-size: 1.2rem; }
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
  .convoy-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .convoy-card {
    background: #f8f9fa;
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1rem;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .convoy-title { font-weight: 600; font-size: 1rem; }
  .status-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    color: white;
    font-weight: 600;
    text-transform: uppercase;
  }
  .progress-bar {
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    margin-bottom: 0.3rem;
  }
  .bar-fill.closed { background: #28a745; }
  .bar-fill.blocked { background: #dc3545; }
  .summary-stats {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.5rem;
  }
  .blocked-text { color: #dc3545; }
  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .issue-row {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .issue-status { font-size: 0.6rem; }
  .issue-id { font-weight: 600; color: #007bff; min-width: 60px; }
  .issue-title { flex: 1; color: #333; }
  .issue-assignee { color: #888; font-size: 0.75rem; }
  .workers { font-size: 0.75rem; color: #555; margin-bottom: 0.25rem; }
  .updated { font-size: 0.7rem; color: #999; }
</style>
