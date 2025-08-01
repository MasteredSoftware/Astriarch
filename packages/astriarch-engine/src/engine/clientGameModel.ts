import { ClientModelData, ClientPlanet, ClientPlayer, ClientTradingCenter, PlanetById } from '../model/clientModel';
import { ModelData } from '../model/model';
import { PlanetData } from '../model/planet';
import { PlayerData } from '../model/player';
import { TradingCenterData } from '../model/tradingCenter';
import { TaskNotifications } from './taskNotifications';

export class ClientGameModel {
  public static constructClientGameModel(model: ModelData, targetPlayerId: string): ClientModelData {
    const { gameOptions, gameStartedAtTime, lastSnapshotTime, currentCycle } = model;
    const clientTradingCenter = ClientGameModel.constructClientTradingCenter(model.tradingCenter, targetPlayerId);
    const mainPlayer = model.players.find((p) => p.id === targetPlayerId);
    if (!mainPlayer) {
      throw new Error('Unable to find target player in constructClientGameModel!');
    }
    const mainPlayerOwnedPlanets = ClientGameModel.getOwnedPlanets(mainPlayer?.ownedPlanetIds, model.planets);
    const otherPlayers = model.players.filter((player) => player.id !== targetPlayerId);
    const clientPlayers = otherPlayers.map((player) => ClientGameModel.constructClientPlayer(player));
    const mainPlayerExploredPlanetIds = new Set(mainPlayer?.knownPlanetIds);
    const clientPlanets = model.planets.map((p) =>
      ClientGameModel.constructClientPlanet(p, mainPlayerExploredPlanetIds.has(p.id)),
    );

    const taskNotifications = TaskNotifications.constructTaskNotifications();
    return {
      gameOptions,
      gameStartedAtTime,
      lastSnapshotTime,
      currentCycle,
      clientTradingCenter,
      mainPlayer,
      mainPlayerOwnedPlanets,
      clientPlayers,
      clientPlanets,
      taskNotifications,
    };
  }

  public static constructClientPlayer(player: PlayerData): ClientPlayer {
    const { id, type, name, color, points, destroyed, research } = player;

    return {
      id,
      type,
      name,
      color,
      points,
      destroyed,
      research,
    };
  }

  public static constructClientPlanet(planet: PlanetData, targetPlayerHasExploredPlanet: boolean): ClientPlanet {
    const { id, name, originPoint, boundingHexMidPoint } = planet;
    return {
      id,
      name,
      originPoint,
      boundingHexMidPoint,
      type: targetPlayerHasExploredPlanet ? planet.type : null,
    };
  }

  public static constructClientTradingCenter(
    tradingCender: TradingCenterData,
    targetPlayerId: string,
  ): ClientTradingCenter {
    const { energyAmount, foodResource, oreResource, iridiumResource } = tradingCender;

    const mainPlayerTrades = tradingCender.currentTrades.filter((trade) => trade.playerId === targetPlayerId);

    return {
      energyAmount,
      foodResource,
      oreResource,
      iridiumResource,
      mainPlayerTrades: mainPlayerTrades,
    };
  }

  public static getPlanets(planetIds: number[], planets: PlanetData[]) {
    const ownedPlanetIds = new Set(planetIds);
    return planets.filter((p) => ownedPlanetIds.has(p.id));
  }

  public static getPlanetByIdIndex(planets: PlanetData[]): PlanetById {
    return planets.reduce((accum, curr) => {
      accum[curr.id] = curr;
      return accum;
    }, {} as PlanetById);
  }

  public static getOwnedPlanets(planetIds: number[], planets: PlanetData[]) {
    return ClientGameModel.getPlanetByIdIndex(ClientGameModel.getPlanets(planetIds, planets));
  }
}
