import type { ConvertItem } from '../hooks/useConverter'

/**
 * One sentence for screen readers about where the batch stands, read from a live region. It changes
 * only when the batch starts or finishes, so a long batch is announced twice, not once per file.
 */
export function describeProgress(items: ConvertItem[]): string {
  if (items.length === 0) return ''
  const remaining = items.filter((item) => item.status === 'queued' || item.status === 'converting').length
  if (remaining > 0) return `Converting ${remaining} ${remaining === 1 ? 'image' : 'images'}…`

  const done = items.filter((item) => item.status === 'done').length
  const failed = items.filter((item) => item.status === 'error').map((item) => ` ${item.file.name}: ${item.error}.`)
  return `${done} of ${items.length} ${items.length === 1 ? 'image' : 'images'} converted.${failed.join('')}`
}
