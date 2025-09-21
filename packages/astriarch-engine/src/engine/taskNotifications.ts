import { TaskNotification, TaskNotificationIndex, TaskNotificationType } from '../model/clientModel';

export class TaskNotifications {
  public static constructTaskNotifications(): TaskNotificationIndex {
    return {
      [TaskNotificationType.BuildQueueEmpty]: {},
      [TaskNotificationType.InsufficientFood]: {},
    };
  }

  public static upsertTask(taskNotifications: TaskNotificationIndex, task: TaskNotification) {
    const taskNotification = taskNotifications[task.type];
    if (!(task.planetId in taskNotification)) {
      taskNotification[task.planetId] = task;
    } else {
      // For existing tasks, update the message and merge data if applicable
      const existingTask = taskNotification[task.planetId];
      existingTask.message = task.message;

      // Merge energy data if both tasks have it
      if (task.data?.energyGenerated && existingTask.data?.energyGenerated) {
        existingTask.data.energyGenerated += task.data.energyGenerated;
      } else if (task.data?.energyGenerated) {
        existingTask.data = { ...existingTask.data, energyGenerated: task.data.energyGenerated };
      }
    }
  }

  public static getTaskNotificationMessage(task: TaskNotification): string {
    // Simply return the message stored in the task
    return task.message;
  }
}
