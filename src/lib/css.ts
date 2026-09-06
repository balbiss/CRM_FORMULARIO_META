import type { CSSProperties } from 'react';

/** Parses a literal CSS declaration string ("display:flex;gap:14px") into a React style object. */
export function css(str: string | undefined | null): CSSProperties {
  if (!str) return {};
  const obj: Record<string, string> = {};
  for (const rule of str.split(';')) {
    const idx = rule.indexOf(':');
    if (idx === -1) continue;
    const prop = rule.slice(0, idx).trim();
    const value = rule.slice(idx + 1).trim();
    if (!prop || !value) continue;
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    obj[camel] = value;
  }
  return obj as CSSProperties;
}
