import { PlanetaryConflictData, CombatResultDiff } from '../model/battle';
import { ClientModelData, ClientPlayer, PlanetById } from '../model/clientModel';
import { FleetData, StarshipData } from '../model/fleet';
import { GalaxySizeOption, GameSpeed, ModelBase, ModelData } from '../model/model';
import { PlayerData, PlayerType } from '../model/player';
import { ResearchType } from '../model/research';
import { Utils } from '../utils/utils';
import { BattleSimulator } from './battleSimulator';
import { ClientGameModel } from './clientGameModel';
import { ComputerPlayer } from './computerPlayer';
import { Fleet } from './fleet';
import {
  ClientEvent,
  ClientEventType,
  ClientNotification,
  ClientNotificationType,
  ResourcesAutoSpentNotification,
} from './GameCommands';
import { AdvanceGameClockForPlayerData, AdvanceGameClockResult, GameModel, GameModelData } from './gameModel';
import { Grid } from './grid';
import { Planet } from './planet';
import { PlanetResources } from './planetResources';
import { Player } from './player';
import { Research } from './research';
import { TradingCenter } from './tradingCenter';

export class GameController {
  public static MS_PER_CYCLE_DEFAULT = 30 * 1000; // Time per cycle (or "turn")
  public static GAME_SPEED_MS_PER_CYCLE = {
    [GameSpeed.SLOWEST]: 90 * 1000,
    [GameSpeed.SLOW]: 45 * 1000,
    [GameSpeed.NORMAL]: GameController.MS_PER_CYCLE_DEFAULT,
    [GameSpeed.FAST]: 20 * 1000,
    [GameSpeed.FASTEST]: 10 * 1000,
  };

  public static startModelSnapshot(modelDataBase: ModelBase) {
    const newSnapshotTime = new Date().getTime();
    const lastSnapshotTime = modelDataBase.lastSnapshotTime;

    const elapsedSinceLastSnapshot = newSnapshotTime - lastSnapshotTime;
    const msPerCycle =
      GameController.GAME_SPEED_MS_PER_CYCLE[modelDataBase.gameOptions.gameSpeed] ||
      GameController.MS_PER_CYCLE_DEFAULT;
    const cyclesElapsed = elapsedSinceLastSnapshot / msPerCycle;

    const currentCycle = modelDataBase.currentCycle + cyclesElapsed;

    return {
      newSnapshotTime,
      cyclesElapsed,
      currentCycle,
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

    const allEvents: ClientEvent[] = [];

    const tradeEvents = TradingCenter.executeCurrentTrades(gameModel, planetById, cyclesElapsed);
    allEvents.push(...tradeEvents);

    // NOTE: advanceGameClockForPlayer contains all methods that can run client-side to keep the ui updating w/o trips to the server
    const allNotifications: ClientNotification[] = [];
    const fleetsArrivingOnUnownedPlanetsByPlayerId: Record<string, FleetData[]> = {};
    for (const p of modelData.players) {
      const clientModel = ClientGameModel.constructClientGameModel(modelData, p.id);
      const data: AdvanceGameClockForPlayerData = {
        clientModel,
        cyclesElapsed,
        currentCycle,
        grid,
      };
      const result = Player.advanceGameClockForPlayer(data);
      fleetsArrivingOnUnownedPlanetsByPlayerId[p.id] = result.fleetsArrivingOnUnownedPlanets;
      allEvents.push(...result.events);
      allNotifications.push(...result.notifications);
    }

    // TODO: server side operations after advancing game clock for player
    for (const p of modelData.players) {
      const arrivingFleets = fleetsArrivingOnUnownedPlanetsByPlayerId[p.id];
      if (arrivingFleets.length) {
        const conflictEvents = this.resolvePlanetaryConflicts(gameModel, p, arrivingFleets);
        allEvents.push(...conflictEvents);
      }
    }

    modelData.lastSnapshotTime = newSnapshotTime;
    if (Math.trunc(currentCycle) > Math.trunc(modelData.currentCycle)) {
      const cycleNotifications = this.handleCycleAdvancement(gameModel);
      allNotifications.push(...cycleNotifications);
    }
    modelData.currentCycle = currentCycle;

    // Check for destroyed players and game end conditions
    const destroyedPlayers = GameModel.checkPlayersDestroyed(gameModel);
    const gameEndConditions = GameModel.checkGameEndConditions(gameModel);

    return {
      destroyedPlayers,
      gameEndConditions,
      events: allEvents,
      notifications: allNotifications,
    };
  }

  public static handleCycleAdvancement(gameModel: GameModelData): ClientNotification[] {
    // Handle any game logic that needs to occur at the end of a cycle
    const notifications: ClientNotification[] = [];
    const { modelData } = gameModel;
    for (const p of modelData.players) {
      if (p.lastTurnFoodShipped > 0) {
        notifications.push({
          type: ClientNotificationType.RESOURCES_AUTO_SPENT,
          affectedPlayerIds: [p.id],
          data: {
            amount: p.lastTurnFoodShipped,
            resourceType: 'energy',
            reason: 'Food shipping',
          },
        } as ResourcesAutoSpentNotification);
        p.lastTurnFoodShipped = 0;
      }
      p.lastTurnFoodNeededToBeShipped = 0;
    }
    return notifications;
  }

  /**
   * Reset the snapshot time to the current time to prevent time jumps
   * when resuming a paused game. This is called during game resume operations.
   */
  public static resetSnapshotTime(modelDataBase: ModelBase): void {
    const currentTime = new Date().getTime();
    modelDataBase.lastSnapshotTime = currentTime;
  }

  public static advanceClientGameClock(
    clientModel: ClientModelData,
    grid: Grid,
  ): { fleetsArrivingOnUnownedPlanets: FleetData[]; notifications: ClientNotification[] } {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(clientModel);

    const data: AdvanceGameClockForPlayerData = {
      clientModel,
      cyclesElapsed,
      currentCycle,
      grid,
    };
    const result = Player.advanceGameClockForPlayer(data);

    clientModel.lastSnapshotTime = newSnapshotTime;
    clientModel.currentCycle = currentCycle;
    return {
      fleetsArrivingOnUnownedPlanets: result.fleetsArrivingOnUnownedPlanets,
      notifications: result.notifications,
    };
  }

  public static constructPlanetaryConflictData(
    defendingClientPlayer: ClientPlayer | null,
    defendingFleet: FleetData,
    attackingClientPlayer: ClientPlayer,
    attackingFleet: FleetData,
  ): PlanetaryConflictData {
    return {
      defendingClientPlayer,
      defendingFleet: Fleet.cloneFleet(defendingFleet),
      defendingFleetResearchBoost: { attack: 0, defense: 0 },
      attackingClientPlayer,
      attackingFleet: Fleet.cloneFleet(attackingFleet),
      attackingFleetResearchBoost: { attack: 0, defense: 0 },
      attackingFleetChances: null,
      winningFleet: null,
      combatResultDiff: null,
      resourcesLooted: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0),
    };
  }

  /**
   * Build a combat result diff by comparing fleet state before and after battle
   * @param fleetBefore Fleet state before combat (cloned snapshot)
   * @param fleetAfter Fleet state after combat (modified in place by battle simulator)
   * @returns CombatResultDiff with ships destroyed, damaged, and experience gained
   */
  public static buildCombatResultDiff(fleetBefore: FleetData, fleetAfter: FleetData): CombatResultDiff {
    const shipsDestroyed: string[] = [];
    const shipsDamaged: { id: string; damage: number }[] = [];
    const shipsExperienceGained: { id: string; experience: number }[] = [];

    // Build a map of ships after battle for quick lookup
    const shipsAfterMap = new Map<string, StarshipData>();
    for (const ship of fleetAfter.starships) {
      shipsAfterMap.set(ship.id, ship);
    }

    // Compare each ship from before battle
    for (const shipBefore of fleetBefore.starships) {
      const shipAfter = shipsAfterMap.get(shipBefore.id);

      if (!shipAfter) {
        // Ship was destroyed
        shipsDestroyed.push(shipBefore.id);
      } else {
        // Ship survived - check for damage
        const damageTaken = shipBefore.health - shipAfter.health;
        if (damageTaken > 0) {
          shipsDamaged.push({
            id: shipAfter.id,
            damage: damageTaken,
          });
        }

        // Check for experience gained (future feature support)
        const experienceGained = shipAfter.experienceAmount - shipBefore.experienceAmount;
        if (experienceGained > 0) {
          shipsExperienceGained.push({
            id: shipAfter.id,
            experience: experienceGained,
          });
        }
      }
    }

    const diff = {
      shipsDestroyed,
      shipsDamaged,
      shipsExperienceGained,
    };

    return diff;
  }

  //TODO: this is problematic right now if multiple players show up to battle at a 3rd players planet
  //  right now one player will attack, then the next one will, which prefers the 2nd player to attack
  public static resolvePlanetaryConflicts(
    gameModel: GameModelData,
    player: PlayerData,
    fleetsArrivingOnUnownedPlanets: FleetData[],
  ): ClientEvent[] {
    const events: ClientEvent[] = [];
    //if any of the player's fleets in transit have reached their destination
    //  if the destination is not an owned planet, we need to resolve the conflict
    //  once conflicts are resolved, merge fleets to the fleets of the owned planet
    for (const playerFleet of fleetsArrivingOnUnownedPlanets) {
      // Remove the fleet from fleetsInTransit immediately since it has arrived
      // (will either be destroyed or merged with the planet)
      const attackFleetIndex = player.fleetsInTransit.findIndex((f) => f.id === playerFleet.id);
      if (attackFleetIndex >= 0) {
        player.fleetsInTransit.splice(attackFleetIndex, 1);
      }

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
      const planetOwner = GameModel.findPlanetOwner(gameModel, destinationPlanet.id);

      // Calculate fleet strengths for win chance calculation
      const enemyFleetStrength = Fleet.determineFleetStrength(enemyFleet);
      const playerFleetStrength = Fleet.determineFleetStrength(playerFleet);

      //determine strength differences
      // ServerController.BATTLE_RANDOMNESS_FACTOR = 4 in this case
      //if one fleet's strength is 4 (log base 16 4 = .5) times as strong or more that fleet automatically wins
      //  damage done to winning fleet is (strength of loser / strength Multiplier) +- some randomness
      //if neither fleet is 4 times as strong as the other or more, we have to roll the dice (preferring the stronger fleet) for who wins

      //if the player's fleet is destroyed the enemy (defender) always wins because you can't land fleets and capture the system without fleets

      //July 21st 2010, changed from pure statistics to BattleSimulator

      // Create conflict data before battle for the activity log
      const attackingClientPlayer = ClientGameModel.constructClientPlayer(player);
      const defendingClientPlayer = planetOwner ? ClientGameModel.constructClientPlayer(planetOwner) : null;
      const conflictData = this.constructPlanetaryConflictData(
        defendingClientPlayer,
        enemyFleet,
        attackingClientPlayer,
        playerFleet,
      );

      // Calculate research boosts for both fleets
      conflictData.attackingFleetResearchBoost.attack = Research.getResearchBoostForStarshipCombatImprovement(
        ResearchType.COMBAT_IMPROVEMENT_ATTACK,
        player,
      );
      conflictData.attackingFleetResearchBoost.defense = Research.getResearchBoostForStarshipCombatImprovement(
        ResearchType.COMBAT_IMPROVEMENT_DEFENSE,
        player,
      );

      if (planetOwner) {
        conflictData.defendingFleetResearchBoost.attack = Research.getResearchBoostForStarshipCombatImprovement(
          ResearchType.COMBAT_IMPROVEMENT_ATTACK,
          planetOwner,
        );
        conflictData.defendingFleetResearchBoost.defense = Research.getResearchBoostForStarshipCombatImprovement(
          ResearchType.COMBAT_IMPROVEMENT_DEFENSE,
          planetOwner,
        );
      }

      // Calculate attacking fleet win chances
      conflictData.attackingFleetChances = BattleSimulator.getAttackingFleetChances(
        playerFleetStrength,
        enemyFleetStrength,
      );

      // Clone fleets BEFORE battle to calculate combat diffs
      // The battle simulator modifies fleets in place
      const enemyFleetBeforeBattle = Fleet.cloneFleet(enemyFleet);
      const playerFleetBeforeBattle = Fleet.cloneFleet(playerFleet);

      //now actually simulate the battle
      let playerWins = BattleSimulator.simulateFleetBattle(playerFleet, player, enemyFleet, planetOwner);
      //if at this point playerWins doesn't have a value it means that both fleets were destroyed, in that case the enemy should win because they are the defender of the planet
      if (playerWins === null || typeof playerWins == 'undefined') playerWins = false;

      // CRITICAL: Recalculate fleet hashes after battle since ships were destroyed
      // The battle simulator modifies fleets in place, but doesn't update hashes
      Fleet.recalculateFleetCompositionHash(playerFleet);
      Fleet.recalculateFleetCompositionHash(enemyFleet);

      if (!playerWins) {
        //just kill the fleet
        //make sure this planet is now explored
        Player.setPlanetExplored(
          player,
          destinationPlanet.id,
          enemyFleet,
          gameModel.modelData.currentCycle,
          planetOwner?.id,
        );

        // Defender won - build combat diff for the defending fleet
        conflictData.combatResultDiff = this.buildCombatResultDiff(enemyFleetBeforeBattle, enemyFleet);
        // Keep winningFleet for backwards compatibility (deprecated)
        conflictData.winningFleet = Fleet.cloneFleet(enemyFleet);

        //notify user of fleet loss or defense
        if (player.type == PlayerType.Human) {
          //the attacking player is a human player and lost
          events.push({
            type: ClientEventType.FLEET_ATTACK_FAILED,
            affectedPlayerIds: [player.id],
            data: {
              planetId: destinationPlanet.id,
              planetName: destinationPlanet.name,
              planetType: destinationPlanet.type,
              defenderName: planetOwner?.name,
              defenderId: planetOwner?.id,
              conflictData,
            },
          });
        }

        if (planetOwner && planetOwner.type == PlayerType.Human) {
          //the defending player is a human player and won
          events.push({
            type: ClientEventType.FLEET_DEFENSE_SUCCESS,
            affectedPlayerIds: [planetOwner.id],
            data: {
              planetId: destinationPlanet.id,
              planetName: destinationPlanet.name,
              attackerName: player.name,
              attackerId: player.id,
              conflictData,
            },
          });
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
              const researchPointsStolen = Utils.nextRandom(
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
                attackingPlayerResearch.researchPointsCompleted + researchPointsStolen,
              );
              if (levelIncrease) {
                // Notify defender that research was stolen
                events.push({
                  type: ClientEventType.RESEARCH_STOLEN,
                  affectedPlayerIds: [defendingPlayer.id],
                  data: {
                    victimPlayerId: defendingPlayer.id,
                    thiefPlayerId: player.id,
                    thiefPlayerName: player.name,
                    researchType: attackingPlayerResearch.type,
                    researchName: Research.researchProgressToString(
                      attackingPlayerResearch.type,
                      attackingPlayerResearch.currentResearchLevel,
                    ),
                    planetId: destinationPlanet.id,
                    planetName: destinationPlanet.name,
                    wasVictim: true,
                  },
                });
                // Notify attacker that they stole research
                events.push({
                  type: ClientEventType.RESEARCH_STOLEN,
                  affectedPlayerIds: [player.id],
                  data: {
                    victimPlayerId: defendingPlayer.id,
                    victimPlayerName: defendingPlayer.name,
                    thiefPlayerId: player.id,
                    researchType: attackingPlayerResearch.type,
                    researchName: Research.researchProgressToString(
                      attackingPlayerResearch.type,
                      attackingPlayerResearch.currentResearchLevel,
                    ),
                    planetId: destinationPlanet.id,
                    planetName: destinationPlanet.name,
                    wasVictim: false,
                  },
                });
              }
              break;
            }
          }
        }

        // Attacker won - build combat diff for the attacking fleet
        conflictData.combatResultDiff = this.buildCombatResultDiff(playerFleetBeforeBattle, playerFleet);
        // Keep winningFleet for backwards compatibility (deprecated)
        conflictData.winningFleet = Fleet.cloneFleet(playerFleet);
        conflictData.resourcesLooted = { ...destinationPlanet.resources };

        //merge/land fleet
        Fleet.landFleet(destinationPlanet.planetaryFleet, playerFleet);

        // Now record the last known fleet strength for the old owner (after the attacking fleet has landed)
        if (defendingPlayer) {
          Player.setPlanetLastKnownFleetStrength(
            defendingPlayer,
            destinationPlanet.id,
            destinationPlanet.planetaryFleet,
            gameModel.modelData.currentCycle,
            player?.id,
          );
        }

        //notify user of planet capture or loss
        if (player.type == PlayerType.Human) {
          //the attacking player is a human player and won
          events.push({
            type: ClientEventType.PLANET_CAPTURED,
            affectedPlayerIds: [player.id],
            data: {
              planetId: destinationPlanet.id,
              planetName: destinationPlanet.name,
              previousOwnerId: defendingPlayer?.id,
              previousOwnerName: defendingPlayer?.name,
              conflictData,
              planetData: destinationPlanet,
            },
          });
        }

        if (defendingPlayer && defendingPlayer.type == PlayerType.Human) {
          //the defending player is a human player and lost
          events.push({
            type: ClientEventType.PLANET_LOST,
            affectedPlayerIds: [defendingPlayer.id],
            data: {
              planetId: destinationPlanet.id,
              planetName: destinationPlanet.name,
              planetType: destinationPlanet.type,
              newOwnerId: player.id,
              newOwnerName: player.name,
              conflictData,
            },
          });
        }
      }
    }
    return events;
  }

  public static calculateEndGamePoints(model: ModelData, player: PlayerData, playerWon: boolean) {
    const ownedPlanets = ClientGameModel.getOwnedPlanets(player.ownedPlanetIds, model.planets);
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
