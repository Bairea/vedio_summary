import { JobQueue } from "./jobQueue.js";
import { TaskService } from "./taskService.js";

export const jobQueue = new JobQueue();
export const taskService = new TaskService(jobQueue);

