/**
 * Merges Tailwind class names while resolving conflicting utility classes.
 * @param inputs - Class name values to combine.
 */
export function cn(...inputs: Array<string | undefined | false>): string {
  return inputs.filter(Boolean).join(" ");
}