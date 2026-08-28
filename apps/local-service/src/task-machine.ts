import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Task, TaskKind, TaskState } from '@vigour-ui-review/contracts';

const transitions: Readonly<Record<TaskState, readonly TaskState[]>> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

interface TaskRow {
  id: string;
  kind: TaskKind;
  state: TaskState;
  progress: number;
  status_text: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    progress: row.progress,
    statusText: row.status_text,
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TaskStore {
  constructor(private readonly db: DatabaseSync) {}

  create(kind: TaskKind, statusText = '等待处理'): Task {
    const id = `task_${randomUUID().replaceAll('-', '')}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO tasks
      (id, kind, state, progress, status_text, created_at, updated_at)
      VALUES (?, ?, 'queued', 0, ?, ?, ?)`)
      .run(id, kind, statusText, now, now);
    return this.get(id);
  }

  get(id: string): Task {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as unknown as TaskRow | undefined;
    if (!row) throw new Error(`Task not found: ${id}`);
    return fromRow(row);
  }

  transition(id: string, next: TaskState, options: {
    progress?: number;
    statusText?: string;
    errorCode?: string;
    errorMessage?: string;
  } = {}): Task {
    const current = this.get(id);
    if (!transitions[current.state].includes(next)) {
      throw new Error(`Invalid task transition: ${current.state} -> ${next}`);
    }
    if (next === 'failed' && !options.errorCode) {
      throw new Error('Failed tasks require an errorCode');
    }
    const progress = next === 'succeeded' ? 100 : (options.progress ?? current.progress);
    if (!Number.isInteger(progress) || progress < current.progress || progress < 0 || progress > 100) {
      throw new RangeError('Task progress must be an integer from current progress through 100');
    }
    const now = new Date().toISOString();
    const result = this.db.prepare(`UPDATE tasks SET
      state = ?, progress = ?, status_text = ?, error_code = ?, error_message = ?, updated_at = ?
      WHERE id = ? AND state = ?`)
      .run(next, progress, options.statusText ?? current.statusText,
        options.errorCode ?? null, options.errorMessage ?? null, now, id, current.state);
    if (result.changes !== 1) throw new Error(`Concurrent task update rejected: ${id}`);
    return this.get(id);
  }
}
