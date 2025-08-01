import { TaskNotification, TaskNotificationIndex, TaskNotificationType } from '../model/clientModel';

export class TaskNotifications {
  public static constructTaskNotifications(): TaskNotificationIndex {
    return { [TaskNotificationType.BuildQueueEmpty]: {} };
  }

  public static upsertTask(taskNotifications: TaskNotificationIndex, task: TaskNotification) {
    const taskNotification = taskNotifications[task.type];
    if (!(task.planetId in taskNotification)) {
      taskNotification[task.planetId] = task;
    } else {
      taskNotification[task.planetId].data.energyGenerated += task.data.energyGenerated;
    }
  }

  public static getTaskNotificationMessage(task: TaskNotification) {
    let message = `Build queue empty on ${task.planetName}`;
    if (task.data.energyGenerated) {
      message += `, ${task.data.energyGenerated} Energy generated`;
    }
    return message;
  }
}
