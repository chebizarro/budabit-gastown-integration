<script lang="ts">
  import type { ChannelMetadata, ChannelMessage, GTStoreManager } from '@flotilla/ext-shared';
  import { timeAgo, truncate } from '../lib/utils.js';

  type Props = {
    channelsMeta: ChannelMetadata[];
    channelMessages: Map<string, ChannelMessage[]>;
    activeChannelId: string | null;
    stores: GTStoreManager;
  };

  const { channelsMeta, channelMessages, activeChannelId, stores }: Props = $props();

  let messageInput = $state('');
  let sending = $state(false);
  let sendError = $state<string | null>(null);

  /** Messages for the currently active channel, sorted chronologically. */
  const activeMessages = $derived.by(() => {
    if (!activeChannelId) return [];
    return channelMessages.get(activeChannelId) ?? [];
  });

  /** Currently selected channel metadata. */
  const activeChannel = $derived.by(() => {
    if (!activeChannelId) return null;
    return channelsMeta.find(c => c.creationEventId === activeChannelId) ?? null;
  });

  function selectChannel(channelId: string) {
    void stores.openChannel(channelId);
  }

  function deselectChannel() {
    stores.closeChannel();
  }

  async function handleSend() {
    const content = messageInput.trim();
    if (!content || !activeChannelId) return;

    sending = true;
    sendError = null;

    try {
      await stores.sendChannelMessage(activeChannelId, content);
      messageInput = '';
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    } finally {
      sending = false;
    }
  }

  function shortPubkey(pk: string): string {
    if (pk.length <= 16) return pk;
    return `${pk.slice(0, 8)}…${pk.slice(-8)}`;
  }
</script>

<section class="view">
  <div class="view-header">
    <h2>📢 Channels</h2>
    <span class="live-badge">● live</span>
  </div>

  <div class="channels-layout">
    <!-- Channel list sidebar -->
    <div class="chan-sidebar">
      {#if channelsMeta.length === 0}
        <p class="empty-sidebar">No channels found.</p>
      {:else}
        {#each channelsMeta as chan (chan.creationEventId)}
          <button
            class="chan-item"
            class:active={activeChannelId === chan.creationEventId}
            onclick={() => selectChannel(chan.creationEventId)}
          >
            <span class="chan-name"># {chan.name}</span>
            {#if chan.about}
              <span class="chan-about">{truncate(chan.about, 50)}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Channel content area -->
    <div class="chan-area">
      {#if !activeChannelId}
        <div class="no-channel">
          <p>Select a channel to view messages</p>
        </div>
      {:else}
        <div class="chan-header">
          <button class="back-btn" onclick={deselectChannel}>←</button>
          <span class="chan-title"># {activeChannel?.name ?? 'Loading...'}</span>
          {#if activeChannel?.about}
            <span class="chan-desc">{activeChannel.about}</span>
          {/if}
        </div>

        <div class="chan-messages">
          {#if activeMessages.length === 0}
            <p class="empty">No messages yet in this channel.</p>
          {:else}
            {#each activeMessages as msg (msg.id)}
              <div class="chan-msg">
                <div class="chan-msg-header">
                  <span class="chan-msg-sender">{shortPubkey(msg.pubkey)}</span>
                  <span class="chan-msg-time">{timeAgo(msg.created_at)}</span>
                </div>
                <div class="chan-msg-content">{msg.content}</div>
                {#if msg.replyToId}
                  <span class="chan-msg-reply">↩ reply</span>
                {/if}
              </div>
            {/each}
          {/if}
        </div>

        {#if sendError}
          <div class="send-error">{sendError}</div>
        {/if}

        <form class="chan-compose" onsubmit={(e) => { e.preventDefault(); void handleSend(); }}>
          <input
            type="text"
            class="chan-input"
            bind:value={messageInput}
            placeholder="Message #{activeChannel?.name ?? 'channel'}..."
            disabled={sending}
          />
          <button type="submit" class="send-btn" disabled={sending || !messageInput.trim()}>
            {sending ? '…' : '➤'}
          </button>
        </form>
      {/if}
    </div>
  </div>
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

  .channels-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 0;
    border: 1px solid var(--ext-border);
    border-radius: 8px;
    overflow: hidden;
    min-height: 400px;
  }

  /* Sidebar */
  .chan-sidebar {
    background: #2c2f33;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .empty-sidebar {
    padding: 1rem;
    color: var(--ext-text-muted);
    font-size: 0.8rem;
    text-align: center;
  }

  .chan-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    color: var(--ext-border);
  }
  .chan-item:hover { background: #34373c; }
  .chan-item.active { background: #393c43; color: var(--ext-surface); }

  .chan-name {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .chan-about {
    font-size: 0.7rem;
    color: var(--ext-text-muted);
  }

  /* Content area */
  .chan-area {
    display: flex;
    flex-direction: column;
    background: #36393f;
    color: var(--ext-border);
  }

  .no-channel {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--ext-text-muted);
    font-size: 0.9rem;
  }

  .chan-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #202225;
    background: #2f3136;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--ext-border);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }
  .back-btn:hover { background: #40444b; }

  .chan-title {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--ext-surface);
  }

  .chan-desc {
    font-size: 0.75rem;
    color: var(--ext-text-muted);
    margin-left: 0.5rem;
    border-left: 1px solid #40444b;
    padding-left: 0.5rem;
  }

  .chan-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty {
    color: var(--ext-text-muted);
    text-align: center;
    padding: 2rem;
    font-size: 0.85rem;
  }

  .chan-msg {
    padding: 0.3rem 0;
  }

  .chan-msg:hover {
    background: rgba(4, 4, 5, 0.07);
    border-radius: 4px;
  }

  .chan-msg-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .chan-msg-sender {
    font-weight: 600;
    font-size: 0.8rem;
    color: #7289da;
    font-family: monospace;
  }

  .chan-msg-time {
    font-size: 0.7rem;
    color: var(--ext-text-muted);
  }

  .chan-msg-content {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--ext-border);
    word-break: break-word;
    margin-top: 0.1rem;
  }

  .chan-msg-reply {
    font-size: 0.7rem;
    color: var(--ext-text-muted);
    font-style: italic;
  }

  .send-error {
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
    color: #f04747;
    background: rgba(240, 71, 71, 0.1);
  }

  .chan-compose {
    display: flex;
    gap: 0;
    margin: 0 0.75rem 0.75rem;
    background: #40444b;
    border-radius: 8px;
    overflow: hidden;
  }

  .chan-input {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border: none;
    font-size: 0.85rem;
    outline: none;
    background: transparent;
    color: var(--ext-border);
  }
  .chan-input::placeholder { color: var(--ext-text-muted); }

  .send-btn {
    padding: 0.6rem 1rem;
    background: #7289da;
    color: var(--ext-accent-text);
    border: none;
    cursor: pointer;
    font-size: 1rem;
  }
  .send-btn:disabled { background: #5865f2; opacity: 0.5; cursor: not-allowed; }
  .send-btn:hover:not(:disabled) { background: #677bc4; }
</style>
