export { NotificationProvider } from './feedback/NotificationProvider';
export {
  useNotify,
  type NotificationOptions,
  type NotifyApi,
} from './feedback/notificationContext';
export { ConfirmationDialog, ConfirmationProvider } from './feedback/ConfirmationDialog';
export { useConfirm, type ConfirmOptions } from './feedback/confirmationContext';
export { ErrorBoundary } from './feedback/ErrorBoundary';
export { EmptyState } from './feedback/EmptyState';
export { LoadingState } from './feedback/LoadingState';
export { PageContainer } from './layout/PageContainer';
export { ToolHeader } from './layout/ToolHeader';
export { SearchInput } from './inputs/SearchInput';
export { CopyButton } from './inputs/CopyButton';
export { Kbd } from './data-display/Kbd';
export { SectionCard } from './data-display/SectionCard';
export { ToolCard } from './data-display/ToolCard';
export { ToolIcon } from './data-display/ToolIcon';
export { CodeEditor, DiffEditor } from './code-editor/CodeEditor';
export type {
  CodeEditorProps,
  DiffEditorProps,
  EditorMarker,
  RevealRequest,
} from './code-editor/types';
export { SplitPane } from './layout/SplitPane';
export { ToolWorkspace } from './layout/ToolWorkspace';
export { ToolSidebar } from './layout/ToolSidebar';
export { Panel } from './layout/Panel';

// Heavier components (virtualization, file I/O) are intentionally NOT exported
// here, so the app shell's barrel import never pulls them into the initial
// bundle. Import them by path:
//   @/components/data-display/JsonViewer, @/components/data-display/DataGrid,
//   @/components/inputs/FileDropZone, @/components/inputs/DownloadButton
