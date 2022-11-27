import { ModelData } from "../model/model";

export class GameController {

    private static BATTLE_RANDOMNESS_FACTOR: 4.0; //the amount randomness (chance) when determining fleet conflict outcomes, it is the strength multiplyer where the winner is guaranteed to win

    public static MS_PER_CYCLE = 30 * 1000; // Time per cycle (or "turn")

    public static advanceGameClock(model: ModelData) {
        const newSnapshotTime = new Date().getTime();
        const lastSnapshotTime = model.lastSnapshotTime;
        const elapsedSinceLastSnapshot = newSnapshotTime - lastSnapshotTime;
        const elapsedSinceStart = newSnapshotTime - model.gameStartedAtTime;

        const advancedCyclesTotal = elapsedSinceStart / GameController.MS_PER_CYCLE;


        model.lastSnapshotTime = newSnapshotTime;
        model.currentCycle = Math.trunc(advancedCyclesTotal);
    }
}