/**
 * Tiny line-oriented diff helper used to populate `--dry-run` previews.
 *
 * This is not a full Myers diff — it's the cheapest output that still lets a
 * user see what `openlore install --dry-run` would do without us shelling out
 * to `diff(1)`. Lines that match are skipped (with a `...` separator if there
 * are unchanged runs between hunks); changed lines are prefixed with `+` /
 * `-`. The result is meant for human eyeballing, not machine consumption.
 */

const MAX_PREVIEW_LINES = 60;

export function previewCreate(filePath: string, content: string): string {
  const lines = content.split('\n');
  const truncated = lines.length > MAX_PREVIEW_LINES;
  const shown = truncated ? lines.slice(0, MAX_PREVIEW_LINES) : lines;
  const body = shown.map((l) => `+ ${l}`).join('\n');
  const suffix = truncated ? `\n  ... (${lines.length - MAX_PREVIEW_LINES} more lines)` : '';
  return `--- (new file) ${filePath}\n${body}${suffix}`;
}

export function previewDiff(filePath: string, before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');

  // Trim common prefix and suffix so we focus on the changed region.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;

  const removed = a.slice(prefix, a.length - suffix);
  const added = b.slice(prefix, b.length - suffix);

  const truncatedRemoved = removed.length > MAX_PREVIEW_LINES;
  const truncatedAdded = added.length > MAX_PREVIEW_LINES;
  const shownRemoved = truncatedRemoved ? removed.slice(0, MAX_PREVIEW_LINES) : removed;
  const shownAdded = truncatedAdded ? added.slice(0, MAX_PREVIEW_LINES) : added;

  const header = `--- ${filePath} @ line ${prefix + 1}`;
  const minus = shownRemoved.map((l) => `- ${l}`).join('\n');
  const plus = shownAdded.map((l) => `+ ${l}`).join('\n');

  const parts = [header];
  if (minus) parts.push(minus);
  if (truncatedRemoved) parts.push(`  ... (${removed.length - MAX_PREVIEW_LINES} more removed lines)`);
  if (plus) parts.push(plus);
  if (truncatedAdded) parts.push(`  ... (${added.length - MAX_PREVIEW_LINES} more added lines)`);
  return parts.join('\n');
}
