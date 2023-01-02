import { PlanetById } from "../model/clientModel";
import { EarnedPointsType, earnedPointsConfigByType } from "../model/earnedPoints";
import { EventNotificationType } from "../model/eventNotification";
import { PlanetData, PlanetHappinessType, PlanetImprovementType } from "../model/planet";
import { ColorRgbaData, EarnedPointsByType, PlayerData, PlayerType } from "../model/player";
import { ResearchType } from "../model/research";
import { Utils } from "../utils/utils";
import { Events } from "./events";
import { Fleet } from "./fleet";
import { GameModel } from "./gameModel";
import { Grid } from "./grid";
import { Planet } from "./planet";
import { PlanetResources } from "./planetResources";
import { Research } from "./research";

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
    lastKnownOwnerId: string | undefined
  ) {
    p.knownPlanetIds.push(planet.id);
    p.knownPlanetIds = [...new Set(p.knownPlanetIds)];
    Player.setPlanetLastKnownFleetStrength(p, planet, cycle, lastKnownOwnerId);
  }

  public static setPlanetLastKnownFleetStrength(
    p: PlayerData,
    planet: PlanetData,
    cycle: number,
    lastKnownOwnerId: string | undefined
  ) {
    const { defenders, scouts, destroyers, cruisers, battleships, spaceplatforms } = Fleet.countStarshipsByType(
      planet.planetaryFleet
    );
    let lastKnownFleet = Fleet.generateFleetWithShipCount(
      defenders,
      scouts,
      destroyers,
      cruisers,
      battleships,
      spaceplatforms,
      planet.boundingHexMidPoint
    );
    let lastKnownFleetData = Fleet.constructLastKnownFleet(cycle, lastKnownFleet, lastKnownOwnerId);
    p.lastKnownPlanetFleetStrength[planet.id] = lastKnownFleetData;
  }

  public static advanceGameClockForPlayer(p: PlayerData, ownedPlanets: PlanetById, cyclesElapsed: number, currentCycle: number) {
    Player.generatePlayerResources(p, ownedPlanets, cyclesElapsed);

    Research.advanceResearchForPlayer(p, ownedPlanets);

    this.eatAndStarve(p, ownedPlanets, cyclesElapsed, currentCycle);
    // TODO:
    // adjustPlayerPlanetProtestLevels
    // buildPlayerPlanetImprovements
    // growPlayerPlanetPopulation
    // repair fleets on planets

    // moveShips (client must notify the server when it thinks fleets should land on unowned planets)
    
  }

  public static generatePlayerResources(p: PlayerData, ownedPlanets: PlanetById, cyclesElapsed: number) {
    for (const planet of Object.values(ownedPlanets)) {
      Planet.generateResources(planet, cyclesElapsed, p);
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
      .reduce((accum, curr) => {
        return PlanetResources.addPlanetResources(accum, curr.resources);
      }, PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0));
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

  public static eatAndStarve(player: PlayerData, ownedPlanets: PlanetById, cyclesElapsed: number, currentCycle: number) {
    const totalPop = this.getTotalPopulation(player, ownedPlanets);
    const totalResources = this.getTotalResourceAmount(player, ownedPlanets);
    //for each planet player controls

    //if one planet has a shortage and another a surplus, gold will be spent (if possible) for shipping

    //determine food surplus and shortages
    //shortages will kill off a percentage of the population due to starvation depending on the amount of shortage

    player.lastTurnFoodNeededToBeShipped = 0;

    const foodDeficitByPlanet: {[T in number]: number} = {}; //for calculating starvation later
    const foodSurplusPlanets:PlanetData[] = []; //for costing shipments and starvation later

    //calculate surpluses and deficits
    for (const p of Object.values(ownedPlanets)) {
      p.planetHappiness = PlanetHappinessType.Normal; //reset our happiness

      p.resources.food = p.resources.food - (p.population.length * cyclesElapsed); //eat

      if (p.resources.food < 0) {
        const deficit = Math.abs(p.resources.food);
        foodDeficitByPlanet[p.id] = deficit; //signify deficit for starvation
        p.resources.food = 0;

        player.lastTurnFoodNeededToBeShipped += deficit; //increment our food shipments needed so next turn we can ensure we have surplus gold
      } else if (p.resources.food > 0) {
        //signify surplus for this planet for shipments
        foodSurplusPlanets.push(p);
      }
    }

    let totalFoodShipped = 0;

    let protestingPlanetNames = "";
    let protestingPlanetCount = 0;
    let lastProtestingPlanet;

    //starve if we don't have surplus at other planets or can't afford to pay for shipments
    for (const planetId in foodDeficitByPlanet) {
      const planet = ownedPlanets[planetId];
      const deficit = foodDeficitByPlanet[planetId];
      let foodShortageTotal = deficit;
      let shippedAllResources = false; //if we shipped enough food to prevent starvation
      //first see if we can pay for any shipping and there are planets with surplus
      if (totalResources.energy > 0 && foodSurplusPlanets.length > 0) {
        //it will cost one energy per resource shipped
        //look for a planet to send food from
        for (const pSurplus of foodSurplusPlanets) {
          if(pSurplus.resources.food === 0) {
            continue;
          }
          const amountSpent = PlanetResources.spendEnergyAsPossible(pSurplus.resources, Math.min(foodShortageTotal, pSurplus.resources.food));

          totalFoodShipped += amountSpent;

          foodShortageTotal = foodShortageTotal - amountSpent;
          totalResources.energy = totalResources.energy - amountSpent;

          if (foodShortageTotal === 0) {
            //we shipped enough food
            shippedAllResources = true;
            break;
          }
        }
      }

      if (!shippedAllResources) {
        const foodShortageRatio = (foodShortageTotal / (totalPop * 1.0)) * cyclesElapsed;
        //starvation
        //there is a food shortage ratio chance of loosing one population,
        //if you have 4 pop and 2 food you have a 1 in 2 chance of loosing one
        //otherwise people just slowly starve
        const looseOne = Utils.nextRandom(0, 100) < Math.round(foodShortageRatio * 100);
        if (looseOne) {
          let riotReason = "."; //for shortages
          if (totalResources.energy <= 0 && foodSurplusPlanets.length != 0)
            riotReason = ", insufficient Energy to ship Food.";
          //notify user of starvation
          planet.planetHappiness = PlanetHappinessType.Riots;
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.FoodShortageRiots,
            "Riots over food shortages killed one population on planet: " + planet.name + riotReason,
            planet
          );
          if (planet.population.length > 0) {
            planet.population.pop();
          }
        } //reduce the population a bit
        else {
          if (planet.population.length > 0) {
            planet.planetHappiness = PlanetHappinessType.Unrest;

            const c = planet.population[planet.population.length - 1];
            c.populationChange -= foodShortageRatio;
            if (c.populationChange <= -1.0) {
              //notify user of starvation
              Events.enqueueNewEvent(
                player.id,
                EventNotificationType.PopulationStarvation,
                "You lost one population due to food shortages on planet: " + planet.name,
                planet
              );
              planet.population.pop();
            } else {
              protestingPlanetCount++;

              if (protestingPlanetNames != "") protestingPlanetNames += ", ";
              protestingPlanetNames += planet.name;

              lastProtestingPlanet = planet;
            }
          }
        }

        //citizens will further protest depending on the amount of food shortages
        for (const citizen of planet.population) {
          //citizens on the home planet are more forgiving
          const protestDenominator = planet.id == player.homePlanetId ? 4 : 2;
          if (Utils.nextRandom(0, protestDenominator) === 0) {
            //only have 1/2 the population protest so the planet isn't totally screwed
            citizen.protestLevel += Utils.nextRandomFloat(0, foodShortageRatio);
            if (citizen.protestLevel > 1) {
              citizen.protestLevel = 1;
            }
          }
        }

        //have to check to see if we removed the last pop and loose this planet from owned planets if so
        if (planet.population.length == 0) {
          //notify user of planet loss
          Events.enqueueNewEvent(
            player.id,
            EventNotificationType.PlanetLostDueToStarvation,
            "You have lost control of " + planet.name + " due to starvation",
            planet
          );

          GameModel.changePlanetOwner(player, undefined, planet, currentCycle);
        } else if (planet.id == player.homePlanetId) {
          //if this planet is the player's home planet we need to ensure that there is at least one non-protesting citizen because otherwise there is no way to get out of starvation spiral
          const citizens = Planet.getPopulationByContentment(planet);
          if (citizens.content.length == 0) {
            planet.population[0].protestLevel = 0;
          }
        }
      }
    }

    if (protestingPlanetCount > 0) {
      let protestingPlanetReason = ".";
      if (totalResources.energy <= 0 && foodSurplusPlanets.length != 0)
        protestingPlanetReason = ", insufficient Gold to ship Food.";
      let planetPluralized = "planet: ";
      if (protestingPlanetCount > 1) planetPluralized = "planets: ";
      //notify user of population unrest
      Events.enqueueNewEvent(
        player.id,
        EventNotificationType.InsufficientFood,
        "Population unrest over lack of Food on " + planetPluralized + protestingPlanetNames + protestingPlanetReason,
        lastProtestingPlanet
      );
    }

    if (totalFoodShipped != 0) {
      Events.enqueueNewEvent(
        player.id,
        EventNotificationType.ResourcesAutoSpent,
        totalFoodShipped + " Energy spent shipping Food"
      );
    }
  }
}
