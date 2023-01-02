import { ClientModelData, PlanetById } from "../model/clientModel";
import { EventNotificationType } from "../model/eventNotification";
import { FleetData } from "../model/fleet";
import { ModelBase } from "../model/model";
import { PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { Utils } from "../utils/utils";
import { BattleSimulator } from "./battleSimulator";
import { ClientGameModel } from "./clientGameModel";
import { ComputerPlayer } from "./computerPlayer";
import { Events } from "./events";
import { Fleet } from "./fleet";
import { GameModel, GameModelData } from "./gameModel";
import { Grid } from "./grid";
import { Planet } from "./planet";
import { Player } from "./player";
import { Research } from "./research";
import { TradingCenter } from "./tradingCenter";

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

  public static advanceGameClock(gameModel: GameModelData) {
    const { modelData } = gameModel;
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(modelData);
    const planetById = ClientGameModel.getPlanetByIdIndex(modelData.planets);

    for (const p of modelData.players) {
      if (p.type !== PlayerType.Human) {
        const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, modelData.planets);
        ComputerPlayer.computerTakeTurn(gameModel, p, ownedPlanets);
      }
    }

    TradingCenter.executeCurrentTrades(gameModel, planetById);

    for (const p of modelData.players) {
      const ownedPlanets = ClientGameModel.getOwnedPlanets(p.ownedPlanetIds, modelData.planets);
      Player.advanceGameClockForPlayer(p, ownedPlanets, cyclesElapsed, modelData.currentCycle);
    }

    // TODO: server side operations after advancing game clock for player
    // resolvePlanetaryConflicts

    modelData.lastSnapshotTime = newSnapshotTime;
    modelData.currentCycle = currentCycle;
    Events.publish();
  }

  public static advanceClientGameClock(clientModel: ClientModelData) {
    const { cyclesElapsed, newSnapshotTime, currentCycle } = GameController.startModelSnapshot(clientModel);

    Player.advanceGameClockForPlayer(clientModel.mainPlayer, clientModel.mainPlayerOwnedPlanets, cyclesElapsed, clientModel.currentCycle);

    clientModel.lastSnapshotTime = newSnapshotTime;
    clientModel.currentCycle = currentCycle;
    Events.publish();
  }

  //TODO: this is problematic right now if multiple players show up to battle at a 3rd players planet
  //  right now one player will attack, then the next one will, which prefers the 2nd player to attack
  public static resolvePlanetaryConflicts(
    gameModel: GameModelData,
    planetById: PlanetById,
    player: PlayerData,
    fleetsArrivingOnUnownedPlanets: FleetData[]
  ) {
    //if any of the player's fleets in transit have reached their destination
    //  if the destination is not an owned planet, we need to resolve the conflict
    //  once conflicts are resolved, merge fleets to the fleets of the owned planet
    for (const playerFleet of fleetsArrivingOnUnownedPlanets) {
      const destinationPlanet = Planet.getPlanetAtMidPoint(
        gameModel.modelData.planets,
        playerFleet.destinationHexMidPoint!
      );
      if (!destinationPlanet) {
        throw new Error("Unable to find fleet destinationPlanet in resolvePlanetaryConflicts");
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
        playerFleet
      );

      //determine strength differences
      // ServerController.BATTLE_RANDOMNESS_FACTOR = 4 in this case
      //if one fleet's strength is 4 (log base 16 4 = .5) times as strong or more that fleet automatically wins
      //  damage done to winning fleet is (strength of loser / strength Multiplier) +- some randomness
      //if neither fleet is 4 times as strong as the other or more, we have to roll the dice (preferring the stronger fleet) for who wins

      //if the player's fleet is destroyed the enemy (defender) always wins because you can't land fleets and capture the system without fleets

      //July 21st 2010, changed from pure statistics to BattleSimulator, still have this AttackingFleetChances code to show a percentage (for now as an estimation)

      planetaryConflictData.attackingFleetResearchBoost.attack = Research.getResearchBoostForStarshipImprovement(
        ResearchType.COMBAT_IMPROVEMENT_ATTACK,
        player
      );
      planetaryConflictData.attackingFleetResearchBoost.defense = Research.getResearchBoostForStarshipImprovement(
        ResearchType.COMBAT_IMPROVEMENT_DEFENSE,
        player
      );

      planetaryConflictData.defendingFleetResearchBoost.attack = planetOwner
        ? Research.getResearchBoostForStarshipImprovement(ResearchType.COMBAT_IMPROVEMENT_ATTACK, planetOwner)
        : 0;
      planetaryConflictData.defendingFleetResearchBoost.defense = planetOwner
        ? Research.getResearchBoostForStarshipImprovement(ResearchType.COMBAT_IMPROVEMENT_DEFENSE, planetOwner)
        : 0;

      planetaryConflictData.attackingFleetChances = BattleSimulator.getAttackingFleetChances(
        playerFleetStrength,
        enemyFleetStrength
      );

      //now actually simulate the battle
      let playerWins = BattleSimulator.simulateFleetBattle(playerFleet, player, enemyFleet, planetOwner);
      //if at this point playerWins doesn't have a value it means that both fleets were destroyed, in that case the enemy should win because they are the defender of the planet
      if (playerWins === null || typeof playerWins == "undefined") playerWins = false;

      if (!playerWins) {
        //just kill the fleet
        //make sure this planet is now explored
        Player.setPlanetExplored(player, destinationPlanet, gameModel.modelData.currentCycle, planetOwner?.id);

        //notify user of fleet loss or defense
        if (player.type == PlayerType.Human) {
          //the attacking player is a human player and lost
          //PlanetaryConflictData summarizes your attacking fleet, the enemy fleet and what was destroyed in the enemy fleet

          let message = "You lost a fleet attacking planet: " + destinationPlanet.name;
          if (planetOwner) {
            message = "You lost a fleet attacking " + planetOwner.name + " at planet: " + destinationPlanet.name;
          }
          planetaryConflictData.winningFleet = Fleet.cloneFleet(enemyFleet);
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.AttackingFleetLost,
            message,
            destinationPlanet,
            planetaryConflictData
          );
        }

        if (planetOwner && planetOwner.type == PlayerType.Human) {
          //the defending player is a human player and won
          //PlanetaryConflictData summarizes the attacking fleet, your fleet and what was destroyed in your fleet
          const message =
            "You successfully defended against " + player.name + " attacking planet: " + destinationPlanet.name;
          planetaryConflictData.winningFleet = Fleet.cloneFleet(enemyFleet);
          Events.enqueueNewEvent(
            planetOwner.id,
            EventNotificationType.DefendedAgainstAttackingFleet,
            message,
            destinationPlanet,
            planetaryConflictData
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
                    rp.researchPointsCompleted - attackingPlayerResearch.researchPointsCompleted
                  ) + 1
                )
              );
              const levelIncrease = Research.setResearchPointsCompleted(
                attackingPlayerResearch,
                attackingPlayerResearch.researchPointsCompleted + planetaryConflictData.resourcesLooted.research
              );
              if (levelIncrease) {
                Events.enqueueNewEvent(
                  defendingPlayer.id,
                  EventNotificationType.ResearchStolen,
                  `${Research.researchProgressToString(attackingPlayerResearch)} was stolen by ${player.name}`,
                  destinationPlanet
                );
                Events.enqueueNewEvent(
                  player.id,
                  EventNotificationType.ResearchStolen,
                  `You stole ${Research.researchProgressToString(attackingPlayerResearch)} from ${
                    defendingPlayer.name
                  }`,
                  destinationPlanet
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
          let message = "Your fleet captured planet: " + destinationPlanet.name;
          if (defendingPlayer != null) {
            message = "Your fleet captured planet: " + destinationPlanet.name + ", owned by: " + defendingPlayer.name;
          }
          planetaryConflictData.winningFleet = Fleet.cloneFleet(playerFleet);
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.PlanetCaptured,
            message,
            destinationPlanet,
            planetaryConflictData
          );
        }

        if (defendingPlayer && defendingPlayer.type == PlayerType.Human) {
          //the defending player is a human player and lost
          //planetaryConflictData summarizes your defending fleet, the enemy fleet and what was destroyed in the enemy fleet
          const message = player.name + " captured your planet: " + destinationPlanet.name;
          planetaryConflictData.winningFleet = Fleet.cloneFleet(playerFleet);
          Events.enqueueNewEvent(
            defendingPlayer.id,
            EventNotificationType.PlanetLost,
            message,
            destinationPlanet,
            planetaryConflictData
          );
        }
      }
    }
  }
}
