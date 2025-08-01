<script lang="ts">
	import { Text, Card } from '$lib/components/astriarch';
	import { clientGameModel } from '$lib/stores/gameStore';

	$: players = $clientGameModel?.clientPlayers || [];
	$: mainPlayer = $clientGameModel?.mainPlayer;
</script>

<div class="space-y-6 p-6">
	<Text style="font-size: 24px; color: #00FFFF; margin-bottom: 16px;">Diplomacy</Text>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Player Status -->
		<Card>
			<div class="p-6">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">
					Known Civilizations
				</Text>

				<div class="space-y-4">
					{#each players as player (player.id)}
						{#if player.id !== mainPlayer?.id}
							<div class="flex items-center justify-between rounded-lg bg-slate-800/50 p-3">
								<div class="flex items-center space-x-3">
									<div
										class="h-4 w-4 rounded-full"
										style="background-color: rgb({player.color.r}, {player.color.g}, {player.color
											.b})"
									></div>
									<div>
										<Text style="color: #FFFFFF; font-size: 14px;">
											{player.name}
										</Text>
										<Text style="color: #94A3B8; font-size: 12px;">
											{player.type === 0 ? 'Human' : 'AI'} • Points: {player.points}
										</Text>
									</div>
								</div>
								<div class="text-right">
									<Text style="color: {player.destroyed ? '#EF4444' : '#10B981'}; font-size: 12px;">
										{player.destroyed ? 'Defeated' : 'Active'}
									</Text>
								</div>
							</div>
						{/if}
					{:else}
						<div class="text-center p-4">
							<Text style="color: #94A3B8;">No other civilizations discovered yet.</Text>
						</div>
					{/each}
				</div>
			</div>
		</Card>

		<!-- Diplomatic Actions -->
		<Card>
			<div class="p-6">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">
					Diplomatic Relations
				</Text>

				<div class="space-y-4">
					<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Current Status:
						</Text>
						<Text style="color: #FFFFFF;">Neutral with all known civilizations</Text>
					</div>

					<div class="rounded-lg border border-cyan-500/20 bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Available Actions:
						</Text>
						<div class="space-y-2">
							<Text style="color: #64748B; font-size: 12px;">• Propose Trade Agreement</Text>
							<Text style="color: #64748B; font-size: 12px;">• Request Non-Aggression Pact</Text>
							<Text style="color: #64748B; font-size: 12px;">• Declare War</Text>
							<Text style="color: #64748B; font-size: 12px;">• Send Envoy</Text>
						</div>
					</div>
				</div>
			</div>
		</Card>

		<!-- Intelligence Report -->
		<Card>
			<div class="p-6 lg:col-span-2">
				<Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 16px;">
					Intelligence Report
				</Text>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="rounded-lg bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Military Strength
						</Text>
						<Text style="color: #64748B; font-size: 12px;">Intelligence gathering required</Text>
					</div>

					<div class="rounded-lg bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Technology Level
						</Text>
						<Text style="color: #64748B; font-size: 12px;">Intelligence gathering required</Text>
					</div>

					<div class="rounded-lg bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Economic Status
						</Text>
						<Text style="color: #64748B; font-size: 12px;">Intelligence gathering required</Text>
					</div>

					<div class="rounded-lg bg-slate-800/50 p-4">
						<Text style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">
							Recent Activity
						</Text>
						<Text style="color: #64748B; font-size: 12px;">No recent activity detected</Text>
					</div>
				</div>
			</div>
		</Card>
	</div>
</div>
