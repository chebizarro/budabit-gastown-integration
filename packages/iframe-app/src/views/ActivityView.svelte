<script lang="ts">
  import type { ParsedGTEvent, LogStatusContent } from '@flotilla/ext-shared';
  import { timeAgo, logTypeIcon, truncate } from '../lib/utils.js';

  type Props = {
    events: ParsedGTEvent<LogStatusContent>[];
  };

  const { events }: Props = $props();
</script>

<section class="view">
  <div class="view-header">
    <h2>Activity Feed</h2>
    <span class="live-badge">● live</span>
  </div>

  {#if events.length === 0}
    <p class="empty">No activity events yet.</p>
  {:else}
    <div class="event-list">
      {#each events as event (event.raw.id)}
        <div class="event-row">
          <span class="icon">{logTypeIcon(event.tags.type ?? '')}</span>
          <div class="event-body">
            <div class="event-meta">
              <span class="tag type">{event.tags.type ?? 'unknown'}</span>
              {#if event.tags.rig}
                <span class="tag rig">{event.tags.rig}</span>
              {/if}
              {#if event.tags.actor}
                <span class="tag actor">{event.tags.actor}</span>
              {/if}
              <span class="time">{timeAgo(event.raw.created_at)}</span>
            </div>
            {#if event.data?.payload}
              <div class="payload">
                {truncate(JSON.stringify(event.data.payload), 120)}
              </div>
            {/if}
            {#if event.tags.issueId}
              <span class="correlation">🔗 {event.tags.issueId}</span>
            {/if}
            {#if event.tags.branch}
              <span class="correlation">🌿 {event.tags.branch}</span>
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
  }
  .view-header h2 { margin: 0; font-size: 1.2rem; }
  .live-badge {
    font-size: 0.75rem;
    color: #28a745;
    font-weight: 600;
  }
  .empty { color: #999; text-align: center; padding: 2rem; }
  .event-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .event-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #eee;
  }
  .icon { font-size: 1.2rem; flex-shrink: 0; }
  .event-body { flex: 1; min-width: 0; }
  .event-meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .tag {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .tag.type { background: #d1ecf1; color: #0c5460; }
  .tag.rig { background: #d4edda; color: #155724; }
  .tag.actor { background: #e2e3e5; color: #383d41; }
  .time { font-size: 0.75rem; color: #999; margin-left: auto; }
  .payload {
    margin-top: 0.3rem;
    font-size: 0.8rem;
    color: #555;
    font-family: monospace;
    word-break: break-all;
  }
  .correlation {
    display: inline-block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #666;
  }
</style>
