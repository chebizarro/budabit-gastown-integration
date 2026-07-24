<script lang="ts">
  import type { ParsedGTEvent, GroupDefContent } from '@flotilla/ext-shared';
  import { timeAgo } from '../lib/utils.js';

  type Props = {
    groups: ParsedGTEvent<GroupDefContent>[];
  };

  const { groups }: Props = $props();

  function shortPubkey(pk: string): string {
    if (pk.length <= 16) return pk;
    return `${pk.slice(0, 8)}…${pk.slice(-8)}`;
  }
</script>

<section class="view">
  <div class="view-header">
    <h2>👥 Groups</h2>
    <div class="header-right">
      <span class="count">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
      <span class="live-badge">● live</span>
    </div>
  </div>

  {#if groups.length === 0}
    <p class="empty">No groups defined yet.</p>
  {:else}
    <div class="group-grid">
      {#each groups as group (group.dTag ?? group.raw.id)}
        {@const data = group.data}
        <div class="group-card">
          <div class="card-header">
            <span class="group-icon">👥</span>
            <span class="group-name">{data?.name ?? group.dTag ?? 'Unnamed'}</span>
            <span class="member-count">{data?.members?.length ?? 0} members</span>
          </div>
          <div class="card-body">
            {#if data?.members && data.members.length > 0}
              <div class="members-list">
                {#each data.members.slice(0, 8) as member}
                  <span class="member-tag">{shortPubkey(member)}</span>
                {/each}
                {#if data.members.length > 8}
                  <span class="more-members">+{data.members.length - 8} more</span>
                {/if}
              </div>
            {/if}
            <div class="card-footer">
              {#if data?.created_by}
                <span class="field">Created by: {shortPubkey(data.created_by)}</span>
              {/if}
              {#if data?.updated_at}
                <span class="field">Updated {timeAgo(Math.floor(new Date(data.updated_at).getTime() / 1000))}</span>
              {/if}
            </div>
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
  .header-right { display: flex; gap: 0.75rem; align-items: center; }
  .count { font-size: 0.8rem; color: var(--ext-text-secondary); }
  .live-badge {
    font-size: 0.75rem;
    color: var(--ext-success);
    font-weight: 600;
  }
  .empty { color: var(--ext-text-faint); text-align: center; padding: 2rem; }

  .group-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 0.75rem;
  }

  .group-card {
    background: var(--ext-surface-2);
    border: 1px solid var(--ext-border-subtle);
    border-radius: 8px;
    padding: 0.75rem;
    transition: border-color 0.2s;
  }
  .group-card:hover { border-color: var(--ext-text-faint); }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .group-icon { font-size: 1.3rem; }
  .group-name { font-weight: 600; flex: 1; font-size: 0.95rem; }

  .member-count {
    font-size: 0.75rem;
    color: var(--ext-text-muted);
    background: var(--ext-surface-3);
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
  }

  .members-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }

  .member-tag {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    background: var(--ext-info-bg);
    color: var(--ext-info-text);
    border-radius: 3px;
    font-size: 0.7rem;
    font-family: monospace;
  }

  .more-members {
    font-size: 0.7rem;
    color: var(--ext-text-faint);
    padding: 0.15rem 0.4rem;
  }

  .card-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-top: 1px solid var(--ext-border-subtle);
    padding-top: 0.4rem;
  }

  .field {
    font-size: 0.75rem;
    color: var(--ext-text-faint);
  }
</style>
