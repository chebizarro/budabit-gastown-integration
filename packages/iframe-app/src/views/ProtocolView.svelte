<script lang="ts">
  import type { ParsedGTEvent, ProtocolEventContent } from '@flotilla/ext-shared';
  import { timeAgo, protocolIcon } from '../lib/utils.js';

  type Props = {
    events: ParsedGTEvent<ProtocolEventContent>[];
  };

  const { events }: Props = $props();
</script>

<section class="view">
  <div class="view-header">
    <h2>Protocol Events</h2>
    <span class="live-badge">● live</span>
  </div>

  {#if events.length === 0}
    <p class="empty">No protocol events.</p>
  {:else}
    <div class="event-list">
      {#each events as event (event.raw.id)}
        {@const d = event.data}
        <div class="event-row">
          <span class="icon">{protocolIcon(d?.msg_type ?? event.tags.msgType ?? '')}</span>
          <div class="event-body">
            <div class="event-meta">
              <span class="msg-type">{d?.msg_type ?? event.tags.msgType ?? 'UNKNOWN'}</span>
              {#if event.tags.from}
                <span class="route">{event.tags.from}</span>
              {/if}
              {#if event.tags.to}
                <span class="route-arrow">→</span>
                <span class="route">{event.tags.to}</span>
              {/if}
              <span class="time">{timeAgo(event.raw.created_at)}</span>
            </div>
            {#if d?.body}
              <div class="body-fields">
                {#each Object.entries(d.body).slice(0, 5) as [key, val]}
                  <span class="field">
                    <span class="field-key">{key}:</span>
                    <span class="field-val">{String(val)}</span>
                  </span>
                {/each}
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
    color: var(--ext-success);
    font-weight: 600;
  }
  .empty { color: var(--ext-text-faint); text-align: center; padding: 2rem; }
  .event-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .event-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--ext-surface-2);
    border-radius: 6px;
    border: 1px solid var(--ext-border-subtle);
  }
  .icon { font-size: 1.2rem; flex-shrink: 0; }
  .event-body { flex: 1; min-width: 0; }
  .event-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.3rem;
  }
  .msg-type {
    font-weight: 700;
    font-size: 0.8rem;
    padding: 0.1rem 0.4rem;
    background: var(--ext-info-bg);
    color: var(--ext-info-text);
    border-radius: 3px;
  }
  .route {
    font-size: 0.75rem;
    color: var(--ext-text-secondary);
    font-family: monospace;
  }
  .route-arrow { font-size: 0.75rem; color: var(--ext-text-faint); }
  .time { font-size: 0.75rem; color: var(--ext-text-faint); margin-left: auto; }
  .body-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }
  .field { font-size: 0.75rem; }
  .field-key { color: var(--ext-text-faint); }
  .field-val { color: var(--ext-text); font-family: monospace; }
  .correlation {
    display: inline-block;
    margin-top: 0.15rem;
    margin-right: 0.5rem;
    font-size: 0.75rem;
    color: var(--ext-text-muted);
  }
</style>
