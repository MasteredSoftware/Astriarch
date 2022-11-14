
export interface PlayerResources {
    food: number;
    gold: number;
    ore: number;
    iridium: number;
}

export interface Player {
    resources: PlayerResources;
}

export interface ServerGameModel {
    gameStartedAtTime: number;
    currentCycle: number;
    players: Player[];
}