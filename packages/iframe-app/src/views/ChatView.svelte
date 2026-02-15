<script lang="ts">
  import type { DirectMessage, GTStoreManager } from '@flotilla/ext-shared';
  import { timeAgo, truncate } from '../lib/utils.js';

  type Props = {
    messages: DirectMessage[];
    stores: GTStoreManager;
    userPubkey?: string;
  };

  const { messages, stores, userPubkey }: Props = $props();

  let messageInput = $state('');
  let recipientInput = $state('');
  let sending = $state(false);
  let sendError = $state<string | null>(null);

  /** Group messages into conversations by the other party's pubkey. */
  const conversations = $derived.by(() => {
    // If we don't have a userPubkey, we can't properly group conversations
    if (!userPubkey) return [];

    const convMap = new Map<string, { pubkey: string; messages: DirectMessage[]; lastTs: number }>();

    for (const msg of messages) {
      // The "other party" is whoever isn't us
      const otherPubkey = msg.pubkey === userPubkey
        ? (msg.recipientPubkey ?? 'unknown')
        : msg.pubkey;

      // Skip messages with unknown recipients
      if (otherPubkey === 'unknown') continue;

      let conv = convMap.get(otherPubkey);
      if (!conv) {
        conv = { pubkey: otherPubkey, messages: [], lastTs: 0 };
        convMap.set(otherPubkey, conv);
      }
      conv.messages.push(msg);
      if (msg.created_at > conv.lastTs) conv.lastTs = msg.created_at;
    }

    // Sort conversations by most recent message
    return Array.from(convMap.values()).sort((a, b) => b.lastTs - a.lastTs);
  });

  let selectedConversation = $state<string | null>(null);

  const activeMessages = $derived.by(() => {
    if (!selectedConversation) return [];
    const conv = conversations.find(c => c.pubkey === selectedConversation);
    return conv?.messages ?? [];
  });

  function shortPubkey(pk: string): string {
    if (pk.length <= 16) return pk;
    return `${pk.slice(0, 8)}…${pk.slice(-8)}`;
  }

  async function handleSend() {
    const content = messageInput.trim();
    const recipient = selectedConversation ?? recipientInput.trim();
    if (!content || !recipient) return;

    sending = true;
    sendError = null;

    try {
      await stores.sendDM(recipient, content);
      messageInput = '';
      if (!selectedConversation) {
        recipientInput = '';
        selectedConversation = recipient;
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    } finally {
      sending = false;
    }
  }

  function startNewConversation() {
    selectedConversation = null;
  }
</script>

<section class="view">
  <div class="view-header">
    <h2>💬 Direct Messages</h2>
    <span class="live-badge">● live</span>
  </div>

  {#if !userPubkey}
    <div class="info-banner">
      <p>Direct messages require user authentication. Please ensure the host provides a user pubkey.</p>
    </div>
  {:else}
    <div class="chat-layout">
    <!-- Conversation list sidebar -->
    <div class="conv-sidebar">
      <button class="new-conv-btn" onclick={startNewConversation}>
        + New conversation
      </button>

      {#if conversations.length === 0}
        <p class="empty-sidebar">No conversations yet.</p>
      {:else}
        {#each conversations as conv (conv.pubkey)}
          <button
            class="conv-item"
            class:active={selectedConversation === conv.pubkey}
            onclick={() => { selectedConversation = conv.pubkey; }}
          >
            <span class="conv-pubkey">{shortPubkey(conv.pubkey)}</span>
            <span class="conv-preview">
              {truncate(conv.messages[conv.messages.length - 1]?.content ?? '', 40)}
            </span>
            <span class="conv-time">{timeAgo(conv.lastTs)}</span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Message area -->
    <div class="msg-area">
      {#if selectedConversation === null}
        <!-- New conversation form -->
        <div class="new-conv-form">
          <h3>Start a new conversation</h3>
          <label class="field-label">
            Recipient pubkey (hex):
            <input
              type="text"
              class="pubkey-input"
              bind:value={recipientInput}
              placeholder="Enter recipient's hex pubkey..."
            />
          </label>
        </div>
      {:else}
        <div class="msg-header">
          <span class="msg-recipient">🔑 {shortPubkey(selectedConversation)}</span>
        </div>
      {/if}

      <div class="msg-list">
        {#if activeMessages.length === 0 && selectedConversation}
          <p class="empty">No messages in this conversation yet.</p>
        {/if}
        {#each activeMessages as msg (msg.id)}
          <div class="msg-bubble" class:outgoing={msg.pubkey === userPubkey}>
            <div class="msg-content">{msg.content}</div>
            <div class="msg-meta">
              <span class="msg-sender">
                {msg.pubkey === userPubkey ? 'You' : shortPubkey(msg.pubkey)}
              </span>
              <span class="msg-time">{timeAgo(msg.created_at)}</span>
            </div>
          </div>
        {/each}
      </div>

      {#if sendError}
        <div class="send-error">{sendError}</div>
      {/if}

      <form class="msg-compose" onsubmit={(e) => { e.preventDefault(); void handleSend(); }}>
        <input
          type="text"
          class="msg-input"
          bind:value={messageInput}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button type="submit" class="send-btn" disabled={sending || !messageInput.trim()}>
          {sending ? '…' : '➤'}
        </button>
      </form>
    </div>
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

  .chat-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    min-height: 400px;
  }

  /* Sidebar */
  .conv-sidebar {
    background: #f8f9fa;
    border-right: 1px solid #dee2e6;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .new-conv-btn {
    padding: 0.6rem 0.75rem;
    background: none;
    border: none;
    border-bottom: 1px solid #dee2e6;
    cursor: pointer;
    font-size: 0.85rem;
    color: #007bff;
    text-align: left;
    font-weight: 600;
  }
  .new-conv-btn:hover { background: #e9ecef; }

  .empty-sidebar {
    padding: 1rem;
    color: #999;
    font-size: 0.8rem;
    text-align: center;
  }

  .conv-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.6rem 0.75rem;
    background: none;
    border: none;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .conv-item:hover { background: #e9ecef; }
  .conv-item.active { background: #d1ecf1; }

  .conv-pubkey {
    font-size: 0.75rem;
    font-weight: 600;
    color: #333;
    font-family: monospace;
  }

  .conv-preview {
    font-size: 0.75rem;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conv-time {
    font-size: 0.7rem;
    color: #999;
  }

  /* Message area */
  .msg-area {
    display: flex;
    flex-direction: column;
    background: white;
  }

  .msg-header {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
  }

  .msg-recipient {
    font-size: 0.8rem;
    font-family: monospace;
    color: #555;
  }

  .new-conv-form {
    padding: 1rem;
    border-bottom: 1px solid #eee;
  }
  .new-conv-form h3 { margin: 0 0 0.5rem; font-size: 1rem; }
  .field-label { display: block; font-size: 0.8rem; color: #555; }
  .pubkey-input {
    width: 100%;
    margin-top: 0.3rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8rem;
    box-sizing: border-box;
  }

  .msg-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty {
    color: #999;
    text-align: center;
    padding: 2rem;
    font-size: 0.85rem;
  }

  .msg-bubble {
    max-width: 80%;
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    background: #f0f0f0;
    align-self: flex-start;
  }

  .msg-bubble.outgoing {
    background: #d1ecf1;
    align-self: flex-end;
  }

  .msg-content {
    font-size: 0.85rem;
    line-height: 1.4;
    word-break: break-word;
  }

  .msg-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.25rem;
    font-size: 0.7rem;
    color: #888;
  }

  .msg-sender { font-weight: 500; }

  .send-error {
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
    color: #dc3545;
    background: #f8d7da;
  }

  .msg-compose {
    display: flex;
    gap: 0;
    border-top: 1px solid #dee2e6;
  }

  .msg-input {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border: none;
    font-size: 0.85rem;
    outline: none;
  }

  .send-btn {
    padding: 0.6rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 1rem;
  }
  .send-btn:disabled { background: #adb5bd; cursor: not-allowed; }
  .send-btn:hover:not(:disabled) { background: #0056b3; }

  .info-banner {
    padding: 1rem;
    background: #d1ecf1;
    border: 1px solid #bee5eb;
    border-radius: 4px;
    color: #0c5460;
    text-align: center;
  }
  .info-banner p { margin: 0; font-size: 0.85rem; }
</style>
