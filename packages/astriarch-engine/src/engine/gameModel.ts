import { PlanetById } from "../model/clientModel";
import { StarShipType } from "../model/fleet";
import { GalaxySizeOption, GameOptions, ModelData, PlanetsPerSystemOption } from "../model/model";
import { PlanetData, PlanetImprovementType, PlanetResourceData, PlanetType } from "../model/planet";
import { PlayerData } from "../model/player";
import { Utils } from "../utils/utils";
import { Fleet } from "./fleet";
import { Grid, GridHex } from "./grid";
import { Planet } from "./planet";
import { PlanetResources } from "./planetResources";
import { Player } from "./player";
import { TradingCenter } from "./tradingCenter";

export interface GameModelData {
  modelData: ModelData;
  grid: Grid;
}

export const playerColors = [
  Utils.ColorRgba(0, 255, 0, 255), //Light Green
  Utils.ColorRgba(200, 0, 200, 255), //Light Purple
  Utils.ColorRgba(0, 128, 255, 255), //Light Blue
  Utils.ColorRgba(255, 0, 0, 255), //Light Red
];

export class GameModel {
  public static constructData(players: PlayerData[], gameOptions: GameOptions): GameModelData {
    const gameStartedAtTime = new Date().getTime();
    const lastSnapshotTime = gameStartedAtTime;
    const currentCycle = 0;
    const tradingCenter = TradingCenter.constructData(players.length);

    const galaxyWidth = 621.0; //1920.0; //TODO: externalize later
    const galaxyHeight = 480.0; //1080.0; //TODO: externalize later
    const grid = new Grid(galaxyWidth, galaxyHeight, gameOptions);
    const planets = GameModel.populatePlanets(grid, players, gameOptions);

    const modelData = {
      gameOptions,
      gameStartedAtTime,
      lastSnapshotTime,
      currentCycle,
      tradingCenter,
      players,
      planets,
    };

    return { modelData, grid };
  }

  private static populatePlanets(grid: Grid, players: PlayerData[], gameOptions: GameOptions): PlanetData[] {
    const planets: PlanetData[] = [];
    const usedPlanetBoundingHexes = new Set();
    for (let q = 0; q < grid.quadrants.length; q++) {
      let r = grid.quadrants[q];

      //get a list of hexes inside this quadrant
      let subQuadrantHexes: GridHex[][] = []; //List<List<Hexagon>>

      for (let iSQ = 0; iSQ < r.children.length; iSQ++) {
        let sub = r.children[iSQ]; //Rect
        subQuadrantHexes[iSQ] = [];

        for (let i in grid.hexes) {
          let h = grid.hexes[i];
          //let testPoint = q == 0 ? h.TopLeftPoint : q == 1 ? h.TopRightPoint : q == 3 ? h.BottomLeftPoint : h.BottomRightPoint;
          if (sub.contains(h.midPoint)) {
            //the hex is inside the quadrant and possibly an outlier on the edge
            //and the hex doesn't lie on the outside of the sub-quadrant
            subQuadrantHexes[iSQ].push(h);
          }
        }
      }

      if (gameOptions.systemsToGenerate == 2 && (q == 1 || q == 3)) continue;

      let possiblePlanetTypes = [PlanetType.PlanetClass1, PlanetType.DeadPlanet, PlanetType.AsteroidBelt];
      let playerHomePlanetHex = null;
      let planetBoundingHex: GridHex | undefined = undefined;
      for (let iSQ = 0; iSQ < r.children.length; iSQ++) {
        let chosenPlanetSubQuadrant = iSQ;
        if (!gameOptions.distributePlanetsEvenly) {
          do {
            chosenPlanetSubQuadrant = Utils.nextRandom(0, r.children.length);
          } while (subQuadrantHexes[chosenPlanetSubQuadrant].length == 0);
        }
        // pick a planet bounding hex at random from the sub-quadrant (at least for now)
        // if we are choosing one of the first 4 planets make sure it is within the min distance from the home planet
        let hexFound = false;
        while (!hexFound) {
          let maxDistanceFromHome =
            gameOptions.galaxySize == GalaxySizeOption.LARGE
              ? 5
              : gameOptions.galaxySize == GalaxySizeOption.MEDIUM
              ? 4
              : gameOptions.galaxySize == GalaxySizeOption.SMALL
              ? 3
              : 2;
          let hexPos = Utils.nextRandom(0, subQuadrantHexes[chosenPlanetSubQuadrant].length);
          planetBoundingHex = subQuadrantHexes[chosenPlanetSubQuadrant][hexPos]; //Hexagon
          if (playerHomePlanetHex) {
            // get distance from home
            let distanceFromHome = Grid.getHexDistance(planetBoundingHex, playerHomePlanetHex);
            if (distanceFromHome > maxDistanceFromHome) {
              console.log("Chosen location for planet too far from Home, picking again:", iSQ, distanceFromHome);
            } else {
              hexFound = true;
            }
          } else {
            hexFound = true;
          }
          if (hexFound) {
            subQuadrantHexes[chosenPlanetSubQuadrant].splice(hexPos, 1); //remove this hex as an option
          }
        }

        //get at least one planet of each type, prefer the highest class planet
        //int type = (Model.PLANETS_PER_QUADRANT - 1) - iSQ;
        let type = 3;
        let pt = PlanetType.PlanetClass2;
        if (iSQ > 0 && possiblePlanetTypes.length <= 3) {
          type = Utils.nextRandom(0, possiblePlanetTypes.length);
          pt = possiblePlanetTypes[type];
          possiblePlanetTypes.splice(type, 1);
        }

        let initialPlanetOwner: PlayerData | undefined = undefined;

        let assignPlayer = false;
        let assignedPlayerIndex = 0;
        let assignedPlayerIndexHomeQuadrant = false;

        //it's a home planet, we'll see if we should assign a player
        if (q == 0) {
          assignedPlayerIndexHomeQuadrant = true;
          if (pt == PlanetType.PlanetClass2) {
            assignPlayer = true;
          }
        } else if (players.length == 2) {
          if (q == 2) {
            assignedPlayerIndexHomeQuadrant = true;
            assignedPlayerIndex = 1;
            if (pt == PlanetType.PlanetClass2) {
              assignPlayer = true;
            }
          }
        } else if (q < players.length) {
          assignedPlayerIndexHomeQuadrant = true;
          assignedPlayerIndex = q;
          if (pt == PlanetType.PlanetClass2) {
            assignPlayer = true;
          }
        }

        if (assignPlayer) {
          initialPlanetOwner = players[assignedPlayerIndex];
          initialPlanetOwner.color = playerColors[assignedPlayerIndex];
        }

        let p = Planet.constructPlanet(pt, planetBoundingHex!.data.id, planetBoundingHex!, initialPlanetOwner);
        usedPlanetBoundingHexes.add(planetBoundingHex?.data.id);
        //if we set an initial owner
        if (initialPlanetOwner) {
          playerHomePlanetHex = planetBoundingHex;
          initialPlanetOwner.homePlanetId = p.id;
          initialPlanetOwner.ownedPlanetIds.push(p.id);
        }

        if (gameOptions.quickStart && assignedPlayerIndexHomeQuadrant && initialPlanetOwner) {
          Player.setPlanetExplored(initialPlanetOwner, p, 0, null);
          p.resources.ore *= 2;
          p.resources.iridium *= 2;
          p.builtImprovements[PlanetImprovementType.Farm] = 3;
          p.builtImprovements[PlanetImprovementType.Colony] = 1;
          p.builtImprovements[PlanetImprovementType.Factory] = 1;
          p.planetaryFleet.starships.push(Fleet.generateStarship(StarShipType.Scout));
        }

        planets.push(p);
      }

      if (gameOptions.planetsPerSystem > PlanetsPerSystemOption.FOUR) {
        let quadrantChances = [25, 25, 25, 25];

        let chanceToGetAsteroid = 40;
        let chanceToGetDead = 34;
        let chanceToGetClass1 = 26;

        for (let iPlanet = 4; iPlanet < gameOptions.planetsPerSystem; iPlanet++) {
          let hexFound = false;

          while (!hexFound) {
            //pick sub quadrant to put the planet in

            let planetBoundingHex: GridHex | undefined = undefined;
            for (let iSQ = 0; iSQ < quadrantChances.length; iSQ++) {
              if (!subQuadrantHexes[iSQ].length) {
                continue;
              }
              let chance = quadrantChances[iSQ];
              let max = quadrantChances.reduce(function (a, b) {
                return Math.max(a, b);
              }, 0);
              if (Utils.nextRandom(0, max) < chance) {
                //pick a planet bounding hex at random from the sub-quadrant (at lest for now)
                let hexPos = Utils.nextRandom(0, subQuadrantHexes[iSQ].length);
                planetBoundingHex = subQuadrantHexes[iSQ][hexPos]; //Hexagon
                subQuadrantHexes[iSQ].splice(hexPos, 1); //remove this hex as an option
                //now that we've picked a quadrant, subtract some off the chances for next time
                quadrantChances[iSQ] -= 6;
                break;
              }
            }

            if (usedPlanetBoundingHexes.has(planetBoundingHex!.data.id)) continue;

            //hex has been found, now randomly choose planet type
            //this logic prefers asteroids then dead then class1 and decreases our chances each time

            let pt = PlanetType.PlanetClass1;
            let max = chanceToGetAsteroid + chanceToGetDead + chanceToGetClass1;
            if (Utils.nextRandom(0, max) > chanceToGetClass1) {
              pt = PlanetType.DeadPlanet;
              if (Utils.nextRandom(0, max) > chanceToGetDead) {
                pt = PlanetType.AsteroidBelt;
                chanceToGetAsteroid -= 15;
              } else {
                chanceToGetDead -= 15;
              }
            } else {
              chanceToGetClass1 -= 15;
            }

            let p = Planet.constructPlanet(pt, planetBoundingHex!.data.id, planetBoundingHex!);
            usedPlanetBoundingHexes.add(planetBoundingHex!.data.id);
            planets.push(p);

            hexFound = true;
          }
        }
      }
    } //foreach quadrant

    return planets;
  }

  public static getPlayerTotalResources(player: PlayerData, planetById: PlanetById): PlanetResourceData {
    const resources = {
      food: 0,
      energy: 0,
      research: 0,
      ore: 0,
      iridium: 0,
      production: 0,
    };

    return player.ownedPlanetIds.reduce((accum, curr) => {
      if (curr in planetById) {
        const planet = planetById[curr];
        accum = PlanetResources.addPlanetResources(accum, planet.resources);
      }
      return accum;
    }, resources);
  }
}
