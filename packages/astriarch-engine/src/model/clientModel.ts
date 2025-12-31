import { PointData } from '../shapes/shapes';
import { ModelBase } from './model';
import { PlanetData, PlanetType } from './planet';
import { ColorRgbaData, PlayerData, PlayerType } from './player';
import { ResearchData } from './research';
import { TradeData, TradingCenterBase } from './tradingCenter';

export type PlanetById = Record<number, PlanetData>;

export interface ClientPlayer {
  id: string;
  type: PlayerType;
  name: string;
  color: ColorRgbaData;
  points: number;
  destroyed: boolean;
  research: ResearchData;
}

export interface ClientPlanet {
  id: number;
  name: string;
  originPoint: PointData;
  boundingHexMidPoint: PointData;
  type: PlanetType | null; //NOTE: Populated when the main player explores the planet
}

export interface ClientTradingCenter extends TradingCenterBase {
  mainPlayerTrades: TradeData[];
}

export type TaskNotificationByPlanetId = Record<number, TaskNotification>;

export interface TaskNotification {
  type: TaskNotificationType;
  planetId: number;
  planetName: string;
  message: string;
  data?: { energyGenerated?: number }; // Make data optional and flexible
}

export enum TaskNotificationType {
  BuildQueueEmpty = 0,
  InsufficientFood = 1,
  CitizensProtesting = 2,
}

export type TaskNotificationIndex = Record<TaskNotificationType, TaskNotificationByPlanetId>;

export interface ClientModelData extends ModelBase {
  clientTradingCenter: ClientTradingCenter;
  mainPlayer: PlayerData;
  mainPlayerOwnedPlanets: PlanetById;
  clientPlayers: ClientPlayer[];
  clientPlanets: ClientPlanet[];

  taskNotifications: TaskNotificationIndex;

  /**
   * Rolling checksum of all events processed by this client.
   * Used to detect desync - if client and server checksums diverge,
   * we know events were missed or applied out of order.
   * Empty string initially, then updated with each event batch.
   */
  lastEventChecksum?: string;

  /**
   * Checksum of critical client model state (planets, fleets, resources).
   * Used to detect state desync - if client and server state checksums diverge,
   * we know the actual game state is out of sync (different from event sequence issues).
   * Updated after every state change.
   */
  clientModelChecksum?: string;
}
