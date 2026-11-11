import { createContext, useContext } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the error color. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmationContext = createContext<ConfirmFn | null>(null);

/** Promise-based confirmation: `if (await confirm({...})) { ... }` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmationContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmationProvider>');
  return ctx;
}
