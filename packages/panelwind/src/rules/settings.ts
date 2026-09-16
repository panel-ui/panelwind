/**
 * `settings.panelwind` carries what several rules need to know about a project
 * — where its components come from, which helpers hold classes, and a note to
 * append to every diagnostic. A rule's own options win over a setting.
 */
import type { Recognition } from '../sites/collect';
import { warnOnce } from '../project/warn';

export type SharedSettings = Recognition & {
  /** An import prefix that names a component: `@/ds` matches `@/ds` and `@/ds/button`. */
  ui?: string | string[];
  /** Appended to every diagnostic, for a project's own standing instruction. */
  note?: string;
};

function listOf(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** `@/ds` as a pattern that matches `@/ds` and `@/ds/button`, but not `@/dsx`. */
function prefixPattern(prefix: string): string {
  return `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`;
}

export function withSettings<T extends SharedSettings>(context: any, options: T): T {
  const settings: SharedSettings = context.settings?.panelwind ?? {};
  const merged = { ...settings, ...options } as T;

  const prefixes = [...listOf(settings.ui), ...listOf(options.ui)];
  merged.componentImports = [
    ...(options.componentImports ?? settings.componentImports ?? []),
    ...prefixes.map(prefixPattern),
  ];
  merged.ignoreImports = options.ignoreImports ?? settings.ignoreImports ?? [];
  merged.mergeFunctions = [
    ...(settings.mergeFunctions ?? []),
    ...(options.mergeFunctions ?? []),
  ];
  merged.variantFunctions = [
    ...(settings.variantFunctions ?? []),
    ...(options.variantFunctions ?? []),
  ];

  if (settings.note != null && typeof settings.note !== 'string') {
    warnOnce('settings:note', 'settings.panelwind.note must be a string; it is being ignored.');
    merged.note = undefined;
  }

  return merged;
}
