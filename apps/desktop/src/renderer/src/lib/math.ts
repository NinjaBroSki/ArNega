/**
 * Normalize LaTeX math delimiters before Markdown rendering.
 *
 * Models emit math in several delimiter styles; remark-math only parses
 * dollar delimiters. Convert `\( ... \)` → `$ ... $` and `\[ ... \]` →
 * `$$ ... $$` so everything renders through KaTeX.
 */
export function normalizeMathDelimiters(markdown: string): string {
  if (!markdown.includes('\\(') && !markdown.includes('\\[')) return markdown;
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, expr: string) => `\n$$${expr.trim()}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, expr: string) => `$${expr.trim()}$`);
}
