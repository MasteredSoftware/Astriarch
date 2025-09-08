<script lang="ts">
	import {
		clientGameModel,
		selectedPlanet,
		selectedPlanetId,
		gameActions
	} from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import { webSocketService } from '$lib/services/websocket';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';
	import { Fleet } from 'astriarch-engine/src/engine/fleet';
	import IconImage from '$lib/components/astriarch/icon-image/IconImage.svelte';
	import type { IconImageType } from '$lib/components/astriarch/types.js';

	let selectedShipType: StarShipType | 'all' = 'all'; // ALL SHIPS tab selected by default
	let selectedShipIds = new Set<number>();

	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: planetList = Object.values(planets);
	$: currentSelectedPlanet = $selectedPlanetId ? planets[$selectedPlanetId] : null;

	// Auto-start destination selection when the view loads
	$: if (
		currentSelectedPlanet &&
		!$fleetCommandStore.isSelectingDestination &&
		!$fleetCommandStore.destinationPlanetId
	) {
		fleetCommandStore.startSelectingDestination(currentSelectedPlanet.id, selectedShipIds);
	}

	// Get ships of the selected type from the selected planet (excluding defenders and space platforms which can't leave)
	$: ships =
		currentSelectedPlanet?.planetaryFleet.starships.filter((ship: StarshipData) => {
			// Exclude System Defense ships and Space Platforms as they can't leave the planet
			if (ship.type === StarShipType.SystemDefense || ship.type === StarShipType.SpacePlatform)
				return false;
			// If "all" is selected, show all mobile ships
			if (selectedShipType === 'all') return true;
			// Otherwise filter by specific type
			return ship.type === selectedShipType;
		}) || [];

	// Ship type tabs configuration (excluding defenders)
	const shipTypeTabs = [
		{ type: 'all' as const, label: 'ALL SHIPS' },
		{ type: StarShipType.Scout, label: 'SCOUT' },
		{ type: StarShipType.Destroyer, label: 'DESTROYER' },
		{ type: StarShipType.Cruiser, label: 'CRUISER' },
		{ type: StarShipType.Battleship, label: 'BATTLESHIP' }
	];

	// Map StarShipType to IconImageType
	function getShipIconType(shipType: StarShipType): IconImageType {
		switch (shipType) {
			case StarShipType.SystemDefense:
				return 'defender';
			case StarShipType.Scout:
				return 'scout';
			case StarShipType.Destroyer:
				return 'destroyer';
			case StarShipType.Cruiser:
				return 'cruiser';
			case StarShipType.Battleship:
				return 'battleship';
			case StarShipType.SpacePlatform:
				return 'space_platform';
			default:
				return 'scout'; // fallback
		}
	}

	// Get ship type display name
	function getShipTypeName(shipType: StarShipType): string {
		switch (shipType) {
			case StarShipType.SystemDefense:
				return 'Defender';
			case StarShipType.Scout:
				return 'Scout';
			case StarShipType.Destroyer:
				return 'Destroyer';
			case StarShipType.Cruiser:
				return 'Cruiser';
			case StarShipType.Battleship:
				return 'Battleship';
			case StarShipType.SpacePlatform:
				return 'Space Platform';
			default:
				return 'Unknown';
		}
	}
	function toggleShipSelection(shipId: number) {
		if (selectedShipIds.has(shipId)) {
			selectedShipIds.delete(shipId);
		} else {
			selectedShipIds.add(shipId);
		}
		selectedShipIds = new Set(selectedShipIds); // Trigger reactivity
	}

	function selectAllShips() {
		selectedShipIds = new Set(ships.map((ship: StarshipData) => ship.id));
	}

	function getHealthPercentage(ship: StarshipData): number {
		// Calculate actual health percentage based on current health vs max strength
		const maxHealth = Fleet.maxStrength(ship);
		const currentHealth = ship.health;
		return Math.round((currentHealth / maxHealth) * 100);
	}

	function getExperiencePercentage(ship: StarshipData): number {
		// Calculate experience percentage towards next level
		const baseStrength = Fleet.getStarshipTypeBaseStrength(ship.type);
		const levelInfo = Fleet.starShipLevel(ship, baseStrength);

		// If at max level, show 100%
		if (levelInfo.level >= 10) {
			return 100;
		}

		// Calculate experience needed for current level and next level
		const currentExp = ship.experienceAmount;
		const nextLevelExpRequired = levelInfo.nextLevelExpRequirement;

		// Calculate experience required for current level (simplified approximation)
		let currentLevelExpRequired = 0;
		let tempExp = baseStrength / 2; // First level requirement

		for (let i = 0; i < levelInfo.level; i++) {
			currentLevelExpRequired += tempExp;
			tempExp += Math.round(tempExp / 2);
		}

		// Calculate progress towards next level
		const expForThisLevel = nextLevelExpRequired - currentLevelExpRequired;
		const expProgress = Math.max(0, currentExp - currentLevelExpRequired);

		return Math.round((expProgress / expForThisLevel) * 100);
	}

	function sendShips() {
		if (
			!currentSelectedPlanet ||
			selectedShipIds.size === 0 ||
			!$fleetCommandStore.destinationPlanetId
		) {
			console.warn('Cannot send ships: missing planet, ships, or destination');
			return;
		}

		// Send ships immediately since we have everything we need
		actuallyPSendShips($fleetCommandStore.destinationPlanetId);

		// Clear selection and reset to destination selection mode
		selectedShipIds.clear();
		selectedShipIds = new Set();
		fleetCommandStore.reset();

		// Auto-restart destination selection for next fleet
		if (currentSelectedPlanet) {
			fleetCommandStore.startSelectingDestination(currentSelectedPlanet.id, selectedShipIds);
		}
	}

	function actuallyPSendShips(destinationPlanetId: number) {
		if (!currentSelectedPlanet || selectedShipIds.size === 0) return;

		// Group selected ships by type
		const shipsByType = {
			scouts: [] as number[],
			destroyers: [] as number[],
			cruisers: [] as number[],
			battleships: [] as number[]
		};

		ships.forEach((ship: StarshipData) => {
			if (selectedShipIds.has(ship.id)) {
				switch (ship.type) {
					case StarShipType.Scout:
						shipsByType.scouts.push(ship.id);
						break;
					case StarShipType.Destroyer:
						shipsByType.destroyers.push(ship.id);
						break;
					case StarShipType.Cruiser:
						shipsByType.cruisers.push(ship.id);
						break;
					case StarShipType.Battleship:
						shipsByType.battleships.push(ship.id);
						break;
				}
			}
		});

		// Send ships via WebSocket
		webSocketService.sendShips(currentSelectedPlanet.id, destinationPlanetId, shipsByType);

		console.log(
			'Ships sent from planet',
			currentSelectedPlanet.id,
			'to planet',
			destinationPlanetId,
			shipsByType
		);

		// Clear selection
		selectedShipIds.clear();
		selectedShipIds = new Set();
	}

	function cancelSendShips() {
		fleetCommandStore.cancelDestinationSelection();
	}

	function handlePlanetChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const planetId = parseInt(target.value);
		gameActions.selectPlanet(planetId);
	}

	// Get destination planet name if one is selected
	$: destinationPlanet = $fleetCommandStore.destinationPlanetId
		? $clientGameModel?.mainPlayerOwnedPlanets[$fleetCommandStore.destinationPlanetId] ||
			$clientGameModel?.clientPlanets.find((p) => p.id === $fleetCommandStore.destinationPlanetId)
		: null;
</script>

<!-- Fleet Command Interface -->
<div
	class="relative h-full w-full bg-gradient-to-b from-[#1B1F25] to-[#0a0d12] font-['Orbitron'] text-white"
>
	<!-- Header -->
	<div class="flex items-center justify-between p-8">
		<div>
			<h1 class="text-[32px] leading-[40px] font-bold tracking-[0.64px] text-white">
				Send available ships from Planet {currentSelectedPlanet?.name || 'Unknown'}
			</h1>
			<p class="mt-2 text-[14px] leading-[28px] tracking-[0.14px] text-white/75 opacity-80">
				Select one or multiple ships from your fleet to explore or attack the planet
			</p>
		</div>

		<!-- Destination Selection Status -->
		<div class="px-4">
			{#if $fleetCommandStore.destinationPlanetId}
				<!-- Destination Selected -->
				<div class="rounded border border-green-500/40 bg-green-600/20 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm text-green-200">
								Destination: <strong>{destinationPlanet?.name || 'Unknown Planet'}</strong>
							</p>
							<p class="mt-1 text-xs text-green-300/80">
								Select ships above and click "Send Ships" to launch your fleet
							</p>
						</div>
						<button
							class="rounded bg-gray-600 px-3 py-1 text-sm hover:bg-gray-500"
							onclick={cancelSendShips}
						>
							Change Destination
						</button>
					</div>
				</div>
			{:else}
				<!-- No Destination Selected -->
				<div class="rounded border border-cyan-500/40 bg-cyan-600/20 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-cyan-200">
								Select a destination planet on the galaxy map
							</p>
							<p class="mt-1 text-xs text-cyan-300/80">
								Click on any planet in the galaxy view to set your fleet's destination
							</p>
						</div>
						<div class="text-cyan-400">
							<svg class="h-6 w-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="flex gap-3">
			<button
				class="h-12 rounded-[4px] bg-gradient-to-b from-[#00FFFF] to-[#00CCCC] px-8 text-[14px] font-extrabold tracking-[2px] text-[#1B1F25] uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] transition-all hover:from-[#00DDDD] hover:to-[#00AAAA] disabled:cursor-not-allowed disabled:opacity-50"
				onclick={sendShips}
				disabled={selectedShipIds.size === 0 || !$fleetCommandStore.destinationPlanetId}
			>
				Send Ships
			</button>
			<button
				class="h-12 rounded-[4px] bg-gradient-to-b from-[#888888] to-[#666666] px-8 text-[14px] font-extrabold tracking-[2px] text-white uppercase shadow-[0px_0px_8px_rgba(0,0,0,0.15)] transition-all hover:from-[#999999] hover:to-[#777777]"
				onclick={selectAllShips}
			>
				Select All
			</button>
		</div>
	</div>

	<!-- Planet Selector -->
	{#if planetList.length > 1}
		<div class="mb-4 px-8">
			<select
				onchange={handlePlanetChange}
				value={$selectedPlanetId}
				class="rounded border border-white/20 bg-[#1B1F25] px-3 py-1 text-sm text-white"
			>
				{#each planetList as planet}
					<option value={planet.id}>{planet.name}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Ship Type Tabs -->
	<div class="relative mb-6 px-8">
		<div class="flex h-[35px] items-end">
			{#each shipTypeTabs as tab}
				<button
					class="relative mr-1 h-[33px] w-[200px] {selectedShipType === tab.type
						? 'border-b-2 border-[#00FFFF] bg-gradient-to-b from-[#313E46] to-[#1B1F25]'
						: 'border-b border-white/20 bg-transparent'}"
					onclick={() => {
						selectedShipType = tab.type;
						selectedShipIds.clear();
						selectedShipIds = new Set();
					}}
				>
					<span
						class="text-[14px] font-extrabold tracking-[2px] uppercase {selectedShipType ===
						tab.type
							? 'text-white'
							: 'text-white/70'}"
					>
						{tab.label}
					</span>
				</button>
			{/each}
		</div>
		<!-- Base line -->
		<div class="absolute right-0 bottom-0 left-0 h-[1px] bg-white/20"></div>
	</div>

	<!-- Ships Grid -->
	<div class="px-8 pb-8">
		{#if ships.length === 0}
			<div class="flex h-32 items-center justify-center text-white/60">
				{#if selectedShipType === 'all'}
					No mobile ships available on this planet
				{:else}
					No {shipTypeTabs.find((t) => t.type === selectedShipType)?.label?.toLowerCase() ||
						'ships'} available on this planet
				{/if}
			</div>
		{:else}
			<div class="overflow-x-auto pb-6">
				<div class="flex min-w-max gap-4">
					{#each ships as ship, index}
						<button
							type="button"
							class="relative h-[72px] w-[90px] cursor-pointer transition-all hover:scale-105 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
							onclick={() => toggleShipSelection(ship.id)}
							aria-label="Toggle selection of {getShipTypeName(
								ship.type
							)} (ID: {ship.id}, Health: {ship.health})"
							aria-pressed={selectedShipIds.has(ship.id)}
							title="{getShipTypeName(ship.type)} - Health: {ship.health}/{Fleet.maxStrength(
								ship
							)}, Level: {Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type))
								.level}, Experience: {ship.experienceAmount}"
						>
							<!-- Frame with selection border -->
							<div
								class="absolute inset-0 rounded-[4px] border-[3.6px] bg-black/15 {selectedShipIds.has(
									ship.id
								)
									? 'border-[#00FFFF]'
									: 'border-[#313E46]'}"
							></div>

							<!-- Ship Icon - Much larger, takes up most of the card -->
							<div
								class="absolute top-[-7.2px] left-[14.4px] h-[61.2px] w-[61.2px] shadow-[0px_0px_14px_0px_rgba(255,255,255,0.24)]"
							>
								<div class="absolute inset-0 flex items-center justify-center">
									<div class="h-[61.2px] w-[61.2px]">
										<div
											class="relative h-full w-full transition-all duration-200"
											style="filter: {selectedShipIds.has(ship.id)
												? 'brightness(0) saturate(100%) invert(85%) sepia(78%) saturate(2476%) hue-rotate(159deg) brightness(103%) contrast(101%)'
												: 'none'}"
										>
											<IconImage
												type={getShipIconType(ship.type)}
												size={61}
												altText={`${ship.type} ship`}
												class="h-full w-full"
											/>
										</div>
									</div>
								</div>
							</div>

							<!-- Experience Bars - Overlaid on ship icon at bottom -->
							<div class="absolute top-[75%] right-[4%] bottom-[5%] left-[4%]">
								<div
									class="absolute inset-0 rounded-br-[3.6px] rounded-bl-[3.6px] bg-[rgba(27,31,37,0.65)]"
								></div>
								<!-- Experience bars (4 segments) -->
								{#each Array(4) as _, i}
									<div
										class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] bg-[#23BDFF] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
										style="left: {2.63 + i * 24.35}%; opacity: {getExperiencePercentage(ship) >
										(i + 1) * 25
											? 1
											: 0.3}"
									></div>
								{/each}
							</div>

							<!-- Health Bar - Overlaid on ship icon in middle -->
							<div
								class="absolute top-[60%] right-[4%] bottom-[20%] left-[4%] flex items-center justify-center"
							>
								<div class="h-[14.4px] w-[82.8px] scale-y-[-100%] rotate-180">
									<div class="relative h-full w-full">
										<div class="absolute inset-0 bg-[rgba(27,31,37,0.65)]"></div>
										<!-- Health bars (4 segments) -->
										{#each Array(4) as _, i}
											<div
												class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] bg-[#00FF38] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
												style="left: {2.63 + i * 24.35}%; opacity: {getHealthPercentage(ship) >
												(i + 1) * 25
													? 1
													: 0.3}"
											></div>
										{/each}
									</div>
								</div>
							</div>

							<!-- Level Indicator - Top left corner -->
							{#if Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type)).level > 0}
								<div class="absolute top-[5%] left-[8%]">
									<div
										class="min-w-[16px] rounded-sm bg-[rgba(27,31,37,0.8)] px-1 py-0.5 text-center"
									>
										<span class="text-[8px] leading-none font-bold text-[#23BDFF]">
											{Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type))
												.level}
										</span>
									</div>
								</div>
							{/if}

							<!-- Ship Type Label -->
							<div class="absolute right-0 bottom-[-18px] left-0 text-center">
								<span class="text-[8px] font-bold tracking-wider text-white/60 uppercase">
									{getShipTypeName(ship.type)}
								</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
