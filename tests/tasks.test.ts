import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Task } from '@/db/schema';
import type { ValidationErrorResponse } from '@/lib/types';

import { resetDb } from './helpers/db';

beforeEach(async () => {
  await resetDb();
});

describe('tasks routes', () => {
  it('lists tasks', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks');
    expect(response.status).toBe(200);
    const json = (await response.json()) as Task[];
    expect(json).toEqual([]);
  });

  it('creates a task', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'First task', done: false }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Task;
    expect(json.name).toBe('First task');
    expect(json.done).toBe(false);
    expect(json.id).toBeTypeOf('number');
  });

  it('validates task creation payloads', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Missing done' }),
    });
    expect(response.status).toBe(422);
  });

  it('gets a task by id', async () => {
    const created = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Lookup', done: false }),
    });
    const createdJson = (await created.json()) as Task;

    const response = await SELF.fetch(`http://example.com/api/tasks/${createdJson.id}`);
    expect(response.status).toBe(200);
    const json = (await response.json()) as Task;
    expect(json.name).toBe('Lookup');
  });

  it('returns 404 for missing tasks', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks/999');
    expect(response.status).toBe(404);
  });

  it('returns 422 for invalid task ids', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks/not-a-number');
    expect(response.status).toBe(422);
  });

  it('rejects empty task updates', async () => {
    const created = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Needs update', done: false }),
    });
    const createdJson = (await created.json()) as Task;

    const response = await SELF.fetch(`http://example.com/api/tasks/${createdJson.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    const json = (await response.json()) as ValidationErrorResponse;
    expect(json.success).toBe(false);
  });

  it('updates a task', async () => {
    const created = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Update me', done: false }),
    });
    const createdJson = (await created.json()) as Task;

    const response = await SELF.fetch(`http://example.com/api/tasks/${createdJson.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ done: true }),
    });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Task;
    expect(json.done).toBe(true);
  });

  it('returns 404 when updating missing tasks', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks/999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ done: true }),
    });
    expect(response.status).toBe(404);
  });

  it('deletes a task', async () => {
    const created = await SELF.fetch('http://example.com/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Delete me', done: false }),
    });
    const createdJson = (await created.json()) as Task;

    const response = await SELF.fetch(`http://example.com/api/tasks/${createdJson.id}`, {
      method: 'DELETE',
    });
    expect(response.status).toBe(204);
  });

  it('returns 404 when deleting missing tasks', async () => {
    const response = await SELF.fetch('http://example.com/api/tasks/999', {
      method: 'DELETE',
    });
    expect(response.status).toBe(404);
  });
});
