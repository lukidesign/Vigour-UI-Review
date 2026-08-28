import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './db.js';
import { TaskStore } from './task-machine.js';

let db: DatabaseSync;
let tasks: TaskStore;

beforeEach(() => {
  db = openDatabase(':memory:');
  tasks = new TaskStore(db);
});
afterEach(() => db.close());

describe('TaskStore', () => {
  it('enforces the happy-path state machine', () => {
    const queued = tasks.create('analyze');
    const running = tasks.transition(queued.id, 'running', { progress: 10, statusText: '分析中' });
    const done = tasks.transition(queued.id, 'succeeded');
    expect(running).toMatchObject({ state: 'running', progress: 10 });
    expect(done).toMatchObject({ state: 'succeeded', progress: 100 });
  });

  it('rejects terminal transitions and decreasing progress', () => {
    const task = tasks.create('capture');
    tasks.transition(task.id, 'running', { progress: 50 });
    expect(() => tasks.transition(task.id, 'running')).toThrow('Invalid task transition');
    expect(() => tasks.transition(task.id, 'failed')).toThrow('errorCode');
    expect(() => tasks.transition(task.id, 'failed', { errorCode: 'X', progress: 10 })).toThrow(RangeError);
  });
});
