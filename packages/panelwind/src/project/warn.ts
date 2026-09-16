/**
 * A misconfiguration is worth saying once. Said per file it is noise, and an
 * editor session lints the same file on every keystroke — so every warning
 * here is keyed and emitted at most once per process.
 */
const warned = new Set<string>();

export function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`panelwind: ${message}`);
}

export function clearWarnings() {
  warned.clear();
}
