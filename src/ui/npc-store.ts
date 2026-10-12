import { readNpc, type SavedNpc } from '../npc/saved.ts';

/**
 * Keeps the recent NPCs in this browser, so they are still there on the next
 * visit. They go in IndexedDB rather than localStorage because of the
 * portraits, a few of which would already fill what localStorage allows.
 * Every function gives up quietly when the browser offers no storage.
 */

const DATABASE = 'rpg-easy-map-generator';
const STORE = 'npcs';

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(database.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

/** The NPCs kept here, newest first. */
export async function loadNpcs(): Promise<SavedNpc[]> {
  try {
    const stored = await run<unknown[]>('readonly', (store) => store.getAll());
    return stored
      .map(readNpc)
      .filter((npc) => npc !== null)
      .sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

export async function storeNpc(npc: SavedNpc): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(npc));
  } catch {
    // No storage: the NPC lasts until the page is closed.
  }
}

export async function forgetNpc(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    // Nothing was stored to begin with.
  }
}
