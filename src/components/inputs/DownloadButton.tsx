import { IconButton, Tooltip } from '@mui/material';
import { DocumentDownload } from 'iconsax-reactjs';
import { downloadText } from '@/services/files/textFiles';

export interface DownloadButtonProps {
  /** Content, or a function producing it lazily (large outputs). */
  content: string | (() => string);
  filename: string;
  mimeType?: string;
  label?: string;
  disabled?: boolean;
  onDownloaded?: () => void;
}

export function DownloadButton({
  content,
  filename,
  mimeType = 'application/json',
  label = 'Download',
  disabled,
  onDownloaded,
}: DownloadButtonProps) {
  return (
    <Tooltip title={`${label} (${filename})`}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          disabled={disabled}
          onClick={() => {
            downloadText(typeof content === 'function' ? content() : content, filename, mimeType);
            onDownloaded?.();
          }}
        >
          <DocumentDownload size={18} color="currentColor" />
        </IconButton>
      </span>
    </Tooltip>
  );
}
