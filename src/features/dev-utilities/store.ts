import { create } from 'zustand';

/**
 * In-memory hand-off between the JWT decoder and verifier. Tokens are
 * credentials: they are never persisted (no localStorage, IndexedDB or history).
 */
interface UtilitiesState {
  jwt: string;
  setJwt: (jwt: string) => void;
}

export const useUtilitiesStore = create<UtilitiesState>()((set) => ({
  jwt: '',
  setJwt: (jwt) => set({ jwt }),
}));
