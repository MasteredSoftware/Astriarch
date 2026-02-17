import { getApiUrl } from '$lib/config/environment';

export interface HighScoreEntry {
	playerName: string;
	playerId: string;
	playerPoints: number;
	playerWon: boolean;
	createdAt: string;
}

export interface HighScoresResponse {
	allTime: HighScoreEntry[];
	recent: HighScoreEntry[];
}

/**
 * Fetch high scores from the backend REST API.
 * @param limit Max entries per list (default 10, server max 50)
 */
export async function fetchHighScores(limit: number = 10): Promise<HighScoresResponse> {
	const url = getApiUrl(`/highscores?limit=${limit}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch high scores: ${response.status}`);
	}
	return response.json();
}
