<script lang="ts">
	import { Text, Button } from '$lib/components/astriarch';
	import { clientGameModel, currentResearch, resourceData } from '$lib/stores/gameStore';
	import { ResearchType } from 'astriarch-engine/src/model/research';
	import { StarShipType } from 'astriarch-engine/src/model/fleet';
	import { Research } from 'astriarch-engine/src/engine/research';

	$: player = $clientGameModel?.mainPlayer;
	$: researchPercent = player?.research?.researchPercent || 0;
	$: energyPercent = 1 - researchPercent;
	$: researchProgress = player?.research?.researchProgressByType || {};
	$: currentResearchType = player?.research?.researchTypeInQueue;

	// Research categories for display
	const shipTypes = [
		{ type: StarShipType.SystemDefense, name: 'Defender', researchType: ResearchType.NEW_SHIP_TYPE_DEFENDER },
		{ type: StarShipType.Scout, name: 'Scout', researchType: ResearchType.NEW_SHIP_TYPE_SCOUT },
		{ type: StarShipType.Destroyer, name: 'Destroyer', researchType: ResearchType.NEW_SHIP_TYPE_DESTROYER },
		{ type: StarShipType.Cruiser, name: 'Cruiser', researchType: ResearchType.NEW_SHIP_TYPE_CRUISER },
		{ type: StarShipType.Battleship, name: 'Battleship', researchType: ResearchType.NEW_SHIP_TYPE_BATTLESHIP }
	];

	const improvements = [
		{ name: 'Attack', researchType: ResearchType.COMBAT_IMPROVEMENT_ATTACK },
		{ name: 'Defense', researchType: ResearchType.COMBAT_IMPROVEMENT_DEFENSE },
		{ name: 'Propulsion', researchType: ResearchType.PROPULSION_IMPROVEMENT }
	];

	const infrastructure = [
		{ name: 'Farms', researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS },
		{ name: 'Mines', researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES },
		{ name: 'Colonies', researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES },
		{ name: 'Factories', researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES },
		{ name: 'Space Platforms', researchType: ResearchType.SPACE_PLATFORM_IMPROVEMENT }
	];

	// Check if current research is a custom ship
	$: isCustomShipResearch = currentResearchType && [
		ResearchType.NEW_SHIP_TYPE_DEFENDER,
		ResearchType.NEW_SHIP_TYPE_SCOUT,
		ResearchType.NEW_SHIP_TYPE_DESTROYER,
		ResearchType.NEW_SHIP_TYPE_CRUISER,
		ResearchType.NEW_SHIP_TYPE_BATTLESHIP
	].includes(currentResearchType);

	$: currentResearchInfo = currentResearchType && researchProgress[currentResearchType] 
		? {
			name: Research.researchProgressToString(researchProgress[currentResearchType]),
			type: currentResearchType,
			progress: researchProgress[currentResearchType]
		}
		: null;

	function renderResourceBar(percentage: number, color: string) {
		const filledBars = Math.round(percentage * 20);
		const bars = [];
		for (let i = 0; i < 20; i++) {
			bars.push(i < filledBars);
		}
		return bars;
	}

	$: energyBars = renderResourceBar(energyPercent, '#e2c631');
	$: researchBars = renderResourceBar(researchPercent, '#00ffa3');
</script>

<!-- Horizontal layout similar to Planet View -->
<div class="relative h-80 w-full">
	<!-- Background with glass effect -->
	<div class="absolute inset-0 backdrop-blur-md bg-gradient-to-b from-white/10 to-gray-800/0 rounded"></div>
	
	<!-- Title -->
	<!-- <div class="absolute left-8 top-8">
		<Text class="astriarch-headline-32">
			Research
		</Text>
	</div> -->

	<div class="absolute inset-0 flex">
		<!-- Left Section: Allocated Resources -->
		<div class="w-[461px] h-80 p-8">
			<div class="h-full backdrop-blur-md bg-gradient-to-b from-white/10 to-gray-800/0 rounded p-8">
				<Text class="astriarch-headline-24" style="margin-bottom: 16px;">
					Allocated resources
				</Text>

				<!-- Energy Bar -->
				<div class="mb-8">
					<div class="flex items-center mb-4">
						<div class="w-8 h-8 mr-4 flex items-center justify-center">
							<!-- Energy Icon (simplified) -->
							<div class="w-6 h-6 bg-yellow-500 rounded-full"></div>
						</div>
						<Text class="astriarch-body-16-semibold">
							Energy
						</Text>
						<Text class="astriarch-body-16-semibold" style="margin-left: auto;">
							{Math.round(energyPercent * 100)}%
						</Text>
					</div>
					
					<div class="flex gap-1 ml-9">
						{#each energyBars as filled}
							<div class="w-4 h-12 rounded-sm {filled ? 'bg-yellow-500 shadow-glow-white' : 'bg-white/10'}"></div>
						{/each}
					</div>
				</div>

				<!-- Research Bar -->
				<div class="mb-8">
					<div class="flex items-center mb-4">
						<div class="w-8 h-8 mr-4 flex items-center justify-center">
							<!-- Research Icon (simplified) -->
							<div class="w-6 h-6 bg-green-500 rounded-full"></div>
						</div>
						<Text class="astriarch-body-16-semibold">
							Research
						</Text>
						<Text class="astriarch-body-16-semibold" style="margin-left: auto;">
							{Math.round(researchPercent * 100)}%
						</Text>
					</div>
					
					<div class="flex gap-1 ml-9">
						{#each researchBars as filled}
							<div class="w-4 h-12 rounded-sm {filled ? 'bg-green-500 shadow-glow-white' : 'bg-white/10'}"></div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Right Section: Research Options -->
		<div class="flex-1 h-80 p-8 ml-8">
			<div class="h-full backdrop-blur-md bg-gradient-to-b from-white/10 to-gray-800/0 rounded p-8">
				<Text class="astriarch-headline-24" style="margin-bottom: 16px;">
					Custom ships and infra infrastructures
				</Text>

				<div class="flex h-40">
					<!-- Create Ships Column -->
					<div class="flex flex-col items-center mr-16">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
							Create Ships
						</Text>
						
						<div class="grid grid-cols-2 gap-2">
							{#each shipTypes as ship}
								<div class="w-12 h-12 rounded-lg bg-gray-700/50 flex items-center justify-center cursor-pointer hover:bg-gray-600/50 transition-colors border border-transparent hover:border-cyan-500/40">
									<!-- Ship Icon (simplified for now) -->
									<div class="w-8 h-8 bg-cyan-400 rounded" style="box-shadow: 0px 0px 18px rgba(125,251,255,0.25);"></div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Improve Column -->
					<div class="flex flex-col items-center mr-16">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
							Improve
						</Text>
						
						<div class="grid grid-cols-1 gap-2">
							{#each improvements as improvement}
								<div class="w-12 h-12 rounded-lg {currentResearchType === improvement.researchType ? 'bg-gray-700 border-2 border-cyan-500' : 'bg-gray-700/50'} flex items-center justify-center cursor-pointer hover:bg-gray-600/50 transition-colors">
									<!-- Improvement Icon (simplified for now) -->
									<div class="w-8 h-8 bg-gray-400 rounded"></div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Boost/Increase Column -->
					<div class="flex flex-col items-center mr-16">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
							Boost/Increase
						</Text>
						
						<div class="grid grid-cols-2 gap-2">
							{#each infrastructure as infra}
								<div class="w-12 h-12 rounded-lg {currentResearchType === infra.researchType ? 'bg-gray-700 border-2 border-cyan-500' : 'bg-gray-700/50'} flex items-center justify-center cursor-pointer hover:bg-gray-600/50 transition-colors">
									<!-- Infrastructure Icon (simplified for now) -->
									<div class="w-8 h-8 bg-gray-400 rounded"></div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Conditional Right Section -->
					<div class="flex-1 flex flex-col">
						{#if isCustomShipResearch}
							<!-- Custom Ship: Advantage/Disadvantage Section -->
							<div class="flex mb-4">
								<div class="flex-1 mr-4">
									<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
										Advantage against
									</Text>
									
									<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px;">
										DESTROYER
									</Button>
								</div>
								
								<div class="flex-1">
									<Text style="font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 14px; color: #FFFFFF; line-height: 24px; letter-spacing: 0.07px; margin-bottom: 16px;">
										Disadvantage against
									</Text>
									
									<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px;">
										SCOUTS
									</Button>
								</div>
							</div>
							
							<div class="flex mt-auto">
								<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 24px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px; margin-right: 16px;">
									RESEARCH SHIPS
								</Button>
								
								<Button style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">
									OKAY
								</Button>
							</div>
						{:else if currentResearchInfo && !isCustomShipResearch}
							<!-- Standard Research: Currently Researching Section -->
							<div class="flex flex-col">
								<Text class="astriarch-body-16-semibold" style="margin-bottom: 16px;">
									Currently researching
								</Text>
								
								<div class="flex items-start mb-6">
									<div class="w-8 h-8 mr-4 flex items-center justify-center">
										<!-- Research Type Icon (simplified for now) -->
										<div class="w-8 h-8 bg-gray-400 rounded"></div>
									</div>
									
									<div class="flex flex-col">
										<Text class="astriarch-body-14" style="margin-bottom: 4px;">
											{currentResearchInfo.name}.
										</Text>
										<Text class="astriarch-body-14">
											Estimating turns remaining: Infinity
										</Text>
									</div>
								</div>
								
								<div class="mt-auto">
									<Button style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">
										OKAY
									</Button>
								</div>
							</div>
						{:else}
							<!-- Default: No research selected -->
							<div class="flex mb-4">
								<div class="flex-1 mr-4">
									<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
										Advantage against
									</Text>
									
									<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px;">
										DESTROYER
									</Button>
								</div>
								
								<div class="flex-1">
									<Text style="font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 14px; color: #FFFFFF; line-height: 24px; letter-spacing: 0.07px; margin-bottom: 16px;">
										Disadvantage against
									</Text>
									
									<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px;">
										SCOUTS
									</Button>
								</div>
							</div>
							
							<div class="flex mt-auto">
								<Button style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 24px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px; margin-right: 16px;">
									RESEARCH SHIPS
								</Button>
								
								<Button style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;">
									OKAY
								</Button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.shadow-glow-white {
		box-shadow: 0px 0px 14px rgba(255, 255, 255, 0.24);
	}
</style>
