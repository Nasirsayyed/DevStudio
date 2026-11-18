import { z } from 'zod';
import { create } from 'zustand';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/services/db/database';
import { clearDatabase } from '@/test/db';
import { createDraftPersistence } from './draftPersistence';

const useStore = create<{ text: string }>()(() => ({ text: '' }));
const schema = z.object({ text: z.string() });
const drafts = createDraftPersistence({
  store: useStore,
  key: 'test.draft',
  schema,
  empty: { text: '' },
  label: 'test',
  select: (s) => ({ text: s.text }),
  restore: (s, d) => (s.text ? {} : { text: d.text }),
});
const stored = async () => (await db.settings.get('test.draft'))?.value;

beforeEach(async () => {
  await clearDatabase(db);
  useStore.setState({ text: '' });
  await drafts.hydrate();
});

afterEach(() => {
  drafts.reset();
});

describe('createDraftPersistence', () => {
  it('debounces saves, and flush() writes a pending change at once', async () => {
    useStore.setState({ text: 'hello' });
    expect(await stored()).toBeUndefined();
    await drafts.flush();
    expect(await stored()).toEqual({ text: 'hello' });
  });

  it('writes pending changes when the page is hidden', async () => {
    useStore.setState({ text: 'leaving' });
    window.dispatchEvent(new Event('pagehide'));
    await expect.poll(stored).toEqual({ text: 'leaving' });
  });

  it('restores a stored draft into empty state only', async () => {
    useStore.setState({ text: 'kept' });
    await drafts.flush();
    drafts.reset();
    useStore.setState({ text: '' });
    await drafts.hydrate();
    expect(useStore.getState().text).toBe('kept');
  });
});
