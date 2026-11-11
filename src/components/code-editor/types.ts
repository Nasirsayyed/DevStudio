export interface EditorMarker {
  /** 1-based. */
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface RevealRequest {
  line: number;
  column?: number;
  /** Change this value to re-trigger revealing the same position. */
  token: number;
}

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  /** Monaco language id: 'json', 'plaintext', ... */
  language?: string;
  readOnly?: boolean;
  markers?: readonly EditorMarker[];
  reveal?: RevealRequest | null;
  /** Accessible name of the editor. */
  ariaLabel: string;
  /** Called on Ctrl/⌘+Enter. */
  onRun?: () => void;
  /** Override the user's word-wrap preference. */
  wordWrap?: boolean;
  height?: number | string;
}

export interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  sideBySide?: boolean;
  ariaLabel: string;
  height?: number | string;
}

/** Above this size the editor switches to a lighter "large file" configuration. */
export const LARGE_FILE_CHARS = 2_000_000;
