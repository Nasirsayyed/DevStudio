import { IconButton, Tooltip } from '@mui/material';
import { Copy, TickCircle } from 'iconsax-reactjs';
import { useEffect, useState } from 'react';

export interface CopyButtonProps {
  /** Text to copy, or a function that produces it lazily. */
  value: string | (() => string);
  label?: string;
  size?: 'small' | 'medium';
  onCopied?: () => void;
  onError?: (error: unknown) => void;
}

export function CopyButton({
  value,
  label = 'Copy',
  size = 'small',
  onCopied,
  onError,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const t = window.setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      window.clearTimeout(t);
    };
  }, [copied]);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(typeof value === 'function' ? value() : value);
      setCopied(true);
      onCopied?.();
    } catch (error) {
      onError?.(error);
    }
  };

  return (
    <Tooltip title={copied ? 'Copied!' : label}>
      <IconButton
        size={size}
        onClick={handleClick}
        aria-label={label}
        color={copied ? 'success' : 'default'}
      >
        {copied ? (
          <TickCircle size={18} color="currentColor" />
        ) : (
          <Copy size={18} color="currentColor" />
        )}
      </IconButton>
    </Tooltip>
  );
}
