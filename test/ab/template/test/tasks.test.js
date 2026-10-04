import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskList } from '../src/tasks.js';

test('adds and completes tasks', () => {
  const list = createTaskList();
  const task = list.add(' Buy milk ');
  assert.equal(task.title, 'Buy milk');
  list.complete(task.id);
  assert.equal(list.list()[0].done, true);
});

test('rejects an empty title', () => {
  assert.throws(() => createTaskList().add('  '), /title is required/);
});
