<script lang="ts">
  import { gameStore, type Notification } from '../../stores/gameStore';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  
  // Get notifications from store
  $: notifications = $gameStore.notifications;
  $: showNotifications = $gameStore.showNotifications;
  
  function closeNotifications() {
    gameStore.toggleNotifications();
  }
  
  function dismissNotification(notificationId: string) {
    gameStore.dismissNotification(notificationId);
  }
  
  function clearAllNotifications() {
    gameStore.clearNotifications();
  }
  
  function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) { // Less than 1 minute
      return 'just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }
  
  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'battle': return '⚔️';
      case 'research': return '🔬';
      case 'construction': return '🏗️';
      case 'fleet': return '🚁';
      case 'planet': return '🌍';
      case 'diplomacy': return '🤝';
      default: return 'ℹ️';
    }
  }
  
  function getNotificationClass(type: string): string {
    switch (type) {
      case 'error': return 'notification-error';
      case 'warning': return 'notification-warning';
      case 'success': return 'notification-success';
      case 'battle': return 'notification-battle';
      case 'research': return 'notification-research';
      case 'construction': return 'notification-construction';
      case 'fleet': return 'notification-fleet';
      case 'planet': return 'notification-planet';
      case 'diplomacy': return 'notification-diplomacy';
      default: return 'notification-info';
    }
  }
  
  // Sort notifications by newest first
  $: sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
  
  // Group notifications by type for summary
  $: notificationCounts = notifications.reduce((counts, notification) => {
    counts[notification.type] = (counts[notification.type] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
</script>

{#if showNotifications}
  <div class="notifications-overlay">
    <Card class="notifications-panel">
      <div class="notifications-header">
        <div class="header-content">
          <h3>Notifications</h3>
          <span class="notification-count">({notifications.length})</span>
        </div>
        <div class="header-actions">
          {#if notifications.length > 0}
            <Button variant="secondary" size="small" on:click={clearAllNotifications}>
              Clear All
            </Button>
          {/if}
          <Button variant="secondary" size="small" on:click={closeNotifications}>×</Button>
        </div>
      </div>
      
      <div class="notifications-content">
        {#if notifications.length > 0}
          <!-- Notification Summary -->
          {#if Object.keys(notificationCounts).length > 1}
            <div class="notification-summary">
              <h4>Summary</h4>
              <div class="summary-grid">
                {#each Object.entries(notificationCounts) as [type, count]}
                  <div class="summary-item {getNotificationClass(type)}">
                    <span class="summary-icon">{getNotificationIcon(type)}</span>
                    <span class="summary-type">{type}</span>
                    <span class="summary-count">{count}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          <!-- Notifications List -->
          <div class="notifications-list">
            {#each sortedNotifications as notification}
              <div class="notification-item {getNotificationClass(notification.type)}">
                <div class="notification-content">
                  <div class="notification-header">
                    <span class="notification-icon">{getNotificationIcon(notification.type)}</span>
                    <span class="notification-type">{notification.type.toUpperCase()}</span>
                    <span class="notification-time">{formatTime(notification.timestamp)}</span>
                  </div>
                  <div class="notification-message">{notification.message}</div>
                  {#if notification.actionText && notification.actionType}
                    <div class="notification-action">
                      <Button size="small" variant="secondary">
                        {notification.actionText}
                      </Button>
                    </div>
                  {/if}
                </div>
                <Button 
                  variant="ghost" 
                  size="small" 
                  on:click={() => dismissNotification(notification.id)}
                  class="dismiss-button"
                >
                  ×
                </Button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-notifications">
            <div class="no-notifications-icon">🔔</div>
            <h4>No Notifications</h4>
            <p>You're all caught up! New game events will appear here.</p>
          </div>
        {/if}
      </div>
    </Card>
  </div>
{/if}

<style>
  .notifications-overlay {
    position: fixed;
    top: 60px;
    right: 380px; /* Position next to chat panel */
    width: 400px;
    max-height: 500px;
    z-index: 1000;
  }
  
  .notifications-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background);
    border: 2px solid var(--border);
  }
  
  .notifications-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
    flex-shrink: 0;
  }
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .notifications-header h3 {
    margin: 0;
    color: var(--foreground);
    font-size: 1rem;
  }
  
  .notification-count {
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .notifications-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
  }
  
  .notification-summary {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  
  .notification-summary h4 {
    margin: 0 0 0.5rem 0;
    color: var(--foreground);
    font-size: 0.9rem;
  }
  
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 0.5rem;
  }
  
  .summary-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
  }
  
  .summary-icon {
    font-size: 1.2rem;
    margin-bottom: 0.25rem;
  }
  
  .summary-type {
    text-transform: capitalize;
    font-weight: 600;
    margin-bottom: 0.125rem;
  }
  
  .summary-count {
    font-weight: 700;
  }
  
  .notifications-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 8px;
    border-left: 4px solid;
  }
  
  .notification-content {
    flex: 1;
  }
  
  .notification-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .notification-icon {
    font-size: 1rem;
  }
  
  .notification-type {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .notification-time {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--muted-foreground);
  }
  
  .notification-message {
    font-size: 0.9rem;
    line-height: 1.3;
    color: var(--foreground);
    margin-bottom: 0.5rem;
  }
  
  .notification-action {
    margin-top: 0.5rem;
  }
  
  .dismiss-button {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
  }
  
  .no-notifications {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--muted-foreground);
  }
  
  .no-notifications-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .no-notifications h4 {
    margin: 0 0 0.5rem 0;
    color: var(--foreground);
  }
  
  .no-notifications p {
    margin: 0;
    font-size: 0.9rem;
  }
  
  /* Notification Type Styles */
  .notification-error {
    background: rgba(239, 68, 68, 0.1);
    border-left-color: #ef4444;
  }
  
  .notification-warning {
    background: rgba(245, 158, 11, 0.1);
    border-left-color: #f59e0b;
  }
  
  .notification-success {
    background: rgba(34, 197, 94, 0.1);
    border-left-color: #22c55e;
  }
  
  .notification-battle {
    background: rgba(220, 38, 127, 0.1);
    border-left-color: #dc2626;
  }
  
  .notification-research {
    background: rgba(147, 51, 234, 0.1);
    border-left-color: #9333ea;
  }
  
  .notification-construction {
    background: rgba(59, 130, 246, 0.1);
    border-left-color: #3b82f6;
  }
  
  .notification-fleet {
    background: rgba(14, 165, 233, 0.1);
    border-left-color: #0ea5e9;
  }
  
  .notification-planet {
    background: rgba(34, 197, 94, 0.1);
    border-left-color: #22c55e;
  }
  
  .notification-diplomacy {
    background: rgba(168, 85, 247, 0.1);
    border-left-color: #a855f7;
  }
  
  .notification-info {
    background: rgba(99, 102, 241, 0.1);
    border-left-color: #6366f1;
  }
  
  /* Scrollbar styling */
  .notifications-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .notifications-content::-webkit-scrollbar-track {
    background: var(--muted);
  }
  
  .notifications-content::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  
  .notifications-content::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }
</style>