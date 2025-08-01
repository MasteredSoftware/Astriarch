<script lang="ts">
	import { Text, Card } from '$lib/components/astriarch';
	import { clientGameModel, currentResearch, resourceData } from '$lib/stores/gameStore';

	$: player = $clientGameModel?.mainPlayer;
	$: researchPercent = player?.research?.researchPercent || 0;
	$: researchProgress = player?.research?.researchProgressByType || {};
</script>

<div class="space-y-6 p-6">
	<Text style="font-size: 24px; color: #00FFFF; margin-bottom: 16px;">Research Laboratory</Text>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Current Research -->
		<Card>
			<div class="p-6">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">Current Research</Text>

				<div class="space-y-4">
					<div>
						<Text style="color: #94A3B8;">Researching:</Text>
						<Text style="color: #00FFFF; font-size: 16px;">
							{$currentResearch}
						</Text>
					</div>

					<div>
						<Text style="color: #94A3B8;">Research Allocation:</Text>
						<Text style="color: #FFFFFF;">
							{Math.round(researchPercent * 100)}% of production
						</Text>
					</div>

					<div>
						<Text style="color: #94A3B8;">Research Points per Turn:</Text>
						<Text style="color: #FFFFFF;">
							{$resourceData.perTurn.research.toFixed(1)}
						</Text>
					</div>

					<div>
						<Text style="color: #94A3B8;">Total Research Points:</Text>
						<Text style="color: #FFFFFF;">
							{$resourceData.total.research.toFixed(1)}
						</Text>
					</div>
				</div>
			</div>
		</Card>

		<!-- Research Progress -->
		<Card>
			<div class="p-6">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">Research Progress</Text>

				<div class="space-y-4">
					<div>
						<Text style="color: #94A3B8;">Research Progress:</Text>
						<Text style="color: #00FFFF; font-size: 16px;">
							{Object.keys(researchProgress).length} technologies researched
						</Text>
					</div>

					{#if $currentResearch !== 'Nothing'}
						<div>
							<Text style="color: #94A3B8; margin-bottom: 8px;">Progress:</Text>
							<div class="h-3 w-full rounded-full bg-slate-800">
								<div
									class="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
									style="width: {Math.min(100, Math.random() * 60 + 20)}%"
								></div>
							</div>
							<Text style="color: #94A3B8; font-size: 12px; margin-top: 4px;">
								Estimated completion: {Math.floor(Math.random() * 5 + 2)} turns
							</Text>
						</div>
					{/if}
				</div>
			</div>
		</Card>

		<!-- Available Research -->
		<Card>
			<div class="p-6 lg:col-span-2">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">
					Available Research Projects
				</Text>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each ['Propulsion', 'Combat Attack', 'Combat Defense', 'Farm Efficiency', 'Mine Efficiency', 'Factory Efficiency', 'Destroyer Ship', 'Cruiser Ship'] as researchOption}
						<div
							class="cursor-pointer rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4 transition-colors hover:border-cyan-500/40"
						>
							<Text style="color: #00FFFF; font-size: 14px; margin-bottom: 4px;">
								{researchOption}
							</Text>
							<Text style="color: #94A3B8; font-size: 12px;">
								{researchOption === $currentResearch ? 'Currently researching' : 'Available'}
							</Text>
						</div>
					{/each}
				</div>
			</div>
		</Card>
	</div>
</div>
