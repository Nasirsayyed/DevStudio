import { v7 as uuidv7 } from 'uuid';

/** Time-sortable unique id used for all entities. */
export function createId(): string {
  return uuidv7();
}
