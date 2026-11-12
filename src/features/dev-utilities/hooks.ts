import { toUserMessage } from '@/core/errors/AppError';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { TransformResult } from './components/TextTransformCard';

/**
 * Applies a cheap synchronous transform to lightly debounced input and captures
 * errors. Computed during render (the React Compiler memoizes it).
 */
export function useTextTransform(
  input: string,
  transform: (text: string) => string,
): TransformResult {
  const debounced = useDebouncedValue(input, 120);
  if (!debounced) return { text: '' };
  try {
    return { text: transform(debounced) };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
