import { SelectOption } from '@/components/workspace/OptionControls';
import { DIALECT_OPTIONS } from '@/core/sql/dialects';
import { useSqlWorkspaceStore } from '@/stores/sqlWorkspaceStore';

/** The SQL dialect, shared by every SQL tool. */
export function DialectSelect() {
  const dialect = useSqlWorkspaceStore((s) => s.dialect);
  const set = useSqlWorkspaceStore((s) => s.set);
  return (
    <SelectOption
      label="Dialect"
      value={dialect}
      options={DIALECT_OPTIONS}
      width={190}
      onChange={(d) => {
        set({ dialect: d });
      }}
    />
  );
}
