import Dexie, { type EntityTable } from 'dexie';
import type { NoteEntity, SystemConfig } from './types';

export type { NoteEntity, NoteStatus, SystemConfig } from './types';

export class KagerouDB extends Dexie {
  notes!: EntityTable<NoteEntity, 'id'>;
  config!: EntityTable<SystemConfig, 'id'>;

  constructor(name = 'kagerou') {
    super(name);
    this.version(1).stores({
      notes: 'id, status, createdAt, lastPolishedAt',
      config: 'id',
    });
  }
}

export const db = new KagerouDB();

export const DEFAULT_CONFIG: SystemConfig = {
  id: 'app_config',
  lastKnownTime: 0,
  debugTimeOffsetMs: 0,
  isInitialized: false,
};
