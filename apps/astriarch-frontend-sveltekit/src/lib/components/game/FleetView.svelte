<script lang="ts">
  import { gameStore, currentFleet, playerPlanets } from '../../stores/gameStore';
  import { webSocketService } from '../../services/websocket';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  
  let selectedFleet = null;
  let planets = [];
  let targetPlanetId = '';
  let fleetOrders = 'attack';
  let showSendDialog = false;
  
  // Ship allocation for sending
  let sendShips = {
    scouts: 0,
    destroyers: 0,
    cruisers: 0,
    battleships: 0
  };
  
  // Subscribe to stores
  currentFleet.subscribe(fleet => {
    selectedFleet = fleet;
  });
  
  playerPlanets.subscribe(playerPlanetsList => {
    planets = playerPlanetsList;
  });
  
  const SHIP_TYPES = {
    scouts: { name: 'Scout', icon: '🔍', description: 'Fast reconnaissance ship' },
    destroyers: { name: 'Destroyer', icon: '🚢', description: 'Basic combat vessel' },
    cruisers: { name: 'Cruiser', icon: '⚓', description: 'Heavy combat ship' },
    battleships: { name: 'Battleship', icon: '🚁', description: 'Powerful capital ship' }
  };
  
  const ORDER_TYPES = {
    attack: { name: 'Attack', icon: '⚔️', description: 'Attack enemy forces' },
    colonize: { name: 'Colonize', icon: '🏴', description: 'Establish colony on neutral planet' },
    reinforce: { name: 'Reinforce', icon: '🛡️', description: 'Support friendly forces' }
  };
  
  function openSendDialog() {
    if (!selectedFleet) return;
    
    // Reset send ships to fleet's current ships
    sendShips = { ...selectedFleet.ships };
    targetPlanetId = '';
    fleetOrders = 'attack';
    showSendDialog = true;
  }
  
  function closeSendDialog() {
    showSendDialog = false;
  }
  
  function sendFleet() {
    if (!selectedFleet || !targetPlanetId) return;
    
    const totalShips = Object.values(sendShips).reduce((sum, count) => sum + count, 0);
    if (totalShips === 0) {
      gameStore.addNotification({
        type: 'error',
        message: 'Must select at least one ship to send',
        timestamp: Date.now()
      });
      return;
    }
    
    // For now, we'll use the current position as the source
    // In a real implementation, this would be the planet the fleet is currently at
    const sourcePlanet = planets[0]; // Temporary - should find actual source
    
    webSocketService.sendFleet(
      sourcePlanet?.id || 'temp_source',
      targetPlanetId,
      sendShips,
      fleetOrders
    );
    
    closeSendDialog();
  }
  
  function adjustShipCount(shipType: string, change: number) {
    const current = sendShips[shipType as keyof typeof sendShips];
    const fleetMax = selectedFleet?.ships[shipType as keyof typeof selectedFleet.ships] || 0;
    const newValue = Math.max(0, Math.min(fleetMax, current + change));
    
    sendShips = {
      ...sendShips,
      [shipType]: newValue
    };
  }
  
  function setMaxShips(shipType: string) {
    const fleetMax = selectedFleet?.ships[shipType as keyof typeof selectedFleet.ships] || 0;
    sendShips = {
      ...sendShips,
      [shipType]: fleetMax
    };
  }
  
  function setAllShips() {
    if (!selectedFleet) return;
    sendShips = { ...selectedFleet.ships };
  }
</script>

<div class="fleet-view">
  {#if selectedFleet}
    <Card class="fleet-header">
      <div class="header-content">
        <h1>🚁 Fleet {selectedFleet.id}</h1>
        <div class="fleet-status">
          <span class="status-badge status-{selectedFleet.status}">
            {selectedFleet.status.replace('_', ' ').toUpperCase()}
          </span>
          <span class="fleet-orders">Orders: {selectedFleet.orders}</span>
        </div>
      </div>
    </Card>
    
    <div class="fleet-content">
      <!-- Fleet Information -->
      <Card class="fleet-info">
        <h2>Fleet Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Owner:</span>
            <span class="value">{selectedFleet.playerName || selectedFleet.playerId}</span>
          </div>
          <div class="info-item">
            <span class="label">Position:</span>
            <span class="value">({selectedFleet.position.x}, {selectedFleet.position.y})</span>
          </div>
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value">{selectedFleet.status}</span>
          </div>
          <div class="info-item">
            <span class="label">Current Orders:</span>
            <span class="value">{selectedFleet.orders}</span>
          </div>
          {#if selectedFleet.destination}
            <div class="info-item">
              <span class="label">Destination:</span>
              <span class="value">Planet {selectedFleet.destination.planetId}</span>
            </div>
            <div class="info-item">
              <span class="label">ETA:</span>
              <span class="value">{new Date(selectedFleet.destination.arrivalTime).toLocaleString()}</span>
            </div>
          {/if}
        </div>
      </Card>
      
      <!-- Ship Composition -->
      <Card class="ship-composition">
        <h2>Ship Composition</h2>
        <div class="ships-grid">
          {#each Object.entries(SHIP_TYPES) as [shipType, shipInfo]}
            {@const count = selectedFleet.ships[shipType] || 0}
            <div class="ship-item" class:empty={count === 0}>
              <div class="ship-icon">{shipInfo.icon}</div>
              <div class="ship-details">
                <h3>{shipInfo.name}</h3>
                <p>{shipInfo.description}</p>
                <div class="ship-count">{count} ships</div>
              </div>
            </div>
          {/each}
        </div>
        
        <div class="fleet-total">
          <strong>Total Ships: {Object.values(selectedFleet.ships).reduce((sum, count) => sum + count, 0)}</strong>
        </div>
      </Card>
      
      <!-- Fleet Actions -->
      <Card class="fleet-actions">
        <h2>Fleet Commands</h2>
        <div class="actions-grid">
          <Button on:click={openSendDialog} disabled={selectedFleet.status !== 'arrived'}>
            📤 Send Fleet
          </Button>
          <Button variant="secondary" disabled>
            🔄 Change Orders
          </Button>
          <Button variant="secondary" disabled>
            ⏸️ Hold Position
          </Button>
          <Button variant="destructive" disabled>
            💥 Scuttle Fleet
          </Button>
        </div>
        
        {#if selectedFleet.status !== 'arrived'}
          <div class="action-note">
            <p>⚠️ Fleet must be at a planet to issue new orders</p>
          </div>
        {/if}
      </Card>
    </div>
  {:else}
    <div class="no-fleet">
      <Card>
        <div class="no-fleet-content">
          <h2>No Fleet Selected</h2>
          <p>Select a fleet from the galaxy map or sidebar to view its details and issue commands.</p>
        </div>
      </Card>
    </div>
  {/if}
</div>

<!-- Send Fleet Dialog -->
{#if showSendDialog && selectedFleet}
  <div class="dialog-overlay">
    <Card class="send-dialog">
      <div class="dialog-header">
        <h2>Send Fleet {selectedFleet.id}</h2>
        <Button variant="secondary" size="small" on:click={closeSendDialog}>✕</Button>
      </div>
      
      <div class="dialog-content">
        <!-- Destination Selection -->
        <div class="form-section">
          <h3>Destination</h3>
          <select bind:value={targetPlanetId} class="destination-select">
            <option value="">Select destination planet...</option>
            {#each planets as planet}
              <option value={planet.id}>
                Planet {planet.id} - Pop: {planet.population}
              </option>
            {/each}
          </select>
        </div>
        
        <!-- Orders Selection -->
        <div class="form-section">
          <h3>Fleet Orders</h3>
          <div class="orders-grid">
            {#each Object.entries(ORDER_TYPES) as [orderKey, orderInfo]}
              <label class="order-option">
                <input 
                  type="radio" 
                  bind:group={fleetOrders} 
                  value={orderKey}
                />
                <div class="order-content">
                  <span class="order-icon">{orderInfo.icon}</span>
                  <div>
                    <div class="order-name">{orderInfo.name}</div>
                    <div class="order-description">{orderInfo.description}</div>
                  </div>
                </div>
              </label>
            {/each}
          </div>
        </div>
        
        <!-- Ship Selection -->
        <div class="form-section">
          <h3>Ships to Send</h3>
          <div class="ship-selection">
            {#each Object.entries(SHIP_TYPES) as [shipType, shipInfo]}
              {@const available = selectedFleet.ships[shipType] || 0}
              {@const selected = sendShips[shipType]}
              
              <div class="ship-selector" class:disabled={available === 0}>
                <div class="ship-selector-header">
                  <span class="ship-icon">{shipInfo.icon}</span>
                  <span class="ship-name">{shipInfo.name}</span>
                  <span class="ship-available">({available} available)</span>
                </div>
                
                <div class="ship-controls">
                  <Button 
                    size="small" 
                    variant="secondary"
                    on:click={() => adjustShipCount(shipType, -1)}
                    disabled={selected === 0}
                  >
                    -
                  </Button>
                  
                  <input 
                    type="number" 
                    min="0" 
                    max={available}
                    bind:value={sendShips[shipType]}
                    class="ship-input"
                    disabled={available === 0}
                  />
                  
                  <Button 
                    size="small" 
                    variant="secondary"
                    on:click={() => adjustShipCount(shipType, 1)}
                    disabled={selected >= available}
                  >
                    +
                  </Button>
                  
                  <Button 
                    size="small"
                    on:click={() => setMaxShips(shipType)}
                    disabled={available === 0}
                  >
                    Max
                  </Button>
                </div>
              </div>
            {/each}
          </div>
          
          <div class="selection-actions">
            <Button variant="secondary" on:click={setAllShips}>
              Select All Ships
            </Button>
            <Button variant="secondary" on:click={() => sendShips = { scouts: 0, destroyers: 0, cruisers: 0, battleships: 0 }}>
              Clear Selection
            </Button>
          </div>
        </div>
      </div>
      
      <div class="dialog-actions">
        <Button variant="secondary" on:click={closeSendDialog}>Cancel</Button>
        <Button 
          on:click={sendFleet}
          disabled={!targetPlanetId || Object.values(sendShips).reduce((sum, count) => sum + count, 0) === 0}
        >
          Send Fleet
        </Button>
      </div>
    </Card>
  </div>
{/if}

<style>
  .fleet-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
    background: var(--background);
  }
  
  .fleet-header {
    margin-bottom: 1rem;
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header-content h1 {
    margin: 0;
    color: var(--foreground);
  }
  
  .fleet-status {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .status-in_transit {
    background: var(--warning);
    color: var(--warning-foreground);
  }
  
  .status-arrived {
    background: var(--success);
    color: var(--success-foreground);
  }
  
  .status-defending {
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .fleet-orders {
    color: var(--muted-foreground);
  }
  
  .fleet-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 800px;
  }
  
  .fleet-info h2,
  .ship-composition h2,
  .fleet-actions h2 {
    margin: 0 0 1rem 0;
    color: var(--foreground);
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--muted);
    border-radius: 4px;
  }
  
  .label {
    font-weight: 600;
    color: var(--muted-foreground);
  }
  
  .value {
    color: var(--foreground);
  }
  
  .ships-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .ship-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .ship-item.empty {
    opacity: 0.5;
  }
  
  .ship-icon {
    font-size: 2rem;
    width: 60px;
    text-align: center;
  }
  
  .ship-details h3 {
    margin: 0 0 0.25rem 0;
    color: var(--foreground);
  }
  
  .ship-details p {
    margin: 0 0 0.5rem 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }
  
  .ship-count {
    font-weight: 700;
    color: var(--primary);
  }
  
  .fleet-total {
    text-align: center;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    color: var(--foreground);
  }
  
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .action-note {
    padding: 0.75rem;
    background: var(--warning);
    color: var(--warning-foreground);
    border-radius: 4px;
    text-align: center;
  }
  
  .action-note p {
    margin: 0;
  }
  
  .no-fleet {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
  
  .no-fleet-content {
    text-align: center;
    padding: 2rem;
  }
  
  .no-fleet-content h2 {
    margin: 0 0 1rem 0;
    color: var(--foreground);
  }
  
  .no-fleet-content p {
    margin: 0;
    color: var(--muted-foreground);
  }
  
  /* Dialog Styles */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .send-dialog {
    width: 90%;
    max-width: 600px;
    max-height: 90%;
    overflow-y: auto;
    background: var(--background);
  }
  
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
  }
  
  .dialog-header h2 {
    margin: 0;
    color: var(--foreground);
  }
  
  .dialog-content {
    padding: 1.5rem;
  }
  
  .form-section {
    margin-bottom: 1.5rem;
  }
  
  .form-section h3 {
    margin: 0 0 0.75rem 0;
    color: var(--foreground);
  }
  
  .destination-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--foreground);
  }
  
  .orders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }
  
  .order-option {
    display: block;
    cursor: pointer;
  }
  
  .order-option input {
    display: none;
  }
  
  .order-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    background: var(--muted);
    transition: all 0.2s;
  }
  
  .order-option input:checked + .order-content {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .order-icon {
    font-size: 1.5rem;
  }
  
  .order-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .order-description {
    font-size: 0.8rem;
    opacity: 0.8;
  }
  
  .ship-selection {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .ship-selector {
    padding: 0.75rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .ship-selector.disabled {
    opacity: 0.5;
  }
  
  .ship-selector-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .ship-name {
    font-weight: 600;
  }
  
  .ship-available {
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }
  
  .ship-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .ship-input {
    width: 80px;
    padding: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--foreground);
    text-align: center;
  }
  
  .selection-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem;
    border-top: 1px solid var(--border);
    background: var(--muted);
  }
</style>