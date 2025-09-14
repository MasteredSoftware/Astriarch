# TradingCenterView Component

## Overview

The `TradingCenterView.svelte` component provides a comprehensive interface for the Galactic Trading Center, allowing players to buy and sell resources (Food, Ore, Iridium) in real-time. This component was built based on the Figma design specifications and integrates seamlessly with the Astriarch engine's trading system.

## Features

### Core Functionality
- **Resource Trading**: Buy and sell Food, Ore, and Iridium
- **Real-time Pricing**: Dynamic price calculation based on supply and demand
- **Trade Management**: Submit, track, and cancel trades
- **Resource Overview**: View player stockpiles and trading center inventory
- **Visual Progress Bars**: Intuitive resource amount visualization

### User Interface
- **Responsive Design**: Adapts to different screen sizes
- **Figma-Based Styling**: Matches the design system specifications
- **Interactive Controls**: Slider-based amount selection, toggle buttons
- **Real-time Updates**: Reactive state management with Svelte stores

## Component Structure

### Props
The component doesn't accept external props but relies on global stores:
- `$clientGameModel` - Main game state
- `$selectedPlanet` - Currently selected planet

### Key State Variables
```typescript
// Trading configuration
let selectedTradeType: TradeType = TradeType.BUY;
let selectedResourceType: TradingCenterResourceType = TradingCenterResourceType.FOOD;
let tradeAmount = 0;
let estimatedCost = 0;
```

### Reactive Calculations
- **playerTotalResources**: Player's total resources including pending trades
- **resourcePrices**: Current market prices for all resources
- **maxTradeAmount**: Maximum allowed trade amount based on availability
- **estimatedCost**: Real-time cost calculation for current trade

## Usage

### Integration
The component is already integrated into the main game interface via the navigation:

```svelte
<!-- In +page.svelte -->
{:else if $currentView === 'trading'}
    <div class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm">
        <TradingCenterView />
    </div>
{/if}
```

### Navigation Access
Players can access the trading center through the bottom navigation bar by clicking the "Trading" button.

### Prerequisites
For the trading center to function properly, ensure:
1. **Game State**: A valid `$clientGameModel` with trading center data
2. **Planet Selection**: A selected planet (`$selectedPlanet`)
3. **WebSocket Connection**: Active connection for trade submission
4. **Engine Integration**: Proper trading center data from the backend

## Trade Workflow

### 1. Resource Selection
```svelte
<!-- Resource cards for selection -->
<button on:click={() => selectResource(TradingCenterResourceType.FOOD)}>
    <span>Food</span>
</button>
```

### 2. Trade Type Selection
```svelte
<!-- Buy/Sell toggle -->
<button on:click={() => selectTradeType(TradeType.BUY)}>Buy</button>
<button on:click={() => selectTradeType(TradeType.SELL)}>Sell</button>
```

### 3. Amount Selection
```svelte
<!-- Slider for amount selection -->
<input type="range" min="0" max={maxTradeAmount} bind:value={tradeAmount} />
```

### 4. Trade Submission
```svelte
<!-- Submit button with validation -->
<button disabled={tradeAmount <= 0 || !currentPlanet} on:click={submitTrade}>
    Submit Trade
</button>
```

### 5. Trade Management
```svelte
<!-- Active trades list with cancellation -->
{#each tradingCenter.mainPlayerTrades as trade, index}
    <button on:click={() => retractTrade(index)}>Cancel</button>
{/each}
```

## Engine Integration

### Trading Center Data
The component expects a `ClientTradingCenter` object with:
```typescript
interface ClientTradingCenter {
    energyAmount: number;
    foodResource: TradingCenterResource;
    oreResource: TradingCenterResource;
    iridiumResource: TradingCenterResource;
    mainPlayerTrades: TradeData[];
}
```

### Resource Data Structure
```typescript
interface TradingCenterResource {
    amount: number;
    currentPrice: number;
    tradeAmountMax: number;
    desiredAmount: number;
}
```

### Trade Data
```typescript
interface TradeData {
    playerId: number;
    planetId: number;
    tradeType: TradeType;
    resourceType: TradingCenterResourceType;
    amount: number;
}
```

## WebSocket Communication

### Trade Submission
```typescript
webSocketService.submitTrade(trade);
```

### Trade Cancellation
```typescript
webSocketService.cancelTrade(index, planetId);
```

### Message Handling
The component handles trade responses:
- `MESSAGE_TYPE.SUBMIT_TRADE` - Trade submission results
- `MESSAGE_TYPE.CANCEL_TRADE` - Trade cancellation confirmations

## Styling and Design

### Color Scheme
- **Primary**: Cyan accents (`#00FFFF`)
- **Background**: Dark gradients (`from-slate-900/90 to-slate-800/90`)
- **Resources**: Color-coded resource icons
  - Food: Orange (`bg-orange-500`)
  - Ore: Amber (`bg-amber-600`)
  - Iridium: Purple (`bg-purple-500`)

### Typography
- **Font**: Orbitron for headings and labels
- **Sizes**: Responsive text scaling
- **Weight**: Bold for emphasis, normal for data

### Layout
- **Left Panel**: Resource overview (364px fixed width)
- **Right Panel**: Trading interface (flexible)
- **Bottom**: Floating submit button and trade list

## Error Handling

### Validation
- **Amount Validation**: Prevents invalid trade amounts
- **Resource Availability**: Checks trading center stock
- **Player Resources**: Validates player has enough resources to sell

### Error Display
- Toast notifications for trade errors
- Disabled states for invalid actions
- Clear error messaging

## Performance Considerations

### Reactive Updates
- Efficient reactive statements for calculations
- Minimal re-renders with proper dependencies
- Optimized store subscriptions

### Memory Management
- No memory leaks with proper cleanup
- Efficient data structures for trade tracking

## Testing

### Component Testing
Test scenarios should include:
- Resource selection and switching
- Trade type toggling
- Amount validation and limits
- Trade submission and cancellation
- Error state handling

### Integration Testing
- WebSocket message flow
- Store state updates
- Engine data synchronization

## Future Enhancements

### Potential Features
- **Trade History**: Historical trade tracking
- **Price Charts**: Visual price trend analysis
- **Trade Alerts**: Notifications for price changes
- **Bulk Trading**: Multiple resource trades
- **Trade Presets**: Saved trade configurations

### Performance Optimizations
- Virtual scrolling for large trade lists
- Debounced calculations for slider changes
- Cached resource calculations

## Troubleshooting

### Common Issues

1. **Trading Center Not Loading**
   - Check `$clientGameModel.clientTradingCenter` exists
   - Verify WebSocket connection
   - Ensure backend trading center implementation

2. **Trades Not Submitting**
   - Check WebSocket connection status
   - Verify `submitTrade` method implementation
   - Check MESSAGE_TYPE constants

3. **Price Calculations Wrong**
   - Verify engine trading center calculations
   - Check resource data structure
   - Ensure proper reactive dependencies

### Debug Information
Enable debug logs to trace:
- Trade submission attempts
- WebSocket message flow
- Resource calculation updates
- Store state changes

## Dependencies

### Required Packages
- `astriarch-engine` - Trading center logic and types
- `svelte` - Component framework
- WebSocket service - Network communication

### Store Dependencies
- `clientGameModel` - Game state management
- `selectedPlanet` - Planet selection state
- `webSocketService` - Network communication

## Conclusion

The TradingCenterView component provides a complete trading interface that integrates seamlessly with the Astriarch game engine. It offers intuitive controls, real-time updates, and robust error handling while maintaining the game's visual design standards.
