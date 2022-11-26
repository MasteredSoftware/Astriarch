import { GalaxySizeOption, GameOptions, ModelData } from "../model/model";
import { PlanetData, PlanetType } from "../model/planet";
import { PlayerData } from "../model/player";
import { Utils } from "../utils/utils";
import { Grid, GridHex } from "./grid";
import { TradingCenter } from "./tradingCenter";

export interface GameModelData {
  modelData: ModelData;
  grid: Grid;
}

const playerColors = [
  Utils.ColorRgba(0, 255, 0, 255), //Light Green
  Utils.ColorRgba(200, 0, 200, 255), //Light Purple
  Utils.ColorRgba(0, 128, 255, 255), //Light Blue
  Utils.ColorRgba(255, 0, 0, 255), //Light Red
];

export class GameModel {
  private static buildData(players: PlayerData[], gameOptions: GameOptions): GameModelData {
    const gameStartedAtTime = new Date().getTime();
    const lastSnapshotTime = gameStartedAtTime;
    const currentCycle = 0;
    const tradingCenter = TradingCenter.buildData(players.length);

    const galaxyWidth = 1920.0; //TODO: externalize later
    const galaxyHeight = 1080.0; //TODO: externalize later
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
    for (var q = 0; q < grid.quadrants.length; q++) {
      var r = grid.quadrants[q];

      //get a list of hexes inside this quadrant
      var subQuadrantHexes: GridHex[][] = []; //List<List<Hexagon>>

      for (var iSQ = 0; iSQ < r.children.length; iSQ++) {
        var sub = r.children[iSQ]; //Rect
        subQuadrantHexes[iSQ] = [];

        for (var i in grid.hexes) {
          var h = grid.hexes[i];
          //var testPoint = q == 0 ? h.TopLeftPoint : q == 1 ? h.TopRightPoint : q == 3 ? h.BottomLeftPoint : h.BottomRightPoint;
          if (sub.contains(h.midPoint)) {
            //the hex is inside the quadrant and possibly an outlier on the edge
            //and the hex doesn't lie on the outside of the sub-quadrant
            subQuadrantHexes[iSQ].push(h);
          }
        }
      }

      if (gameOptions.systemsToGenerate == 2 && (q == 1 || q == 3)) continue;

      var possiblePlanetTypes = [PlanetType.PlanetClass1, PlanetType.DeadPlanet, PlanetType.AsteroidBelt];
      var playerHomePlanetHex = null;
      for (var iSQ = 0; iSQ < r.children.length; iSQ++) {
        var chosenPlanetSubQuadrant = iSQ;
        if (!gameOptions.distributePlanetsEvenly) {
          do {
            chosenPlanetSubQuadrant = Utils.nextRandom(0, r.children.length);
          } while (subQuadrantHexes[chosenPlanetSubQuadrant].length == 0);
        }
        // pick a planet bounding hex at random from the sub-quadrant (at least for now)
        // if we are choosing one of the first 4 planets make sure it is within the min distance from the home planet
        var hexFound = false;
        while (!hexFound) {
          var maxDistanceFromHome =
            gameOptions.galaxySize == GalaxySizeOption.LARGE
              ? 5
              : gameOptions.galaxySize == GalaxySizeOption.MEDIUM
              ? 4
              : gameOptions.galaxySize == GalaxySizeOption.SMALL
              ? 3
              : 2;
          var hexPos = Utils.nextRandom(0, subQuadrantHexes[chosenPlanetSubQuadrant].length);
          var planetBoundingHex = subQuadrantHexes[chosenPlanetSubQuadrant][hexPos]; //Hexagon
          if (playerHomePlanetHex) {
            // get distance from home
            var distanceFromHome = Grid.getHexDistance(planetBoundingHex, playerHomePlanetHex);
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
        var type = 3;
        var pt = PlanetType.PlanetClass2;
        if (iSQ > 0 && possiblePlanetTypes.length <= 3) {
          type = Utils.nextRandom(0, possiblePlanetTypes.length);
          pt = possiblePlanetTypes[type];
          possiblePlanetTypes.splice(type, 1);
        }

        var initialPlanetOwner = null; //Player

        var assignPlayer = false;
        var assignedPlayerIndex = 0;
        var assignedPlayerIndexHomeQuadrant = false;

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

        var p = new Astriarch.Planet(pt, planetBoundingHex.Id, planetBoundingHex, initialPlanetOwner);
        //if we set an initial owner, give the planet 2 ore and 1 iridium
        if (initialPlanetOwner) {
          playerHomePlanetHex = planetBoundingHex;
          initialPlanetOwner.HomePlanetId = p.Id;
          p.Resources.OreAmount = 2;
          p.Resources.IridiumAmount = 1;
        }

        if (gameOptions.QuickStart && assignedPlayerIndexHomeQuadrant) {
          p.SetPlanetExplored(this, players[assignedPlayerIndex]);
          if (initialPlanetOwner) {
            p.Resources.OreAmount *= 2;
            p.Resources.IridiumAmount *= 2;
            p.AddBuiltImprovement(new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Farm));
            p.AddBuiltImprovement(new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Farm));
            p.AddBuiltImprovement(new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Farm));
            p.AddBuiltImprovement(
              new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Colony)
            );
            p.AddBuiltImprovement(
              new Astriarch.Planet.PlanetImprovement(Astriarch.Planet.PlanetImprovementType.Factory)
            );
            p.PlanetaryFleet.AddShip(new Astriarch.Fleet.StarShip(Astriarch.Fleet.StarShipType.Scout));
          }
        }

        planets.push(p);
      }

      if (gameOptions.PlanetsPerSystem != Astriarch.Model.PlanetsPerSystemOption.FOUR) {
        var quadrantChances = [25, 25, 25, 25];

        var chanceToGetAsteroid = 40;
        var chanceToGetDead = 34;
        var chanceToGetClass1 = 26;

        for (var iPlanet = 4; iPlanet < gameOptions.PlanetsPerSystem; iPlanet++) {
          var hexFound = false;

          while (!hexFound) {
            //pick sub quadrant to put the planet in
            //TODO: should we have another option to evenly space out the picking of quadrants? so that you don't end up with 5 planets in one quadrant potentially?

            for (iSQ = 0; iSQ < quadrantChances.length; iSQ++) {
              if (!subQuadrantHexes[iSQ].length) {
                continue;
              }
              var chance = quadrantChances[iSQ];
              var max = quadrantChances.reduce(function (a, b) {
                return a + b;
              }, 0);
              if (Utils.nextRandom(0, max) < chance) {
                //pick a planet bounding hex at random from the sub-quadrant (at lest for now)
                var hexPos = Utils.nextRandom(0, subQuadrantHexes[iSQ].length);
                var planetBoundingHex = subQuadrantHexes[iSQ][hexPos]; //Hexagon
                subQuadrantHexes[iSQ].splice(hexPos, 1); //remove this hex as an option
                //now that we've picked a quadrant, subtract some off the chances for next time
                quadrantChances[iSQ] -= 6;
                break;
              }
            }

            if (planetBoundingHex.PlanetContainedInHex != null) continue;

            //hex has been found, now randomly choose planet type
            //this logic prefers asteroids then dead then class1 and decreases our chances each time

            var pt = PlanetType.PlanetClass1;
            max = chanceToGetAsteroid + chanceToGetDead + chanceToGetClass1;
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

            var p = new Astriarch.Planet(pt, planetBoundingHex.Id, planetBoundingHex, null); //Planet

            planets.push(p);

            hexFound = true;
          }
        }
      }
    } //foreach quadrant
  }
}
