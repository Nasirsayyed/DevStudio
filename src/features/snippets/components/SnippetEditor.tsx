import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Copy as DuplicateIcon, Save2, Star1, Trash } from 'iconsax-reactjs';
import { type KeyboardEvent, useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { CodeEditor, CopyButton, Kbd } from '@/components';
import { DownloadButton } from '@/components/inputs/DownloadButton';
import { formatBytes } from '@/core/format/bytes';
import { CODE_LANGUAGES } from '@/core/languages/languages';
import { snippetFileName } from '@/core/snippets/exchange';
import {
  normalizeTags,
  type SnippetDraft,
  snippetDraftSchema,
  SNIPPET_LIMITS,
  SUGGESTED_CATEGORIES,
} from '@/core/snippets/model';
import { utf8ByteLength } from '@/core/json/format';
import type { CodeSnippetEntity } from '@/types/entities';
import { toDraft } from '../draft';

export interface SnippetEditorProps {
  /** Saved snippet being edited, or null for a new one. */
  snippet: CodeSnippetEntity | null;
  initial: SnippetDraft;
  categories: readonly string[];
  tags: readonly string[];
  /** Resolves to true when saved (the form is then marked clean). */
  onSave: (draft: SnippetDraft) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopied: () => void;
}

/** Form for one snippet (react-hook-form + the shared Zod schema). Ctrl/⌘+S saves. */
export function SnippetEditor({
  snippet,
  initial,
  categories,
  tags,
  onSave,
  onDirtyChange,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onCopied,
}: SnippetEditorProps) {
  const form = useForm<SnippetDraft>({
    resolver: zodResolver(snippetDraftSchema),
    defaultValues: initial,
    mode: 'onTouched',
  });
  const { control, register, handleSubmit, formState, reset } = form;
  const { errors, isDirty, isSubmitting } = formState;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // Another tab (or an import) changed this snippet: follow it unless there are local edits.
  const updatedAt = snippet?.updatedAt;
  useEffect(() => {
    if (snippet && !form.formState.isDirty) reset(toDraft(snippet));
  }, [updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = handleSubmit(async (values) => {
    if (await onSave(values)) reset(values);
  });
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void submit();
    }
  };

  const [code, language, title] = useWatch({ control, name: ['code', 'language', 'title'] });
  const languageOption = CODE_LANGUAGES.find((l) => l.id === language) ?? CODE_LANGUAGES[0];
  const categoryOptions = [...new Set([...categories, ...SUGGESTED_CATEGORIES])];

  return (
    <Box
      component="form"
      aria-label={snippet ? `Edit ${snippet.title}` : 'New snippet'}
      noValidate
      onSubmit={(e) => {
        void submit(e);
      }}
      onKeyDown={onKeyDown}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', p: 1.5, pb: 1 }}>
        <TextField
          {...register('title')}
          label="Title"
          size="small"
          fullWidth
          required
          error={Boolean(errors.title)}
          helperText={errors.title?.message}
          slotProps={{ htmlInput: { maxLength: SNIPPET_LIMITS.title } }}
        />
        <Tooltip
          title={
            snippet
              ? snippet.isFavorite
                ? 'Remove from favorites'
                : 'Add to favorites'
              : 'Save the snippet first'
          }
        >
          <span>
            <IconButton
              aria-label={snippet?.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={snippet?.isFavorite === 1}
              disabled={!snippet}
              onClick={onToggleFavorite}
            >
              <Star1
                size={20}
                color={snippet?.isFavorite ? '#f5a524' : 'currentColor'}
                variant={snippet?.isFavorite ? 'Bold' : 'Linear'}
              />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ px: 1.5, pb: 1 }}>
        <Controller
          control={control}
          name="language"
          render={({ field }) => (
            <Autocomplete
              size="small"
              disableClearable
              options={CODE_LANGUAGES}
              value={languageOption}
              getOptionLabel={(o) => o.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => {
                field.onChange(v.id);
              }}
              renderInput={(params) => <TextField {...params} label="Language" />}
              sx={{ minWidth: 170 }}
            />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Autocomplete
              size="small"
              freeSolo
              options={categoryOptions}
              value={field.value}
              onChange={(_, v) => {
                field.onChange(v ?? '');
              }}
              onInputChange={(_, v, reason) => {
                if (reason === 'input') field.onChange(v);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Category"
                  error={Boolean(errors.category)}
                  helperText={errors.category?.message}
                />
              )}
              sx={{ minWidth: 170 }}
            />
          )}
        />
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <Autocomplete
              size="small"
              multiple
              freeSolo
              options={tags.filter(
                (t) => !field.value.some((v) => v.toLowerCase() === t.toLowerCase()),
              )}
              value={field.value}
              onChange={(_, v) => {
                field.onChange(normalizeTags(v));
              }}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return <Chip key={key} size="small" label={option} {...itemProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder={field.value.length ? '' : 'Type and press Enter'}
                  error={Boolean(errors.tags)}
                  helperText={errors.tags?.message ?? errors.tags?.[0]?.message}
                />
              )}
              sx={{ flex: 1, minWidth: 200 }}
            />
          )}
        />
      </Stack>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <TextField
          {...register('description')}
          label="Description"
          size="small"
          fullWidth
          multiline
          maxRows={4}
          error={Boolean(errors.description)}
          helperText={errors.description?.message}
        />
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 240,
          mx: 1.5,
          border: 1,
          borderColor: errors.code ? 'error.main' : 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <CodeEditor
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
              }}
              language={language}
              ariaLabel="Code"
              onRun={() => void submit()}
            />
          )}
        />
      </Box>
      {errors.code && (
        <Alert severity="error" sx={{ mx: 1.5, mt: 1, py: 0 }}>
          {errors.code.message}
        </Alert>
      )}
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: 'center', flexWrap: 'wrap', p: 1.5 }}
      >
        <Button
          type="submit"
          variant="contained"
          startIcon={<Save2 size={16} color="currentColor" />}
          disabled={isSubmitting || (snippet !== null && !isDirty)}
        >
          {snippet ? 'Save changes' : 'Save snippet'}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.5 }}
        >
          <Kbd combo="mod+s" size="small" />
        </Typography>
        {isDirty && snippet && (
          <Button
            size="small"
            onClick={() => {
              reset(toDraft(snippet));
            }}
          >
            Discard changes
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {code.split(/\r\n|\r|\n/).length.toLocaleString()} lines ·{' '}
          {formatBytes(utf8ByteLength(code))}
        </Typography>
        <CopyButton label="Copy code" value={code} onCopied={onCopied} />
        <DownloadButton
          content={code}
          filename={snippetFileName({ title: title || 'snippet', language })}
          label="Download as file"
          disabled={!code}
        />
        {snippet && (
          <>
            <Tooltip title="Duplicate">
              <IconButton size="small" aria-label="Duplicate snippet" onClick={onDuplicate}>
                <DuplicateIcon size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                aria-label="Delete snippet"
                onClick={onDelete}
                sx={{ color: 'error.main' }}
              >
                <Trash size={18} color="currentColor" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>
    </Box>
  );
}
