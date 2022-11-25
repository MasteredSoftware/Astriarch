import { Engine } from "./types/engine";
import { Player, ServerGameModel } from "./types/gameModel";

export const MS_PER_TICK = 200; // Time for client side refreshes
export const MS_PER_CYCLE = 30 * 1000; // Time per "turn"

const engine = new Engine({serverGameModels:[]});

export const startNewGame = () => {
    const player = {resources: {food: 0, gold: 0, ore: 0, iridium: 0}} as Player;
    const gameModel = {gameStartedAtTime: new Date().getTime(), players: [player]} as ServerGameModel;

    engine.serverGameModels.push(gameModel);
    return gameModel;
}

export const advanceGameModelTime = (gameModel: ServerGameModel) => {
    // this is all just for testing / POC right now
    const foodPerCycle = 10.0;
    const goldPerCycle = 3.0;
    const orePerCycle = 5.0;
    const iridiumPerCycle = 2.5;

    const nowTime = new Date().getTime();

    const elapsedSinceStart = nowTime - gameModel.gameStartedAtTime;
    
    const advancedCyclesTotal = elapsedSinceStart / MS_PER_CYCLE;
    gameModel.currentCycle = Math.trunc(advancedCyclesTotal);

    const { resources } = gameModel.players[0];

    resources.food = foodPerCycle * advancedCyclesTotal;
    resources.gold = goldPerCycle * advancedCyclesTotal;
    resources.ore = orePerCycle * advancedCyclesTotal;
    resources.iridium = iridiumPerCycle * advancedCyclesTotal;

    return gameModel;
}
