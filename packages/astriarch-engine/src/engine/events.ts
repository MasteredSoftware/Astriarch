import { ClientPlayer } from "../model/clientModel";
import { EventNotification, EventNotificationType, PlanetaryConflictData } from "../model/eventNotification";
import { FleetData } from "../model/fleet";
import { PlanetData } from "../model/planet";
import { Fleet } from "./fleet";
import { PlanetResources } from "./planetResources";

export type Subscription = (playerId: string, enList: EventNotification[]) => void;

export class Events {
  private static subscribers: { [T in string]: Subscription } = {}; // key is player id

  private static eventNotificationQueue: { [T in string]: EventNotification[] } = {};

  public static constructEvent(
    playerId: string,
    type: EventNotificationType,
    message: string,
    planet?: PlanetData,
    data?: PlanetaryConflictData
  ): EventNotification {
    return {
      playerId,
      type,
      message,
      planet,
      data,
    };
  }

  public static enqueueNewEvent(
    playerId: string,
    type: EventNotificationType,
    message: string,
    planet?: PlanetData,
    data?: PlanetaryConflictData
  ): EventNotification {
    return Events.enqueueEvent(Events.constructEvent(playerId, type, message, planet, data));
  }

  public static enqueueEvent(en: EventNotification): EventNotification {
    if (!(en.playerId in Events.eventNotificationQueue)) {
      Events.eventNotificationQueue[en.playerId] = [];
    }
    Events.eventNotificationQueue[en.playerId].push(en);
    return en;
  }

  public static constructPlanetaryConflictData(
    defendingClientPlayer: ClientPlayer | null,
    defendingFleet: FleetData,
    attackingClientPlayer: ClientPlayer,
    attackingFleet: FleetData
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
      resourcesLooted: PlanetResources.constructPlanetResources(0, 0, 0, 0, 0, 0),
    };
  }

  public static publish() {
    for (const [key, value] of Object.entries(Events.eventNotificationQueue)) {
      if (key in Events.subscribers) {
        Events.subscribers[key](key, value);
      }
      // clear out the queue for this player
      Events.eventNotificationQueue[key] = [];
    }
  }

  public static subscribe(playerId: string, callback: Subscription) {
    Events.subscribers[playerId] = callback;
  }
}
