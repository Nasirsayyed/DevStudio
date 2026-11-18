import { formatDistanceToNowStrict } from 'date-fns';
import { useState } from 'react';
import { useNotify } from '@/components';
import { formatBytes } from '@/core/format/bytes';
import {
  removeJsonDocument,
  saveJsonDocument,
  useJsonDocumentList,
} from '@/hooks/useJsonDocuments';
import type { JsonDocumentEntity } from '@/types/entities';
import type { OpenDocument } from '@/stores/jsonWorkspaceStore';
import { OpenSavedDialog, SaveNameDialog } from './SavedItemDialogs';

export function OpenDocumentDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (doc: JsonDocumentEntity) => void;
}) {
  const [query, setQuery] = useState('');
  const docs = useJsonDocumentList(open, query);
  const items = docs?.map((doc) => ({
    ...doc,
    description: `${formatBytes(doc.sizeBytes)} · updated ${formatDistanceToNowStrict(doc.updatedAt, { addSuffix: true })}`,
  }));
  return (
    <OpenSavedDialog
      open={open}
      title="Open saved document"
      noun="document"
      emptyHint="Use “Save” in any JSON tool to keep a document in this browser."
      query={query}
      onQueryChange={setQuery}
      items={items}
      onClose={onClose}
      onOpen={onOpen}
      onDelete={(doc) => removeJsonDocument(doc.id)}
    />
  );
}

export function SaveDocumentDialog({
  open,
  current,
  content,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: OpenDocument | null;
  content: string;
  onClose: () => void;
  onSaved: (doc: OpenDocument) => void;
}) {
  const notify = useNotify();
  return (
    <SaveNameDialog
      open={open}
      title={current ? 'Save document' : 'Save as document'}
      initialName={current?.name ?? `Untitled ${new Date().toLocaleString()}`}
      helperText={`${formatBytes(content.length)} · stored only in this browser`}
      canSaveAsNew={current !== null}
      onClose={onClose}
      onSave={async (name, asNew) => {
        const doc = await saveJsonDocument({
          ...(current && !asNew ? { id: current.id } : {}),
          name,
          content,
        });
        notify.success(`Saved "${doc.name}"`);
        onSaved({ id: doc.id, name: doc.name });
      }}
    />
  );
}
