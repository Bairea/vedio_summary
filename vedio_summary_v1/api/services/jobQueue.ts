export type JobRunner = (ctx: { signal: AbortSignal }) => Promise<void>;

type QueuedJob = {
  taskId: string;
  runner: JobRunner;
  controller: AbortController;
};

export class JobQueue {
  private queue: QueuedJob[] = [];
  private running: QueuedJob | undefined;

  enqueue(taskId: string, runner: JobRunner): void {
    const controller = new AbortController();
    this.queue.push({ taskId, runner, controller });
    this.pump();
  }

  cancel(taskId: string): boolean {
    if (this.running?.taskId === taskId) {
      this.running.controller.abort();
      return true;
    }

    const idx = this.queue.findIndex((j) => j.taskId === taskId);
    if (idx >= 0) {
      this.queue[idx].controller.abort();
      this.queue.splice(idx, 1);
      return true;
    }

    return false;
  }

  private pump(): void {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;

    this.running = next;
    Promise.resolve()
      .then(() => next.runner({ signal: next.controller.signal }))
      .finally(() => {
        this.running = undefined;
        this.pump();
      });
  }
}

