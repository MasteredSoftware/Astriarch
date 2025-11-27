import { ClientModelData, PlanetById, TaskNotificationType } from '../model/clientModel';
import { EarnedPointsType, earnedPointsConfigByType } from '../model/earnedPoints';
import { FleetData, StarshipAdvantageData } from '../model/fleet';
import { PlanetData, PlanetHappinessType, PlanetImprovementType, PlanetProductionItemData } from '../model/planet';
import { ColorRgbaData, EarnedPointsByType, PlayerData, PlayerType } from '../model/player';
import { Fleet } from './fleet';
import {
  ClientEvent,
  ClientNotification,
  ClientNotificationType,
  ShipsAutoQueuedNotification,
  PopulationStarvationNotification,
  FoodShortageRiotsNotification,
  PlanetLostDueToStarvationNotification,
  CitizensProtestingNotification,
  PopulationGrewNotification,
  ResourcesAutoSpentNotification,
} from './GameCommands';
import { AdvanceGameClockForPlayerData, GameModel } from './gameModel';
import { Grid } from './grid';
import { Planet } from './planet';
import { PlanetProductionItem } from './planetProductionItem';
import { PlanetResources } from './planetResources';
import { Research } from './research';
import { TaskNotifications } from './taskNotifications';

export class Player {
  public static constructPlayer(id: string, type: PlayerType, name: string, color: ColorRgbaData): PlayerData {
    const research = Research.constructResearch();
    const earnedPointsByType = Object.values(EarnedPointsType).reduce((accum, curr) => {
      accum[curr as EarnedPointsType] = 0;
      return accum;
    }, {} as EarnedPointsByType);
    return {
      id,
      type,
      name,
      research,
      color,
      lastTurnFoodNeededToBeShipped: 0,
      lastTurnFoodShipped: 0,
      options: { showPlanetaryConflictPopups: false },
      ownedPlanetIds: [],
      knownPlanetIds: [],
      lastKnownPlanetFleetStrength: {},
      planetBuildGoals: {},
      homePlanetId: null,
      earnedPointsByType,
      points: 0,
      fleetsInTransit: [],
      destroyed: false,
    };
  }

  public static setPlanetExplored(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | undefined,
  ) {
    p.knownPlanetIds.push(planet.id);
    p.knownPlanetIds = [...new Set(p.knownPlanetIds)];
    Player.setPlanetLastKnownFleetStrength(p, planet, cycle, lastKnownOwnerId);
  }

  public static setPlanetLastKnownFleetStrength(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | undefined,
  ) {
    const { defenders, scouts, destroyers, cruisers, battleships, spaceplatforms } = Fleet.countStarshipsByType(
      planet.planetaryFleet,
    );
    const lastKnownFleet = Fleet.generateFleetWithShipCount(
      defenders,
      scouts,
      destroyers,
      cruisers,
      battleships,
      spaceplatforms,
      planet.boundingHexMidPoint,
    );
    const lastKnownFleetData = Fleet.constructLastKnownFleet(cycle, lastKnownFleet, lastKnownOwnerId);
    p.lastKnownPlanetFleetStrength[planet.id] = lastKnownFleetData;
  }

  public static advanceGameClockForPlayer(data: AdvanceGameClockForPlayerData): {
    fleetsArrivingOnUnownedPlanets: FleetData[];
    events: ClientEvent[];
    notifications: ClientNotification[];
  } {
    const events: ClientEvent[] = [];
    const notifications: ClientNotification[] = [];

    // Clear task notifications so they can be regenerated fresh this cycle
    // This ensures resolved issues (like adding items to empty build queues) don't persist
    TaskNotifications.clearAllTaskNotifications(data.clientModel.taskNotifications);

    const autoQueueNotifications = Player.addLastStarShipToQueueOnPlanets(data);
    notifications.push(...autoQueueNotifications);

    Player.generatePlayerResources(data);

    const researchNotifications = Research.advanceResearchForPlayer(data);
    notifications.push(...researchNotifications);

    const eatAndStarveNotifications = this.eatAndStarve(data);
    notifications.push(...eatAndStarveNotifications);

    const protestNotifications = this.adjustPlayerPlanetProtestLevels(data); // deterministic
    notifications.push(...protestNotifications);

    const buildNotifications = this.buildPlayerPlanetImprovements(data); // deterministic
    notifications.push(...buildNotifications);

    const populationNotifications = this.growPlayerPlanetPopulation(data); // deterministic
    notifications.push(...populationNotifications);

    const repairNotifications = this.repairPlanetaryFleets(data); // deterministic
    notifications.push(...repairNotifications);

    // moveShips (client must notify the server when it thinks fleets should land on unowned planets)
    const fleetsArrivingOnUnownedPlanets = this.moveShips(data);
    return { fleetsArrivingOnUnownedPlanets, events, notifications };
  }

  public static generatePlayerResources(data: AdvanceGameClockForPlayerData) {
    const { clientModel, cyclesElapsed } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    for (const planet of Object.values(mainPlayerOwnedPlanets)) {
      Planet.generateResources(planet, cyclesElapsed, mainPlayer);
    }
  }

  public static getTotalPopulation(p: PlayerData, ownedPlanets: PlanetById) {
    let totalPop = 0;

    for (const planetId of p.ownedPlanetIds) {
      totalPop += ownedPlanets[planetId].population.length;
    }

    return totalPop;
  }

  public static getTotalResourceAmount(p: PlayerData, ownedPlanets: PlanetById) {
    const totalResources = p.ownedPlanetIds
      .map((planetId) => ownedPlanets[planetId])
      .reduce(
        (accum, curr) => {
          return PlanetResources.addPlanetResources(accum, curr.resources);
        },
        PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0),
      );
    return totalResources;
  }

  /**
   * returns true if the planet already has reinforcements arriving
   */
  public static planetContainsFriendlyInboundFleet(p: PlayerData, planet: PlanetData) {
    for (const f of p.fleetsInTransit) {
      if (Grid.pointsAreEqual(f.destinationHexMidPoint, planet.boundingHexMidPoint)) {
        return true;
      }
    }

    return false;
  }

  /**
   * returns an array of the Owned Planets sorted by population and improvement count descending
   */
  public static getOwnedPlanetsListSorted(p: PlayerData, ownedPlanets: PlanetById): PlanetData[] {
    const sortedOwnedPlanets = p.ownedPlanetIds.map((planetId) => ownedPlanets[planetId]);
    sortedOwnedPlanets.sort(Planet.planetPopulationImprovementCountComparerSortFunction);
    return sortedOwnedPlanets;
  }

  /**
   * Increases the players points
   */
  public static increasePoints(p: PlayerData, type: EarnedPointsType, amount: number) {
    const config = earnedPointsConfigByType[type];

    const additionalPoints = config.pointsPer * amount;
    p.earnedPointsByType[type] = Math.min(p.earnedPointsByType[type] + additionalPoints, config.maxPoints);

    p.points = Object.values(p.earnedPointsByType).reduce((accum, curr) => accum + curr, 0);
    return p.points;
  }

  public static enqueueProductionItemAndSpendResourcesIfPossible(
    clientModel: ClientModelData,
    grid: Grid,
    planet: PlanetData,
    item: PlanetProductionItemData,
  ): boolean {
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;

    // Use the new comprehensive validation
    const validationResult = PlanetProductionItem.canBuild(planet, mainPlayer, mainPlayerOwnedPlanets, item);
    const canBuild = validationResult.result === 'can-build';

    if (canBuild) {
      Planet.enqueueProductionItemAndSpendResources(grid, mainPlayer, mainPlayerOwnedPlanets, planet, item);
    }
    return canBuild;
  }

  /**
   * Checks if a production item can be built, returning only true/false for resource availability
   * This is the original simpler check for backwards compatibility
   */
  public static canBuildBasedOnResources(clientModel: ClientModelData, item: PlanetProductionItemData): boolean {
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    return PlanetProductionItem.hasSufficientResources(mainPlayer, mainPlayerOwnedPlanets, item);
  }

  public static addLastStarShipToQueueOnPlanets(data: AdvanceGameClockForPlayerData) {
    const { clientModel, grid } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const totalResources = this.getTotalResourceAmount(mainPlayer, mainPlayerOwnedPlanets);
    let autoQueuedCount = 0;
    const autoQueuedFleet = Fleet.generateFleet([], null);
    let focusPlanet;
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      if (p.buildLastStarship && p.buildQueue.length == 0 && p.starshipTypeLastBuilt != null) {
        focusPlanet = p;
        //check resources
        let customShipData: StarshipAdvantageData | undefined;
        if (p.starshipCustomShipLastBuilt) {
          customShipData = Research.getResearchDataByStarshipHullType(p.starshipTypeLastBuilt, mainPlayer)!;
        }
        const s = PlanetProductionItem.constructStarShipInProduction(p.starshipTypeLastBuilt, customShipData);

        // Use basic resource check but add special logic for food shipping
        let canBuild = PlanetProductionItem.hasSufficientResources(mainPlayer, mainPlayerOwnedPlanets, s);

        // Additional check: ensure we have surplus energy after food shipping needs
        if (canBuild && totalResources.energy - s.energyCost <= mainPlayer.lastTurnFoodNeededToBeShipped) {
          canBuild = false;
        }

        if (canBuild) {
          autoQueuedCount++;
          autoQueuedFleet.starships.push(Fleet.generateStarship(p.starshipTypeLastBuilt, customShipData));
          Planet.enqueueProductionItemAndSpendResources(grid, mainPlayer, mainPlayerOwnedPlanets, p, s);
        }
      }
    }

    if (autoQueuedCount && focusPlanet) {
      const notification: ShipsAutoQueuedNotification = {
        type: ClientNotificationType.SHIPS_AUTO_QUEUED,
        affectedPlayerIds: [mainPlayer.id],
        data: {
          planetId: focusPlanet.id,
          planetName: focusPlanet.name,
          shipsQueued: Fleet.toString(autoQueuedFleet),
        },
      };
      return [notification];
    }
    return [];
  }

  public static eatAndStarve(data: AdvanceGameClockForPlayerData): ClientNotification[] {
    const { clientModel, cyclesElapsed, currentCycle } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const totalResources = this.getTotalResourceAmount(mainPlayer, mainPlayerOwnedPlanets);
    const notifications: ClientNotification[] = [];
    //for each planet player controls

    //if one planet has a shortage and another a surplus, gold will be spent (if possible) for shipping

    //determine food surplus and shortages
    //shortages will kill off a percentage of the population due to starvation depending on the amount of shortage

    const foodDeficitByPlanet: Record<number, number> = {}; //for calculating starvation later
    const foodSurplusPlanets: PlanetData[] = []; //for costing shipments and starvation later

    //calculate surpluses and deficits
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      p.planetHappiness = PlanetHappinessType.Normal; //reset our happiness

      p.resources.food = p.resources.food - p.population.length * cyclesElapsed; //eat

      if (p.resources.food < 0) {
        const deficit = Math.abs(p.resources.food);
        foodDeficitByPlanet[p.id] = deficit; //signify deficit for starvation
        p.resources.food = 0;

        mainPlayer.lastTurnFoodNeededToBeShipped += deficit / cyclesElapsed; //increment our food shipments needed so next turn we can ensure we have surplus gold
      } else if (p.resources.food > 0) {
        //signify surplus for this planet for shipments
        foodSurplusPlanets.push(p);
      }
    }

    let totalFoodShipped = 0;

    let protestingPlanetNames = '';
    let protestingPlanetCount = 0;
    let lastProtestingPlanet;

    //starve if we don't have surplus at other planets or can't afford to pay for shipments
    for (const planetId in foodDeficitByPlanet) {
      const planet = mainPlayerOwnedPlanets[planetId];
      const deficit = foodDeficitByPlanet[planetId];
      let foodShortageTotal = deficit;
      let shippedAllResources = false; //if we shipped enough food to prevent starvation
      //first see if we can pay for any shipping and there are planets with surplus
      if (totalResources.energy > 0 && foodSurplusPlanets.length > 0) {
        //it will cost one energy per resource shipped
        //look for a planet to send food from
        for (const pSurplus of foodSurplusPlanets) {
          if (pSurplus.resources.food === 0) {
            continue;
          }

          // Calculate how much food we can actually ship (limited by available food and energy for shipping cost)
          const maxFoodCanShip = Math.min(foodShortageTotal, pSurplus.resources.food);
          const energyAvailableForShipping = pSurplus.resources.energy;
          const actualFoodToShip = Math.min(maxFoodCanShip, energyAvailableForShipping);

          if (actualFoodToShip === 0) {
            continue; // No energy available for shipping or no food to ship
          }

          // Spend the actual food from surplus planet
          const actualFoodSpent = PlanetResources.spendFoodAsPossible(pSurplus.resources, actualFoodToShip);

          // Spend energy for shipping cost (1 energy per food shipped)
          const shippingCostSpent = PlanetResources.spendEnergyAsPossible(pSurplus.resources, actualFoodSpent);

          totalFoodShipped += actualFoodSpent;

          foodShortageTotal = foodShortageTotal - actualFoodSpent;
          totalResources.energy = totalResources.energy - shippingCostSpent;

          if (foodShortageTotal === 0) {
            //we shipped enough food
            shippedAllResources = true;
            break;
          }
        }
      }

      if (!shippedAllResources) {
        const foodShortageRatio = foodShortageTotal / (planet.population.length * cyclesElapsed);

        // DETERMINISTIC: Accumulate shortage and lose pop when it reaches threshold
        // Instead of random chance, we track accumulated starvation
        if (planet.population.length > 0) {
          const lastCitizen = planet.population[planet.population.length - 1];

          // Accumulate starvation damage
          lastCitizen.populationChange -= foodShortageRatio;

          // Threshold-based population loss instead of random
          if (lastCitizen.populationChange <= -1.0) {
            // Severe shortage (>=50%) leads to riots and immediate death
            if (foodShortageRatio >= 0.5) {
              let riotReason = '.';
              if (totalResources.energy <= 0 && foodSurplusPlanets.length != 0) {
                riotReason = ', insufficient Energy to ship Food.';
              }

              planet.planetHappiness = PlanetHappinessType.Riots;
              const riotNotification: FoodShortageRiotsNotification = {
                type: ClientNotificationType.FOOD_SHORTAGE_RIOTS,
                affectedPlayerIds: [mainPlayer.id],
                data: {
                  planetId: planet.id,
                  planetName: planet.name,
                  reason: riotReason,
                },
              };
              notifications.push(riotNotification);
            } else {
              // Gradual starvation
              planet.planetHappiness = PlanetHappinessType.Unrest;
              const starvationNotification: PopulationStarvationNotification = {
                type: ClientNotificationType.POPULATION_STARVATION,
                affectedPlayerIds: [mainPlayer.id],
                data: {
                  planetId: planet.id,
                  planetName: planet.name,
                },
              };
              notifications.push(starvationNotification);
            }

            planet.population.pop();
          } else {
            // Unrest but no death yet
            planet.planetHappiness = PlanetHappinessType.Unrest;
            protestingPlanetCount++;
            if (protestingPlanetNames != '') protestingPlanetNames += ', ';
            protestingPlanetNames += planet.name;
            lastProtestingPlanet = planet;
          }
        }

        // DETERMINISTIC: Increase protest based on shortage ratio
        // Citizens directly affected by shortage protest fully, others show solidarity at reduced rate
        // Calculate how many citizens didn't get food: shortage / (population * food per citizen)
        const citizensDirectlyAffected = Math.min(
          Math.ceil(foodShortageTotal / (planet.population.length * cyclesElapsed)),
          planet.population.length,
        );
        const protestDenominator = planet.id == mainPlayer.homePlanetId ? 4 : 2;

        for (let i = 0; i < planet.population.length; i++) {
          const citizen = planet.population[i];
          const isDirectlyAffected = i >= planet.population.length - citizensDirectlyAffected;

          // Directly affected citizens protest fully, others at 25% (social awareness/solidarity)
          const protestMultiplier = isDirectlyAffected ? 1.0 : 0.25;
          const protestIncrease = (foodShortageRatio / protestDenominator) * protestMultiplier;

          citizen.protestLevel += protestIncrease;
          if (citizen.protestLevel > 1) {
            citizen.protestLevel = 1;
          }
        }

        //have to check to see if we removed the last pop and loose this planet from owned planets if so
        if (planet.population.length == 0) {
          //notify user of planet loss
          const planetLostNotification: PlanetLostDueToStarvationNotification = {
            type: ClientNotificationType.PLANET_LOST_DUE_TO_STARVATION,
            affectedPlayerIds: [mainPlayer.id],
            data: {
              planetId: planet.id,
              planetName: planet.name,
            },
          };
          notifications.push(planetLostNotification);

          GameModel.changePlanetOwner(mainPlayer, undefined, planet, currentCycle);
        } else if (planet.id == mainPlayer.homePlanetId) {
          //if this planet is the player's home planet we need to ensure that there is at least one non-protesting citizen because otherwise there is no way to get out of starvation spiral
          const citizens = Planet.getPopulationByContentment(planet);
          if (citizens.content.length == 0) {
            planet.population[0].protestLevel = 0;
          }
        }
      }
    }

    if (protestingPlanetCount > 0 && lastProtestingPlanet) {
      let protestingPlanetReason = '.';
      if (totalResources.energy <= 0 && foodSurplusPlanets.length != 0)
        protestingPlanetReason = ', insufficient Energy to ship Food.';
      let planetPluralized = 'planet: ';
      if (protestingPlanetCount > 1) planetPluralized = 'planets: ';

      const message =
        'Population unrest over lack of Food on ' + planetPluralized + protestingPlanetNames + protestingPlanetReason;

      // Add as persistent task notification
      TaskNotifications.upsertTask(data.clientModel.taskNotifications, {
        type: TaskNotificationType.InsufficientFood,
        planetId: lastProtestingPlanet.id,
        planetName: protestingPlanetNames,
        message: message,
      });
    }

    if (totalFoodShipped != 0) {
      mainPlayer.lastTurnFoodShipped += totalFoodShipped;
    }

    return notifications;
  }

  public static buildPlayerPlanetImprovements(data: AdvanceGameClockForPlayerData): ClientNotification[] {
    const { clientModel, grid } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const notifications: ClientNotification[] = [];

    //build planet improvements
    const planetNameBuildQueueEmptyList = [];
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      const resourceGeneration = Planet.getPlanetWorkerResourceGeneration(p, mainPlayer);
      const results = Planet.buildImprovements(p, mainPlayer, grid, resourceGeneration);

      // Collect notifications from building
      notifications.push(...results.events);

      if (results.buildQueueEmpty) {
        //if the build queue was empty we'll convert planet production to energy
        planetNameBuildQueueEmptyList.push(p.name);

        const energyProduced = p.resources.production / 4.0;
        p.resources.energy += energyProduced;
        p.resources.production = 0;

        const message = `Build queue empty on ${p.name}${energyProduced > 0 ? `, ${energyProduced} Energy generated` : ''}`;

        TaskNotifications.upsertTask(data.clientModel.taskNotifications, {
          type: TaskNotificationType.BuildQueueEmpty,
          planetId: p.id,
          planetName: p.name,
          message: message,
          data: { energyGenerated: energyProduced },
        });
      }
    }

    return notifications;
  }

  public static adjustPlayerPlanetProtestLevels(data: AdvanceGameClockForPlayerData): ClientNotification[] {
    const { clientModel, cyclesElapsed } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const notifications: ClientNotification[] = [];
    //if we have a normal PlanetHappiness (meaning we didn't cause unrest from starvation)
    //	we'll slowly reduce the amount of protest on the planet

    //if half the population or more is protesting, we'll set the planet happiness to unrest
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      if (p.planetHappiness === PlanetHappinessType.Normal) {
        const citizens = Planet.getPopulationByContentment(p);
        let protestingCitizenCount = 0;
        const contentCitizenRatio = citizens.content.length / p.population.length;

        // DETERMINISTIC: Fixed protest reduction rate based on content population, scaled by time
        const baseProtestReduction = Math.max(0.25, contentCitizenRatio) * cyclesElapsed;
        const homeWorldMultiplier = p.id == mainPlayer.homePlanetId ? 2.0 : 1.0;
        const protestReduction = baseProtestReduction * homeWorldMultiplier;

        for (const citizen of citizens.protesting) {
          citizen.protestLevel -= protestReduction;

          if (citizen.protestLevel <= 0) {
            citizen.protestLevel = 0;
            citizen.loyalToPlayerId = mainPlayer.id;
          } else {
            protestingCitizenCount++;
          }
        }
        const citizenText = protestingCitizenCount > 1 ? ' Citizens' : ' Citizen';
        if (protestingCitizenCount >= p.population.length / 2) {
          p.planetHappiness = PlanetHappinessType.Unrest;
          const protestNotification: CitizensProtestingNotification = {
            type: ClientNotificationType.CITIZENS_PROTESTING,
            affectedPlayerIds: [mainPlayer.id],
            data: {
              planetId: p.id,
              planetName: p.name,
              reason: `${protestingCitizenCount}${citizenText} protesting (unrest)`,
            },
          };
          notifications.push(protestNotification);
        } else if (protestingCitizenCount > 0) {
          const protestNotification: CitizensProtestingNotification = {
            type: ClientNotificationType.CITIZENS_PROTESTING,
            affectedPlayerIds: [mainPlayer.id],
            data: {
              planetId: p.id,
              planetName: p.name,
              reason: `${protestingCitizenCount}${citizenText} protesting`,
            },
          };
          notifications.push(protestNotification);
        }
      }
    }

    return notifications;
  }

  public static growPlayerPlanetPopulation(data: AdvanceGameClockForPlayerData): ClientNotification[] {
    const notifications: ClientNotification[] = [];
    const { clientModel, cyclesElapsed } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    //population growth rate is based on available space at the planet and the amount currently there
    //as we fill up the planet, growth rate slows
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      const growthRate = Planet.getPopulationGrowthRate(p, mainPlayer, cyclesElapsed);
      //check if we are growing
      if (growthRate > 0) {
        const lastCitizen = p.population[p.population.length - 1];
        lastCitizen.populationChange += growthRate;
        if (lastCitizen.populationChange >= 1.0) {
          //grow
          lastCitizen.populationChange = 0;
          p.population.push(Planet.constructCitizen(p.type, mainPlayer.id));

          //assign points
          Player.increasePoints(mainPlayer, EarnedPointsType.POPULATION_GROWTH, 1);

          // Generate POPULATION_GREW notification
          const populationGrewNotification: PopulationGrewNotification = {
            type: ClientNotificationType.POPULATION_GREW,
            affectedPlayerIds: [mainPlayer.id],
            data: {
              planetId: p.id,
              planetName: p.name,
              newPopulation: p.population.length,
            },
          };
          notifications.push(populationGrewNotification);
        }
      }
    }
    return notifications;
  }

  public static repairPlanetaryFleets(data: AdvanceGameClockForPlayerData): ClientNotification[] {
    const { clientModel, cyclesElapsed, grid } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const resourcesAutoSpent = { energy: 0, ore: 0, iridium: 0 };
    const totalResources = this.getTotalResourceAmount(mainPlayer, mainPlayerOwnedPlanets);
    let planetTarget;

    //repair fleets on planets
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      //Require a colony and a happy population to even consider repairing a fleet
      if (p.planetHappiness === PlanetHappinessType.Normal && p.builtImprovements[PlanetImprovementType.Colony] > 0) {
        //charge the user a bit for repairing the fleets
        //i.e. 2 gold per 3 damage, 1 ore per 2 damage, 1 iridium per 4 damage
        const maxStrengthToRepair = Math.min(
          Math.floor((totalResources.energy / 2) * 3),
          Math.floor(totalResources.ore * 2),
          Math.floor(totalResources.iridium * 4),
        );

        const totalStrengthRepaired = Fleet.repairPlanetaryFleet(p, maxStrengthToRepair, cyclesElapsed);
        if (totalStrengthRepaired > 0) {
          const energyCost = Math.floor((totalStrengthRepaired * 2) / 3);
          const oreCost = Math.floor(totalStrengthRepaired / 2);
          const iridiumCost = Math.floor(totalStrengthRepaired / 4);
          if (energyCost || oreCost || iridiumCost) {
            Planet.spendResources(grid, mainPlayer, mainPlayerOwnedPlanets, p, energyCost, 0, oreCost, iridiumCost);
            resourcesAutoSpent.energy += energyCost;
            resourcesAutoSpent.ore += oreCost;
            resourcesAutoSpent.iridium += iridiumCost;
            planetTarget = p;
          }

          //assign points
          Player.increasePoints(mainPlayer, EarnedPointsType.REPAIRED_STARSHIP_STRENGTH, totalStrengthRepaired);
        }
      }
    }

    const notifications: ClientNotification[] = [];
    if (planetTarget) {
      // Generate RESOURCES_AUTO_SPENT notification
      const totalResourcesSpent = resourcesAutoSpent.energy + resourcesAutoSpent.ore + resourcesAutoSpent.iridium;
      if (totalResourcesSpent > 0) {
        const resourcesAutoSpentNotification: ResourcesAutoSpentNotification = {
          type: ClientNotificationType.RESOURCES_AUTO_SPENT,
          affectedPlayerIds: [mainPlayer.id],
          data: {
            amount: totalResourcesSpent,
            resourceType: 'resources',
            reason: `Fleet repairs (${resourcesAutoSpent.energy}E/${resourcesAutoSpent.ore}O/${resourcesAutoSpent.iridium}I)`,
          },
        };
        notifications.push(resourcesAutoSpentNotification);
      }
    }
    return notifications;
  }

  public static moveShips(data: AdvanceGameClockForPlayerData) {
    const { clientModel, cyclesElapsed } = data;
    const { mainPlayer, mainPlayerOwnedPlanets } = clientModel;
    const fleetsArrivingOnUnownedPlanets: FleetData[] = [];
    //for each planet and each outgoing fleet on that planet, move the fleet to the player's fleets in transit
    for (const p of Object.values(mainPlayerOwnedPlanets)) {
      mainPlayer.fleetsInTransit = mainPlayer.fleetsInTransit.concat(p.outgoingFleets);
      p.outgoingFleets = [];
    }

    //for each fleet in transit, move the fleet towards it's destination
    for (const f of mainPlayer.fleetsInTransit) {
      Fleet.moveFleet(f, mainPlayer, cyclesElapsed);
    }

    //land fleets arriving on owned planets
    //merge multiple friendly fleets arriving on unowned planets (before conflicts are resolved)
    for (let i = mainPlayer.fleetsInTransit.length - 1; i >= 0; i--) {
      const playerFleet = mainPlayer.fleetsInTransit[i];
      if (playerFleet.parsecsToDestination! <= 0) {
        const destinationPlanet = Planet.getClientPlanetAtMidPoint(
          clientModel.clientPlanets,
          playerFleet.destinationHexMidPoint!,
        );
        if (!destinationPlanet) {
          throw new Error(
            `Unable to find client planet at midpoint: ${Grid.pointDataToString(playerFleet.destinationHexMidPoint!)}`,
          );
        }

        if (destinationPlanet.id in mainPlayerOwnedPlanets) {
          //merge/land fleet
          Fleet.landFleet(mainPlayerOwnedPlanets[destinationPlanet.id].planetaryFleet, playerFleet);
        } else {
          fleetsArrivingOnUnownedPlanets.push(playerFleet);
        }
        mainPlayer.fleetsInTransit.splice(i, 1);
      }
    }
    return fleetsArrivingOnUnownedPlanets;
  }

  /**
   * Resign a player from the game
   * Marks the player as destroyed, clears their owned planets and fleets in transit
   * @param modelData - The model data
   * @param playerId - The ID of the player to resign
   */
  public static resignPlayer(p: PlayerData): void {
    // Mark player as destroyed
    p.destroyed = true;

    // Clear all owned planets - other players can now capture them
    p.ownedPlanetIds = [];

    // Clear all fleets in transit
    p.fleetsInTransit = [];
  }
}
