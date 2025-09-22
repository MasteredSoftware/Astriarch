import { ClientModelData, PlanetById } from '../model/clientModel';
import { EventNotificationType } from '../model/eventNotification';
import { FleetData } from '../model/fleet';
import { GalaxySizeOption, ModelBase, ModelData } from '../model/model';
import { PlayerData, PlayerType } from '../model/player';
import { ResearchType } from '../model/research';
import { Utils } from '../utils/utils';
import { BattleSimulator } from './battleSimulator';
import { ClientGameModel } from './clientGameModel';
import { ComputerPlayer } from './computerPlayer';
import { Events } from './events';
import { Fleet } from './fleet';
import { AdvanceGameClockForPlayerData, AdvanceGameClockResult, GameModel, GameModelData } from './gameModel';
import { Grid } from './grid';
import { Planet } from './planet';
import { Player } from './player';
import { Research } from './research';
import { TradingCenter } from './tradingCenter';

export class GameController {
  public static MS_PER_CYCLE = 30 * 1000; // Time per cycle (or "turn")

  public static startModelSnapshot(modelDataBase: ModelBase) {
    const newSnapshotTime = new Date().getTime();
    const lastSnapshotTime = modelDataBase.lastSnapshotTime;

    const elapsedSinceLastSnapshot = newSnapshotTime - lastSnapshotTime;
    const cyclesElapsed = elapsedSinceLastSnapshot / GameController.MS_PER_CYCLE;

    const elapsedSinceStart = newSnapshotTime - modelDataBase.gameStartedAtTime;
    const advancedCyclesTotal = elapsedSinceStart / GameController.MS_PER_CYCLE;

    return {
      newSnapshotTime,
      cyclesElapsed,
      currentCycle: Math.trunc(advancedCyclesTotal),
    };
  }

  public static advanceGameClock(gameModel: GameModelData): AdvanceGameClockResult {
    const { modelData, grid } = gameModel;
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(modelData);
    const planetById = ClientGameModel.getPlanetByIdIndex(modelData.planets);

    for (const p of modelData.players) {
      if (p.type !== PlayerType.Human) {
        const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, modelData.planets);
        ComputerPlayer.computerTakeTurn(gameModel, p, ownedPlanets);
      }
    }

    TradingCenter.executeCurrentTrades(gameModel, planetById, cyclesElapsed);

    // NOTE: advanceGameClockForPlayer contains all methods that can run client-side to keep the ui updating w/o trips to the server
    const fleetsArrivingOnUnownedPlanetsByPlayerId: Record<string, FleetData[]> = {};
    for (const p of modelData.players) {
      const clientModel = ClientGameModel.constructClientGameModel(modelData, p.id);
      const data: AdvanceGameClockForPlayerData = {
        clientModel,
        cyclesElapsed,
        currentCycle,
        grid,
      };
      fleetsArrivingOnUnownedPlanetsByPlayerId[p.id] = Player.advanceGameClockForPlayer(data);
    }

    // TODO: server side operations after advancing game clock for player
    for (const p of modelData.players) {
      const arrivingFleets = fleetsArrivingOnUnownedPlanetsByPlayerId[p.id];
      if (arrivingFleets.length) {
        this.resolvePlanetaryConflicts(gameModel, p, arrivingFleets);
      }
    }

    modelData.lastSnapshotTime = newSnapshotTime;
    if (currentCycle > modelData.currentCycle) {
      this.handleCycleAdvancement(gameModel);
      modelData.currentCycle = currentCycle;
    }

    // Check for destroyed players and game end conditions
    const destroyedPlayers = GameModel.checkPlayersDestroyed(gameModel);
    const gameEndConditions = GameModel.checkGameEndConditions(gameModel);

    Events.publish();

    return {
      destroyedPlayers,
      gameEndConditions,
    };
  }

  public static handleCycleAdvancement(gameModel: GameModelData) {
    // Handle any game logic that needs to occur at the end of a cycle
    const { modelData } = gameModel;
    for (const p of modelData.players) {
      if (p.lastTurnFoodShipped > 0) {
        Events.enqueueNewEvent(
          p.id,
          EventNotificationType.ResourcesAutoSpent,
          `${p.lastTurnFoodShipped.toFixed(1)} Energy spent shipping Food`,
        );
        p.lastTurnFoodShipped = 0;
      }
      p.lastTurnFoodNeededToBeShipped = 0;
    }
  }

  /**
   * Reset the snapshot time to the current time to prevent time jumps
   * when resuming a paused game. This is called during game resume operations.
   */
  public static resetSnapshotTime(modelDataBase: ModelBase): void {
    const currentTime = new Date().getTime();
    modelDataBase.lastSnapshotTime = currentTime;
  }

  public static advanceClientGameClock(clientModel: ClientModelData, grid: Grid): FleetData[] {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(clientModel);

    const data: AdvanceGameClockForPlayerData = {
      clientModel,
      cyclesElapsed,
      currentCycle,
      grid,
    };
    const fleetsArrivingOnUnownedPlanets = Player.advanceGameClockForPlayer(data);

    clientModel.lastSnapshotTime = newSnapshotTime;
    clientModel.currentCycle = currentCycle;
    Events.publish();
    return fleetsArrivingOnUnownedPlanets;
  }

  //TODO: this is problematic right now if multiple players show up to battle at a 3rd players planet
  //  right now one player will attack, then the next one will, which prefers the 2nd player to attack
  public static resolvePlanetaryConflicts(
    gameModel: GameModelData,
    player: PlayerData,
    fleetsArrivingOnUnownedPlanets: FleetData[],
  ) {
    //if any of the player's fleets in transit have reached their destination
    //  if the destination is not an owned planet, we need to resolve the conflict
    //  once conflicts are resolved, merge fleets to the fleets of the owned planet
    for (const playerFleet of fleetsArrivingOnUnownedPlanets) {
      const destinationPlanet = Planet.getPlanetAtMidPoint(
        gameModel.modelData.planets,
        playerFleet.destinationHexMidPoint!,
      );
      if (!destinationPlanet) {
        throw new Error('Unable to find fleet destinationPlanet in resolvePlanetaryConflicts');
      }

      //if there are ships in the planet's OutgoingFleets list, recall them since we are being attacked
      //  this happens when a player has used the waypoint feature and just built a ship
      Planet.recallOutgoingFleets(destinationPlanet);

      //battle!
      const enemyFleet = destinationPlanet.planetaryFleet;

      const enemyFleetStrength = Fleet.determineFleetStrength(enemyFleet);

      const playerFleetStrength = Fleet.determineFleetStrength(playerFleet);

      //this is for our event message, the PlanetaryConflictData constructor deals with cloning the fleets
      const attackingClientPlayer = ClientGameModel.constructClientPlayer(player);
      let defendingClientPlayer = null;
      const planetOwner = GameModel.findPlanetOwner(gameModel, destinationPlanet.id);
      if (planetOwner) {
        defendingClientPlayer = ClientGameModel.constructClientPlayer(planetOwner);
      }
      const planetaryConflictData = Events.constructPlanetaryConflictData(
        defendingClientPlayer,
        destinationPlanet.planetaryFleet,
        attackingClientPlayer,
        playerFleet,
      );

      //determine strength differences
      // ServerController.BATTLE_RANDOMNESS_FACTOR = 4 in this case
      //if one fleet's strength is 4 (log base 16 4 = .5) times as strong or more that fleet automatically wins
      //  damage done to winning fleet is (strength of loser / strength Multiplier) +- some randomness
      //if neither fleet is 4 times as strong as the other or more, we have to roll the dice (preferring the stronger fleet) for who wins

      //if the player's fleet is destroyed the enemy (defender) always wins because you can't land fleets and capture the system without fleets

      //July 21st 2010, changed from pure statistics to BattleSimulator, still have this AttackingFleetChances code to show a percentage (for now as an estimation)

      planetaryConflictData.attackingFleetResearchBoost.attack = Research.getResearchBoostForStarshipCombatImprovement(
        ResearchType.COMBAT_IMPROVEMENT_ATTACK,
        player,
      );
      planetaryConflictData.attackingFleetResearchBoost.defense = Research.getResearchBoostForStarshipCombatImprovement(
        ResearchType.COMBAT_IMPROVEMENT_DEFENSE,
        player,
      );

      planetaryConflictData.defendingFleetResearchBoost.attack = planetOwner
        ? Research.getResearchBoostForStarshipCombatImprovement(ResearchType.COMBAT_IMPROVEMENT_ATTACK, planetOwner)
        : 0;
      planetaryConflictData.defendingFleetResearchBoost.defense = planetOwner
        ? Research.getResearchBoostForStarshipCombatImprovement(ResearchType.COMBAT_IMPROVEMENT_DEFENSE, planetOwner)
        : 0;

      planetaryConflictData.attackingFleetChances = BattleSimulator.getAttackingFleetChances(
        playerFleetStrength,
        enemyFleetStrength,
      );

      //now actually simulate the battle
      let playerWins = BattleSimulator.simulateFleetBattle(playerFleet, player, enemyFleet, planetOwner);
      //if at this point playerWins doesn't have a value it means that both fleets were destroyed, in that case the enemy should win because they are the defender of the planet
      if (playerWins === null || typeof playerWins == 'undefined') playerWins = false;

      if (!playerWins) {
        //just kill the fleet
        //make sure this planet is now explored
        Player.setPlanetExplored(player, destinationPlanet, gameModel.modelData.currentCycle, planetOwner?.id);

        //notify user of fleet loss or defense
        if (player.type == PlayerType.Human) {
          //the attacking player is a human player and lost
          //PlanetaryConflictData summarizes your attacking fleet, the enemy fleet and what was destroyed in the enemy fleet

          let message = 'You lost a fleet attacking planet: ' + destinationPlanet.name;
          if (planetOwner) {
            message = 'You lost a fleet attacking ' + planetOwner.name + ' at planet: ' + destinationPlanet.name;
          }
          planetaryConflictData.winningFleet = Fleet.cloneFleet(enemyFleet);
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.AttackingFleetLost,
            message,
            destinationPlanet,
            planetaryConflictData,
          );
        }

        if (planetOwner && planetOwner.type == PlayerType.Human) {
          //the defending player is a human player and won
          //PlanetaryConflictData summarizes the attacking fleet, your fleet and what was destroyed in your fleet
          const message =
            'You successfully defended against ' + player.name + ' attacking planet: ' + destinationPlanet.name;
          planetaryConflictData.winningFleet = Fleet.cloneFleet(enemyFleet);
          Events.enqueueNewEvent(
            planetOwner.id,
            EventNotificationType.DefendedAgainstAttackingFleet,
            message,
            destinationPlanet,
            planetaryConflictData,
          );
        }
      } else {
        const defendingPlayer = planetOwner;

        //change planet ownership
        GameModel.changePlanetOwner(defendingPlayer, player, destinationPlanet, gameModel.modelData.currentCycle);

        if (defendingPlayer) {
          //give the conquering player a chance to loot research from the planet / defending player
          //based on how good the planet it is (class)
          const researchLootMax = Math.floor(Math.pow(destinationPlanet.type + 1, 2)) * 4;

          //loot research if the defending player has a higher level of research than we do in an area
          const potentialResearchToSteal = Research.getResearchProgressListSorted(defendingPlayer.research);
          for (const rp of potentialResearchToSteal) {
            const attackingPlayerResearch = player.research.researchProgressByType[rp.type];
            //NOTE: currently you can't steal custom ship research
            if (
              Research.canResearch(attackingPlayerResearch) &&
              !Research.researchTypeIndex[rp.type].isCustomShip &&
              rp.currentResearchLevel > attackingPlayerResearch.currentResearchLevel &&
              rp.researchPointsCompleted > attackingPlayerResearch.researchPointsCompleted
            ) {
              planetaryConflictData.resourcesLooted.research = Utils.nextRandom(
                0,
                Math.floor(
                  Math.min(
                    researchLootMax,
                    rp.researchPointsCompleted - attackingPlayerResearch.researchPointsCompleted,
                  ) + 1,
                ),
              );
              const levelIncrease = Research.setResearchPointsCompleted(
                attackingPlayerResearch,
                attackingPlayerResearch.researchPointsCompleted + planetaryConflictData.resourcesLooted.research,
              );
              if (levelIncrease) {
                Events.enqueueNewEvent(
                  defendingPlayer.id,
                  EventNotificationType.ResearchStolen,
                  `${Research.researchProgressToString(attackingPlayerResearch)} was stolen by ${player.name}`,
                  destinationPlanet,
                );
                Events.enqueueNewEvent(
                  player.id,
                  EventNotificationType.ResearchStolen,
                  `You stole ${Research.researchProgressToString(attackingPlayerResearch)} from ${
                    defendingPlayer.name
                  }`,
                  destinationPlanet,
                );
              }
              break;
            }
          }
        }

        //add in the other resources looted since the new player is now the owner
        planetaryConflictData.resourcesLooted = { ...destinationPlanet.resources };

        //merge/land fleet
        Fleet.landFleet(destinationPlanet.planetaryFleet, playerFleet);

        //notify user of planet capture or loss
        if (player.type == PlayerType.Human) {
          //the attacking player is a human player and won
          //PlanetaryConflictData summarizes your attacking fleet, the enemy fleet and what was destroyed in your fleet
          let message = 'Your fleet captured planet: ' + destinationPlanet.name;
          if (defendingPlayer != null) {
            message = 'Your fleet captured planet: ' + destinationPlanet.name + ', owned by: ' + defendingPlayer.name;
          }
          planetaryConflictData.winningFleet = Fleet.cloneFleet(playerFleet);
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.PlanetCaptured,
            message,
            destinationPlanet,
            planetaryConflictData,
          );
        }

        if (defendingPlayer && defendingPlayer.type == PlayerType.Human) {
          //the defending player is a human player and lost
          //planetaryConflictData summarizes your defending fleet, the enemy fleet and what was destroyed in the enemy fleet
          const message = player.name + ' captured your planet: ' + destinationPlanet.name;
          planetaryConflictData.winningFleet = Fleet.cloneFleet(playerFleet);
          Events.enqueueNewEvent(
            defendingPlayer.id,
            EventNotificationType.PlanetLost,
            message,
            destinationPlanet,
            planetaryConflictData,
          );
        }
      }
    }
  }

  public static calculateEndGamePoints(
    model: ModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    playerWon: boolean,
  ) {
    return this.getEndGamePlayerPoints(model, player, ownedPlanets, playerWon);
  }

  public static getEndGamePlayerPoints(
    model: ModelData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    playerWon: boolean,
  ) {
    let turnsTaken = model.currentCycle;
    if (turnsTaken > 1000) {
      //some max, nobody should play this long?
      turnsTaken = 1000;
    }

    const { systemsToGenerate, planetsPerSystem } = model.gameOptions;
    let minTurns = systemsToGenerate * planetsPerSystem - 8;
    let difficultyRating = minTurns;

    for (const p of model.players) {
      if (p.id === player.id) {
        continue;
      }
      switch (p.type) {
        case PlayerType.Computer_Easy:
          difficultyRating += 1;
          break;
        case PlayerType.Computer_Normal:
          difficultyRating += 2;
          break;
        case PlayerType.Computer_Hard:
          difficultyRating += 3;
          break;
        case PlayerType.Computer_Expert:
          difficultyRating += 4;
          break;
        case PlayerType.Human:
          difficultyRating += 8;
          break;
      }
    }

    let ownedPlanetCount = player.ownedPlanetIds.length;
    if (ownedPlanetCount == 0) {
      ownedPlanetCount = 1; //so that we have points for loosers too
    }
    let totalPopulation = Player.getTotalPopulation(player, ownedPlanets);
    if (totalPopulation == 0) {
      totalPopulation = 1; //so that we have points for loosers too
    }

    let maxPopulation = 0;
    for (const p of Object.values(ownedPlanets)) {
      maxPopulation += p.maxImprovements; //only count max pop w/o colonies
    }
    //prevent divide by zero
    if (maxPopulation == 0) {
      maxPopulation = 100;
    }

    //max difficulty right now is (4 * 8) - 8 + (3 * 8) = 48
    //min is 1
    difficultyRating = difficultyRating / 48;

    minTurns += playerWon
      ? ownedPlanetCount *
        (model.gameOptions.galaxySize == GalaxySizeOption.TINY
          ? 0.25
          : model.gameOptions.galaxySize == GalaxySizeOption.SMALL
            ? 0.5
            : model.gameOptions.galaxySize == GalaxySizeOption.MEDIUM
              ? 0.75
              : 1.0)
      : 6;
    const speedFactor = minTurns / turnsTaken;

    const additionalPoints = this.calculateAdditionalPoints(
      player.points,
      ownedPlanetCount,
      totalPopulation,
      maxPopulation,
      systemsToGenerate,
      planetsPerSystem,
      difficultyRating,
      speedFactor,
      playerWon,
    );
    console.log(
      'CalculateEndGamePoints: points:',
      player.points,
      'additionalPoints:',
      additionalPoints,
      'speedFactor:',
      speedFactor,
      'difficultyRating:',
      difficultyRating,
      'percentageOwned:',
      ownedPlanetCount / (systemsToGenerate * planetsPerSystem),
      'ownedPlanetCount:',
      ownedPlanetCount,
      'totalPopulation:',
      totalPopulation,
      'maxPopulation:',
      maxPopulation,
      'systemsToGenerate:',
      systemsToGenerate,
      'planetsPerSystem:',
      planetsPerSystem,
      'playerWon:',
      playerWon,
      'minTurns:',
      minTurns,
      'model.currentCycle:',
      model.currentCycle,
    );

    return Math.floor(player.points + additionalPoints);
  }

  public static calculateAdditionalPoints(
    points: number,
    ownedPlanetCount: number,
    totalPopulation: number,
    maxPopulation: number,
    systemsToGenerate: number,
    planetsPerSystem: number,
    difficultyRating: number,
    speedFactor: number,
    playerWon: boolean,
  ) {
    const percentageOwned = ownedPlanetCount / (systemsToGenerate * planetsPerSystem);
    const percentagePopulated = totalPopulation / maxPopulation;

    let additionalPoints = points * (playerWon ? 2 : 0.25);
    additionalPoints = Math.round(
      additionalPoints *
        (percentageOwned * difficultyRating * speedFactor + percentagePopulated * difficultyRating * speedFactor),
    );

    return additionalPoints;
  }
}
