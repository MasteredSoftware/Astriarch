<script lang="ts">
	import { onMount } from 'svelte';
	import { Text } from '$lib/components/astriarch';
	import { fetchHighScores, type HighScoreEntry } from '$lib/services/highScoreService';

	let allTime: HighScoreEntry[] = $state([]);
	let recent: HighScoreEntry[] = $state([]);
	let loading = $state(true);
	let error = $state(false);

	onMount(async () => {
		try {
			const data = await fetchHighScores(10);
			allTime = data.allTime;
			recent = data.recent;
		} catch (e) {
			console.error('Failed to load high scores:', e);
			error = true;
		} finally {
			loading = false;
		}
	});

	function formatScore(points: number): string {
		return points.toLocaleString();
	}
</script>

{#if loading}
	<div class="mt-8 flex justify-center">
		<Text style="color: #475569; font-size: 14px;">Loading leaderboards...</Text>
	</div>
{:else if error}
	<!-- Silently hide on error — non-critical feature -->
{:else if allTime.length === 0 && recent.length === 0}
	<!-- No scores yet — don't show anything -->
{:else}
	<div class="mt-10 grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
		<!-- All Time Top Rulers -->
		{#if allTime.length > 0}
			<div class="high-score-panel">
				<h3 class="panel-title">
					<span class="title-icon">👑</span> All Time Top Rulers
				</h3>
				<ol class="score-list">
					{#each allTime as entry, i (entry.playerId + '-' + i)}
						<li class="score-entry" class:winner={entry.playerWon}>
							<span class="rank">{i + 1}.</span>
							<span class="player-name" title={entry.playerName}>{entry.playerName}</span>
							<span class="score">{formatScore(entry.playerPoints)}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}

		<!-- Recent Top Rulers -->
		{#if recent.length > 0}
			<div class="high-score-panel">
				<h3 class="panel-title">
					<span class="title-icon">⚡</span> Recent Top Rulers
				</h3>
				<ol class="score-list">
					{#each recent as entry, i (entry.playerId + '-' + i)}
						<li class="score-entry" class:winner={entry.playerWon}>
							<span class="rank">{i + 1}.</span>
							<span class="player-name" title={entry.playerName}>{entry.playerName}</span>
							<span class="score">{formatScore(entry.playerPoints)}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>
{/if}

<style>
	.high-score-panel {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(56, 189, 248, 0.15);
		border-radius: 12px;
		padding: 16px 20px;
		backdrop-filter: blur(8px);
	}

	.panel-title {
		font-size: 14px;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 12px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.title-icon {
		font-size: 16px;
	}

	.score-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.score-entry {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 13px;
		color: #cbd5e1;
		transition: background 0.15s ease;
	}

	.score-entry:hover {
		background: rgba(56, 189, 248, 0.05);
	}

	.score-entry.winner {
		color: #e2e8f0;
	}

	.rank {
		color: #64748b;
		font-size: 12px;
		min-width: 20px;
		text-align: right;
	}

	.score-entry:first-child .rank {
		color: #fbbf24;
	}

	.player-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.score {
		color: #38bdf8;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-size: 13px;
	}
</style>
