<script lang="ts">
	import { onMount } from 'svelte';
	import { clientGameModel, selectedPlanet } from '$lib/stores/gameStore';
	import { webSocketService } from '$lib/services/websocket';
	import { GameModel } from 'astriarch-engine/src/engine/gameModel';
	import { TradingCenter } from 'astriarch-engine/src/engine/tradingCenter';
	import {
		TradeType,
		TradingCenterResourceType,
		type TradeData
	} from 'astriarch-engine/src/model/tradingCenter';
	import type { ClientModelData } from 'astriarch-engine/src/model/clientModel';
	import type { PlanetData } from 'astriarch-engine/src/model/planet';
	import { IconImage } from '$lib/components/astriarch';

	// Trading state
	let selectedTradeType: TradeType = TradeType.BUY;
	let selectedResourceType: TradingCenterResourceType = TradingCenterResourceType.FOOD;
	let tradeAmount = 0;
	let estimatedCost = 0;

	// Reactive calculations
	$: tradingCenter = $clientGameModel?.clientTradingCenter;
	$: mainPlayer = $clientGameModel?.mainPlayer;
	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: currentPlanet = $selectedPlanet as PlanetData | null;

	// Calculate player's total resources after pending trades
	$: playerTotalResources =
		mainPlayer && $clientGameModel
			? (() => {
					const base = GameModel.getPlayerTotalResources(mainPlayer, planets);
					// Apply pending trades impact
					if (tradingCenter?.mainPlayerTrades) {
						for (const trade of tradingCenter.mainPlayerTrades) {
							const amount = trade.tradeType === TradeType.BUY ? trade.amount : -trade.amount;
							if (trade.resourceType === TradingCenterResourceType.FOOD) {
								base.food += amount;
							} else if (trade.resourceType === TradingCenterResourceType.ORE) {
								base.ore += amount;
							} else if (trade.resourceType === TradingCenterResourceType.IRIDIUM) {
								base.iridium += amount;
							}
						}
					}
					return base;
				})()
			: { energy: 0, food: 0, ore: 0, iridium: 0, research: 0, production: 0 };

	// Calculate current resource prices
	$: resourcePrices = tradingCenter
		? {
				food: tradingCenter.foodResource.currentPrice,
				ore: tradingCenter.oreResource.currentPrice,
				iridium: tradingCenter.iridiumResource.currentPrice
			}
		: { food: 0, ore: 0, iridium: 0 };

	// Calculate max trade amounts
	$: maxTradeAmount = (() => {
		if (!tradingCenter) return 0;

		const resource = getResourceByType(selectedResourceType);
		if (!resource) return 0;

		if (selectedTradeType === TradeType.BUY) {
			// When buying: limited by trading center stockpile and trade max
			return Math.min(resource.amount, resource.tradeAmountMax);
		} else {
			// When selling: limited by player resources and trade max
			const playerAmount = getPlayerResourceAmount(selectedResourceType);
			return Math.min(playerAmount, resource.tradeAmountMax);
		}
	})();

	// Calculate estimated trade cost
	$: {
		const resource = getResourceByType(selectedResourceType);
		if (resource && tradeAmount > 0) {
			estimatedCost = resource.currentPrice * tradeAmount;
		} else {
			estimatedCost = 0;
		}
	}

	// Function to render trade amount bars (similar to research bars)
	function renderTradeAmountBars(currentAmount: number, maxAmount: number) {
		const percentage = maxAmount > 0 ? currentAmount / maxAmount : 0;
		const filledBars = Math.round(percentage * 20);
		const bars = [];
		for (let i = 0; i < 20; i++) {
			bars.push(i < filledBars);
		}
		return bars;
	}

	// Calculate trade amount bars for the selected resource
	$: tradeAmountBars = renderTradeAmountBars(tradeAmount, maxTradeAmount);

	// Function to get resource icon type for IconImage component
	function getResourceIcon(resourceType: TradingCenterResourceType): 'food' | 'ore' | 'iridium' {
		switch (resourceType) {
			case TradingCenterResourceType.FOOD:
				return 'food';
			case TradingCenterResourceType.ORE:
				return 'ore';
			case TradingCenterResourceType.IRIDIUM:
				return 'iridium';
			default:
				return 'food';
		}
	}

	// Function to get resource color for bars
	function getResourceColor(resourceType: TradingCenterResourceType): string {
		switch (resourceType) {
			case TradingCenterResourceType.FOOD:
				return 'bg-orange-500';
			case TradingCenterResourceType.ORE:
				return 'bg-amber-500';
			case TradingCenterResourceType.IRIDIUM:
				return 'bg-purple-500';
			default:
				return 'bg-orange-500';
		}
	}

	// Function to handle clicking on trade amount bars
	function handleTradeAmountBarClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const barWidth = rect.width;

		// Calculate which bar was clicked (0-19 for 20 bars)
		const barIndex = Math.floor((clickX / barWidth) * 20);
		const newAmount = Math.round(((barIndex + 1) / 20) * maxTradeAmount);

		tradeAmount = Math.min(newAmount, maxTradeAmount);
	}

	// Function to handle keyboard events on trade amount bars
	function handleTradeAmountBarKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			// For keyboard navigation, let's increment/decrement by 10% of max
			if (event.shiftKey) {
				tradeAmount = Math.max(0, tradeAmount - Math.round(maxTradeAmount * 0.1));
			} else {
				tradeAmount = Math.min(maxTradeAmount, tradeAmount + Math.round(maxTradeAmount * 0.1));
			}
		}
	}

	// Helper functions
	function getResourceByType(resourceType: TradingCenterResourceType) {
		if (!tradingCenter) return null;
		// Access resources directly from ClientTradingCenter interface
		switch (resourceType) {
			case TradingCenterResourceType.FOOD:
				return tradingCenter.foodResource;
			case TradingCenterResourceType.ORE:
				return tradingCenter.oreResource;
			case TradingCenterResourceType.IRIDIUM:
				return tradingCenter.iridiumResource;
			default:
				return null;
		}
	}

	function getPlayerResourceAmount(resourceType: TradingCenterResourceType): number {
		if (!playerTotalResources) return 0;
		switch (resourceType) {
			case TradingCenterResourceType.FOOD:
				return playerTotalResources.food;
			case TradingCenterResourceType.ORE:
				return playerTotalResources.ore;
			case TradingCenterResourceType.IRIDIUM:
				return playerTotalResources.iridium;
			default:
				return 0;
		}
	}

	function getResourceName(resourceType: TradingCenterResourceType): string {
		switch (resourceType) {
			case TradingCenterResourceType.FOOD:
				return 'Food';
			case TradingCenterResourceType.ORE:
				return 'Ore';
			case TradingCenterResourceType.IRIDIUM:
				return 'Iridium';
			default:
				return 'Unknown';
		}
	}

	function selectResource(resourceType: TradingCenterResourceType) {
		selectedResourceType = resourceType;
		tradeAmount = 0; // Reset amount when changing resource
	}

	function selectTradeType(tradeType: TradeType) {
		selectedTradeType = tradeType;
		tradeAmount = 0; // Reset amount when changing trade type
	}

	function submitTrade() {
		if (!mainPlayer || !currentPlanet || !tradingCenter || tradeAmount <= 0) {
			console.warn('Cannot submit trade: missing requirements');
			return;
		}

		try {
			// Send trade to server with individual parameters
			webSocketService.submitTrade(
				currentPlanet.id,
				selectedTradeType,
				selectedResourceType,
				tradeAmount
			);

			// Reset form
			tradeAmount = 0;

			console.log('Trade submitted:', {
				planetId: currentPlanet.id,
				tradeType: selectedTradeType,
				resourceType: selectedResourceType,
				amount: tradeAmount
			});
		} catch (error) {
			console.error('Failed to submit trade:', error);
		}
	}

	function retractTrade(trade: any) {
		if (!currentPlanet || !tradingCenter) return;

		// Check if trade has an ID (new format) or fall back to not supporting cancellation
		if (!trade.id) {
			console.warn('Cannot cancel trade: Trade missing ID (old format)');
			return;
		}

		try {
			// Send retraction to server using trade ID
			webSocketService.cancelTrade(trade.id);

			console.log('Trade cancellation requested:', trade.id);
		} catch (error) {
			console.error('Failed to retract trade:', error);
		}
	}

	// Calculate trading center amounts for display
	$: tradingCenterAmounts = tradingCenter
		? {
				food: tradingCenter.foodResource.amount,
				ore: tradingCenter.oreResource.amount,
				iridium: tradingCenter.iridiumResource.amount,
				energy: tradingCenter.energyAmount
			}
		: { food: 0, ore: 0, iridium: 0, energy: 0 };

	// Calculate resource progress bars (amount / max for visual representation)
	$: resourceProgress = (() => {
		if (!tradingCenter) return { food: 0, ore: 0, iridium: 0 };

		const maxFood = Math.max(
			tradingCenter.foodResource.amount,
			tradingCenter.foodResource.desiredAmount
		);
		const maxOre = Math.max(
			tradingCenter.oreResource.amount,
			tradingCenter.oreResource.desiredAmount
		);
		const maxIridium = Math.max(
			tradingCenter.iridiumResource.amount,
			tradingCenter.iridiumResource.desiredAmount
		);

		return {
			food: maxFood > 0 ? (tradingCenter.foodResource.amount / maxFood) * 100 : 0,
			ore: maxOre > 0 ? (tradingCenter.oreResource.amount / maxOre) * 100 : 0,
			iridium: maxIridium > 0 ? (tradingCenter.iridiumResource.amount / maxIridium) * 100 : 0
		};
	})();
</script>

<div
	class="relative h-full w-full bg-gradient-to-b from-slate-900/90 to-slate-800/90 backdrop-blur-md"
>
	<!-- Header -->
	<div class="p-8">
		<h1 class="font-['Orbitron'] text-3xl font-bold tracking-wider text-white">
			Galactic Trade Center, Trading from {currentPlanet?.name || 'Unknown'}
		</h1>
	</div>

	<div class="flex h-full min-h-0 flex-1 gap-8 px-8 pb-8">
		<!-- Left Panel: Resources Overview -->
		<div class="flex w-[364px] flex-col">
			<div class="rounded bg-gradient-to-b from-white/10 to-transparent p-6 backdrop-blur-sm">
				<h2 class="mb-6 font-['Orbitron'] text-2xl font-bold tracking-wider text-white">
					Resources overview
				</h2>

				<!-- Your Stockpile -->
				<div class="mb-6">
					<p class="mb-4 font-['Orbitron'] text-sm text-white/80">Your Stockpile (After trade)</p>
					<div class="flex gap-6">
						<div class="flex items-center gap-2">
							<IconImage type="food" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{Math.floor(playerTotalResources.food)}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="ore" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{Math.floor(playerTotalResources.ore)}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="iridium" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{Math.floor(playerTotalResources.iridium)}
							</span>
						</div>
					</div>
				</div>

				<!-- Galaxy Trading Center Stockpile -->
				<div class="mb-6">
					<p class="mb-4 font-['Orbitron'] text-sm text-white/80">
						Galaxy Trading Center Stockpile
					</p>
					<div class="flex gap-6">
						<div class="flex items-center gap-2">
							<IconImage type="food" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{tradingCenterAmounts.food}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="ore" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{tradingCenterAmounts.ore}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="iridium" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{tradingCenterAmounts.iridium}
							</span>
						</div>
					</div>
				</div>

				<!-- Current Prices -->
				<div>
					<p class="mb-4 font-['Orbitron'] text-sm text-white/80">Current Prices</p>
					<div class="flex gap-6">
						<div class="flex items-center gap-2">
							<IconImage type="food" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{resourcePrices.food.toFixed(2)}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="ore" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{resourcePrices.ore.toFixed(2)}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<IconImage type="iridium" size={24} />
							<span class="font-['Orbitron'] text-lg font-semibold text-white">
								{resourcePrices.iridium.toFixed(2)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Panel: Trading Interface -->
		<div class="flex-1">
			<!-- Buy/Sell Tabs -->
			<div class="mb-6 flex">
				<button
					class="relative px-8 py-3 font-['Orbitron'] text-sm font-extrabold tracking-widest uppercase
						{selectedTradeType === TradeType.BUY
						? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/25'
						: 'bg-transparent text-white/70 hover:text-white'}"
					on:click={() => selectTradeType(TradeType.BUY)}
				>
					Buy
				</button>
				<button
					class="relative px-8 py-3 font-['Orbitron'] text-sm font-extrabold tracking-widest uppercase
						{selectedTradeType === TradeType.SELL
						? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/25'
						: 'bg-transparent text-white/70 hover:text-white'}"
					on:click={() => selectTradeType(TradeType.SELL)}
				>
					Sell
				</button>
			</div>

			<!-- Three Column Layout -->
			<div class="mb-6 flex flex-row gap-8">
				<!-- Column 1: Resource Selection -->
				<div class="flex-1">
					<p class="mb-4 font-['Orbitron'] text-sm text-white">
						Select the resource you want to {selectedTradeType === TradeType.BUY
							? 'buy from'
							: 'sell to'} GTC
					</p>

					<!-- Resource Selection Cards -->
					<div class="mb-8 flex gap-4">
						<button
							class="group relative h-34 w-28 rounded-lg bg-gradient-to-b from-slate-700/50 to-slate-800/50 p-4
								{selectedResourceType === TradingCenterResourceType.FOOD
								? 'shadow-lg ring-2 shadow-cyan-400/25 ring-cyan-400'
								: 'hover:from-slate-600/50 hover:to-slate-700/50'}"
							on:click={() => selectResource(TradingCenterResourceType.FOOD)}
						>
							<div class="flex flex-col items-center gap-2">
								<IconImage type="food" size={32} />
								<span class="font-['Orbitron'] text-sm font-semibold text-white">Food</span>
							</div>
						</button>

						<button
							class="group relative h-34 w-28 rounded-lg bg-gradient-to-b from-slate-700/50 to-slate-800/50 p-4
								{selectedResourceType === TradingCenterResourceType.ORE
								? 'shadow-lg ring-2 shadow-cyan-400/25 ring-cyan-400'
								: 'hover:from-slate-600/50 hover:to-slate-700/50'}"
							on:click={() => selectResource(TradingCenterResourceType.ORE)}
						>
							<div class="flex flex-col items-center gap-2">
								<IconImage type="ore" size={32} />
								<span class="font-['Orbitron'] text-sm font-semibold text-white">Ore</span>
							</div>
						</button>

						<button
							class="group relative h-34 w-28 rounded-lg bg-gradient-to-b from-slate-700/50 to-slate-800/50 p-4
								{selectedResourceType === TradingCenterResourceType.IRIDIUM
								? 'shadow-lg ring-2 shadow-cyan-400/25 ring-cyan-400'
								: 'hover:from-slate-600/50 hover:to-slate-700/50'}"
							on:click={() => selectResource(TradingCenterResourceType.IRIDIUM)}
						>
							<div class="flex flex-col items-center gap-2">
								<IconImage type="iridium" size={32} />
								<span class="font-['Orbitron'] text-sm font-semibold text-white">Iridium</span>
							</div>
						</button>
					</div>
				</div>

				<!-- Column 2: Amount Selection with Resource Bar -->
				<div class="flex-1">
					<div class="mb-4 flex items-center gap-4">
						<IconImage type={getResourceIcon(selectedResourceType)} size={24} />
						<span class="font-['Orbitron'] text-base font-semibold text-white">
							Amount of {getResourceName(selectedResourceType).toLowerCase()}
						</span>
						<span class="ml-auto font-['Orbitron'] text-base font-semibold text-white">
							{tradeAmount}
						</span>
					</div>

					<!-- Clickable Trade Amount Bars (like Research view) -->
					<div
						class="mb-4 flex cursor-pointer gap-1"
						on:click={handleTradeAmountBarClick}
						on:keydown={handleTradeAmountBarKeydown}
						role="button"
						tabindex="0"
					>
						{#each tradeAmountBars as filled}
							<div
								class="h-12 w-4 rounded-sm transition-colors {filled
									? `${getResourceColor(selectedResourceType)} shadow-sm shadow-white/25`
									: 'bg-white/10 hover:bg-white/20'}"
							></div>
						{/each}
					</div>

					<!-- Amount indicators -->
					<div class="mb-4 flex justify-between text-xs text-white/60">
						<span>0</span>
						<span>{maxTradeAmount}</span>
					</div>

					<!-- Estimated cost/gain -->
					<div class="text-center">
						<span class="font-['Orbitron'] text-sm text-white/80">
							Estimated {selectedTradeType === TradeType.BUY ? 'cost' : 'gain'}: {estimatedCost.toFixed(
								0
							)} energy
						</span>
					</div>
				</div>

				<!-- Column 3: Galaxy Trading Energy -->
				<div class="flex-1 text-center">
					<p class="mb-4 font-['Orbitron'] text-sm text-white/75">Galaxy trading energy amount</p>
					<span class="font-['Orbitron'] text-3xl font-bold text-white">
						{tradingCenterAmounts.energy.toFixed(0)}
					</span>
				</div>
			</div>
		</div>

		<!-- Submit Trade Button -->
		<div class="absolute right-8 bottom-8">
			<button
				class="rounded bg-cyan-400 px-8 py-3 font-['Orbitron']
					text-sm font-extrabold tracking-widest text-slate-900 uppercase shadow-lg shadow-cyan-400/25 hover:bg-cyan-300
					disabled:cursor-not-allowed disabled:opacity-50"
				disabled={tradeAmount <= 0 || !currentPlanet}
				on:click={submitTrade}
			>
				Submit Trade
			</button>
		</div>
	</div>

	<!-- Submitted Trades List (if any) -->
	{#if tradingCenter?.mainPlayerTrades && tradingCenter.mainPlayerTrades.length > 0}
		<div class="absolute bottom-8 left-8 min-w-72 rounded-lg bg-slate-800/90 p-4 backdrop-blur-sm">
			<h3 class="mb-3 font-['Orbitron'] text-sm font-bold text-white">Submitted Trades</h3>
			<div class="max-h-32 space-y-2 overflow-y-auto">
				{#each tradingCenter.mainPlayerTrades as trade, index}
					<div class="flex items-center justify-between rounded bg-slate-700/50 px-3 py-2">
						<span class="font-['Orbitron'] text-xs text-white">
							{trade.tradeType === TradeType.BUY ? 'Buy' : 'Sell'}
							{trade.amount}
							{getResourceName(trade.resourceType)}
							for {(
								getResourceByType(trade.resourceType)?.currentPrice || 0 * trade.amount
							).toFixed(1)} energy
						</span>
						<button
							class="ml-2 text-xs text-red-400 hover:text-red-300"
							on:click={() => retractTrade(trade)}
							title="Retract Trade"
						>
							✕
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
