import { GameOptions, ModelData } from "../model/model";
import { PlayerData } from "../model/player";
import { TradingCenter } from "./tradingCenter";

export class GameModel {
    private static buildData(players: PlayerData[], gameOptions: GameOptions):ModelData {
        const gameStartedAtTime = new Date().getTime();
        const lastSnapshotTime = gameStartedAtTime;
        const currentCycle = 0;
        const tradingCenter = TradingCenter.buildData(players.length);

        return {
            gameOptions,
            gameStartedAtTime,
            lastSnapshotTime,
            currentCycle,
            tradingCenter,
            players,
            planets: []
        };
    }

    private static populatePlanets() {

    }
}