<script lang="ts">
  import { gameStore, type ChatMessage } from '../../stores/gameStore.new';
  import { webSocketService } from '../../services/websocket';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  
  let chatInput = '';
  let chatContainer: HTMLDivElement;
  
  // Get chat messages from store
  $: chatMessages = $gameStore.chatMessages;
  $: showChat = $gameStore.showChat;
  
  // Auto-scroll to bottom when new messages arrive
  $: if (chatMessages.length > 0 && chatContainer) {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 0);
  }
  
  function sendMessage() {
    if (!chatInput.trim()) return;
    
    webSocketService.sendChatMessage(chatInput.trim());
    chatInput = '';
  }
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function closeChat() {
    gameStore.toggleChat();
  }
  
  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }
  
  function getMessageClass(message: ChatMessage): string {
    const isOwnMessage = message.playerId === $gameStore.currentPlayer;
    return isOwnMessage ? 'own-message' : 'other-message';
  }
</script>

{#if showChat}
  <div class="chat-overlay">
    <Card class="chat-panel">
      <div class="chat-header">
        <h3>Game Chat</h3>
        <Button variant="secondary" size="small" on:click={closeChat}>×</Button>
      </div>
      
      <div class="chat-content">
        <div class="chat-messages" bind:this={chatContainer}>
          {#each chatMessages as message}
            <div class="message {getMessageClass(message)}">
              <div class="message-header">
                <span class="message-player">{message.playerName}</span>
                <span class="message-time">{formatTime(message.timestamp)}</span>
              </div>
              <div class="message-content">{message.message}</div>
            </div>
          {/each}
          
          {#if chatMessages.length === 0}
            <div class="no-messages">
              <p>No messages yet. Start a conversation!</p>
            </div>
          {/if}
        </div>
        
        <div class="chat-input-section">
          <div class="input-group">
            <input
              type="text"
              bind:value={chatInput}
              on:keypress={handleKeyPress}
              placeholder="Type your message..."
              class="chat-input"
              maxlength="200"
            />
            <Button 
              on:click={sendMessage} 
              disabled={!chatInput.trim()}
              size="small"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
{/if}

<style>
  .chat-overlay {
    position: fixed;
    top: 60px;
    right: 20px;
    width: 350px;
    height: 400px;
    z-index: 1000;
  }
  
  .chat-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background);
    border: 2px solid var(--border);
  }
  
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
    flex-shrink: 0;
  }
  
  .chat-header h3 {
    margin: 0;
    color: var(--foreground);
    font-size: 1rem;
  }
  
  .chat-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .message {
    padding: 0.5rem;
    border-radius: 8px;
    max-width: 85%;
  }
  
  .own-message {
    align-self: flex-end;
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .other-message {
    align-self: flex-start;
    background: var(--muted);
    color: var(--foreground);
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
    font-size: 0.8rem;
  }
  
  .message-player {
    font-weight: 600;
  }
  
  .message-time {
    opacity: 0.7;
  }
  
  .message-content {
    font-size: 0.9rem;
    line-height: 1.3;
    word-wrap: break-word;
  }
  
  .no-messages {
    text-align: center;
    color: var(--muted-foreground);
    margin-top: 2rem;
  }
  
  .no-messages p {
    margin: 0;
    font-style: italic;
  }
  
  .chat-input-section {
    padding: 0.75rem;
    border-top: 1px solid var(--border);
    background: var(--muted);
    flex-shrink: 0;
  }
  
  .input-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .chat-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--foreground);
    font-size: 0.9rem;
  }
  
  .chat-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
  }
  
  .chat-input::placeholder {
    color: var(--muted-foreground);
  }
  
  /* Scrollbar styling */
  .chat-messages::-webkit-scrollbar {
    width: 6px;
  }
  
  .chat-messages::-webkit-scrollbar-track {
    background: var(--muted);
  }
  
  .chat-messages::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  
  .chat-messages::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }
</style>