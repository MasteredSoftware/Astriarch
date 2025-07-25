<script lang="ts">
  import { gameStore } from '../../stores/gameStore.new';
  import { webSocketService } from '../../services/websocket';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  
  // Research types and information
  const RESEARCH_TYPES = {
    attack: {
      name: 'Combat Attack',
      description: 'Increases the offensive power of all your ships',
      icon: '⚔️',
      baseCost: 100,
      category: 'Military'
    },
    defense: {
      name: 'Combat Defense', 
      description: 'Increases the defensive capabilities of all your ships and structures',
      icon: '🛡️',
      baseCost: 100,
      category: 'Military'
    },
    propulsion: {
      name: 'Propulsion Systems',
      description: 'Increases the speed and range of all your fleets',
      icon: '🚀',
      baseCost: 80,
      category: 'Technology'
    }
  };
  
  let currentPlayer: any = null;
  let researchAllocations = {
    attack: 0,
    defense: 0,
    propulsion: 0
  };
  
  // Subscribe to game state changes
  gameStore.subscribe(store => {
    if (store.gameState && store.currentPlayer) {
      currentPlayer = store.gameState.players[store.currentPlayer];
      // Initialize allocations if we have player data
      if (currentPlayer) {
        // Note: The backend doesn't currently track allocations, so we'll manage this in the frontend
        // In a real implementation, this would come from the game state
      }
    }
  });
  
  function setResearchAllocation(researchType: string, allocation: number) {
    // Ensure allocation is between 0 and 100
    allocation = Math.max(0, Math.min(100, allocation));
    
    // Update local state
    researchAllocations[researchType as keyof typeof researchAllocations] = allocation;
    
    // Send to backend
    webSocketService.setResearchAllocation(researchType, allocation);
    
    gameStore.addNotification({
      type: 'info',
      message: `${RESEARCH_TYPES[researchType as keyof typeof RESEARCH_TYPES].name} allocation set to ${allocation}%`,
      timestamp: Date.now()
    });
  }
  
  function calculateResearchCost(researchType: string, currentLevel: number): number {
    const baseInfo = RESEARCH_TYPES[researchType as keyof typeof RESEARCH_TYPES];
    return Math.floor(baseInfo.baseCost * Math.pow(1.5, currentLevel));
  }
  
  function getResearchProgress(researchType: string): number {
    // This would normally come from the backend
    // For now, we'll calculate based on allocations and time
    return Math.min(95, researchAllocations[researchType as keyof typeof researchAllocations] * 0.8);
  }
</script>

<div class="research-view">
  <Card class="research-header">
    <div class="header-content">
      <h1>🔬 Research Laboratory</h1>
      <p>Advance your civilization's technology and military capabilities</p>
    </div>
  </Card>
  
  {#if currentPlayer}
    <div class="research-content">
      <!-- Current Research Status -->
      <Card class="research-status">
        <h2>Current Research Levels</h2>
        <div class="research-levels">
          {#each Object.entries(RESEARCH_TYPES) as [researchKey, researchInfo]}
            {@const currentLevel = currentPlayer.research[researchKey] || 0}
            {@const cost = calculateResearchCost(researchKey, currentLevel)}
            {@const progress = getResearchProgress(researchKey)}
            
            <div class="research-level-item">
              <div class="research-info">
                <div class="research-icon">{researchInfo.icon}</div>
                <div class="research-details">
                  <h3>{researchInfo.name}</h3>
                  <p class="research-description">{researchInfo.description}</p>
                  <div class="research-stats">
                    <span class="current-level">Level {currentLevel}</span>
                    <span class="category">{researchInfo.category}</span>
                  </div>
                </div>
              </div>
              
              <div class="research-progress">
                <div class="progress-info">
                  <span>Progress: {progress.toFixed(1)}%</span>
                  <span>Next Level Cost: {cost} credits</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {progress}%"></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </Card>
      
      <!-- Research Allocation -->
      <Card class="allocation-card">
        <h2>Research Resource Allocation</h2>
        <p class="allocation-description">
          Allocate your research resources to different fields. Higher allocation means faster progress.
        </p>
        
        <div class="allocation-controls">
          {#each Object.entries(RESEARCH_TYPES) as [researchKey, researchInfo]}
            <div class="allocation-item">
              <div class="allocation-header">
                <span class="allocation-icon">{researchInfo.icon}</span>
                <h3>{researchInfo.name}</h3>
                <span class="allocation-value">{researchAllocations[researchKey]}%</span>
              </div>
              
              <div class="allocation-slider">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  bind:value={researchAllocations[researchKey]}
                  on:change={(e) => setResearchAllocation(researchKey, parseInt(e.target.value))}
                  class="slider"
                />
              </div>
              
              <div class="allocation-buttons">
                <Button 
                  size="small" 
                  variant="secondary"
                  on:click={() => setResearchAllocation(researchKey, 0)}
                >
                  0%
                </Button>
                <Button 
                  size="small" 
                  variant="secondary"
                  on:click={() => setResearchAllocation(researchKey, 25)}
                >
                  25%
                </Button>
                <Button 
                  size="small" 
                  variant="secondary"
                  on:click={() => setResearchAllocation(researchKey, 50)}
                >
                  50%
                </Button>
                <Button 
                  size="small" 
                  variant="default"
                  on:click={() => setResearchAllocation(researchKey, 100)}
                >
                  Max
                </Button>
              </div>
            </div>
          {/each}
        </div>
        
        <!-- Total Allocation -->
        {#if true}
          {@const totalAllocation = Object.values(researchAllocations).reduce((sum, val) => sum + val, 0)}
          <div class="total-allocation">
            <div class="total-info">
              <span>Total Allocation: {totalAllocation}%</span>
              {#if totalAllocation > 100}
                <span class="warning">⚠️ Over-allocated! Efficiency will be reduced.</span>
              {:else if totalAllocation < 50}
                <span class="hint">💡 Consider allocating more resources to research</span>
              {/if}
            </div>
          </div>
        {/if}
      </Card>
      
      <!-- Research Benefits -->
      <Card class="benefits-card">
        <h2>Research Benefits</h2>
        <div class="benefits-grid">
          <div class="benefit-item">
            <div class="benefit-icon">⚔️</div>
            <div class="benefit-content">
              <h3>Combat Attack</h3>
              <ul>
                <li>+10% ship damage per level</li>
                <li>Better battle outcomes</li>
                <li>Faster enemy ship destruction</li>
              </ul>
            </div>
          </div>
          
          <div class="benefit-item">
            <div class="benefit-icon">🛡️</div>
            <div class="benefit-content">
              <h3>Combat Defense</h3>
              <ul>
                <li>+10% damage resistance per level</li>
                <li>Stronger planetary defenses</li>
                <li>Reduced ship losses in combat</li>
              </ul>
            </div>
          </div>
          
          <div class="benefit-item">
            <div class="benefit-icon">🚀</div>
            <div class="benefit-content">
              <h3>Propulsion Systems</h3>
              <ul>
                <li>+20% fleet speed per level</li>
                <li>Longer range capabilities</li>
                <li>Faster exploration and response</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  {:else}
    <div class="no-data">
      <p>No research data available. Please ensure you're connected to the game.</p>
    </div>
  {/if}
</div>

<style>
  .research-view {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
    background: var(--background);
  }
  
  .research-header {
    margin-bottom: 1rem;
    text-align: center;
  }
  
  .header-content h1 {
    margin: 0 0 0.5rem 0;
    color: var(--foreground);
    font-size: 2rem;
  }
  
  .header-content p {
    margin: 0;
    color: var(--muted-foreground);
  }
  
  .research-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .research-status h2,
  .allocation-card h2,
  .benefits-card h2 {
    margin: 0 0 1rem 0;
    color: var(--foreground);
    font-size: 1.3rem;
  }
  
  .research-levels {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .research-level-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .research-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }
  
  .research-icon {
    font-size: 2rem;
    width: 60px;
    text-align: center;
  }
  
  .research-details h3 {
    margin: 0 0 0.25rem 0;
    color: var(--foreground);
  }
  
  .research-description {
    margin: 0 0 0.5rem 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }
  
  .research-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
  }
  
  .current-level {
    color: var(--primary);
    font-weight: 600;
  }
  
  .category {
    color: var(--muted-foreground);
  }
  
  .research-progress {
    min-width: 200px;
  }
  
  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--muted);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
  }
  
  .allocation-description {
    margin: 0 0 1.5rem 0;
    color: var(--muted-foreground);
  }
  
  .allocation-controls {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .allocation-item {
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .allocation-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .allocation-icon {
    font-size: 1.5rem;
  }
  
  .allocation-header h3 {
    flex: 1;
    margin: 0;
    color: var(--foreground);
  }
  
  .allocation-value {
    font-weight: 700;
    color: var(--primary);
    font-size: 1.1rem;
  }
  
  .allocation-slider {
    margin-bottom: 1rem;
  }
  
  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--muted);
    outline: none;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .slider:hover {
    opacity: 1;
  }
  
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
  }
  
  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    border: none;
  }
  
  .allocation-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .total-allocation {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .total-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }
  
  .warning {
    color: var(--destructive);
  }
  
  .hint {
    color: var(--muted-foreground);
    font-weight: normal;
  }
  
  .benefits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .benefit-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--muted);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  
  .benefit-icon {
    font-size: 2rem;
    width: 60px;
    text-align: center;
    flex-shrink: 0;
  }
  
  .benefit-content h3 {
    margin: 0 0 0.5rem 0;
    color: var(--foreground);
  }
  
  .benefit-content ul {
    margin: 0;
    padding-left: 1.2rem;
    color: var(--muted-foreground);
  }
  
  .benefit-content li {
    margin-bottom: 0.25rem;
    font-size: 0.9rem;
  }
  
  .no-data {
    text-align: center;
    padding: 2rem;
    color: var(--muted-foreground);
  }
</style>