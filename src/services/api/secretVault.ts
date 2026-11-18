/**
 * Secret environment values that the user did not agree to store. They live only in this
 * tab's memory and disappear when it closes.
 */
const vault = new Map<string, Map<string, string>>();

export const secretVault = {
  get(environmentId: string, variableId: string): string | undefined {
    return vault.get(environmentId)?.get(variableId);
  },
  set(environmentId: string, values: ReadonlyMap<string, string>): void {
    if (values.size === 0) vault.delete(environmentId);
    else vault.set(environmentId, new Map(values));
  },
  clear(environmentId?: string): void {
    if (environmentId === undefined) vault.clear();
    else vault.delete(environmentId);
  },
};
