import type { IconProps } from 'iconsax-reactjs';
import { createElement } from 'react';
import { getToolIcon } from '@/tools/toolRegistry';
import type { ToolDefinition } from '@/types/tools';

/** Renders the registry icon of a tool (its own, or its module's). */
export function ToolIcon({ tool, ...props }: IconProps & { tool: ToolDefinition }) {
  return createElement(getToolIcon(tool), { color: 'currentColor', ...props });
}
