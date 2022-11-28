import { EventNotification, EventNotificationType, PlanetaryConflictData } from "../model/eventNotification";
import { PlanetData } from "../model/planet";

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
