/**
 * Incremental sentence splitter for streaming LLM output.
 *
 * Streaming chat produces tokens one at a time; we hand completed sentences
 * to TTS the moment they're done without waiting for the full response.
 * `push` accepts a chunk and returns the sentences that are now complete.
 * `flush` returns whatever text is still buffered as a final sentence.
 *
 * Boundary rules:
 *   - Split after `.`, `?`, or `!` when followed by whitespace or end-of-chunk.
 *   - Require at least MIN_SENTENCE_CHARS of sentence text before splitting.
 *     Filters abbreviations (`Dr.`, `Mr.`, `e.g.`, `i.e.`, `etc.`) and
 *     decimals (`1.5`, `$3.14` — these don't have whitespace after the dot
 *     anyway, but the guard is belt-and-braces). Chosen low enough that short
 *     acknowledgments like `Great!` (6) and `Exactly!` (8) still get a
 *     head-start on TTS.
 *   - Don't split inside `...` (treat ellipsis as one terminator).
 */
const MIN_SENTENCE_CHARS = 8;
const TERMINATORS = new Set(['.', '?', '!']);

// Common abbreviations that look like sentence ends but aren't. The MIN guard
// catches short candidates like "Dr." on its own, but a long sentence that
// ends with an abbreviation ("I spoke to Dr." or "Use hooks e.g.") would
// otherwise pass the length check and split wrongly.
const ABBREVIATION_END_RE = /(?:e\.g\.|i\.e\.|Mr\.|Mrs\.|Ms\.|Dr\.)$/;

function endsWithKnownAbbreviation(text: string): boolean {
  return ABBREVIATION_END_RE.test(text);
}

export class SentenceAccumulator {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const out: string[] = [];
    let start = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (!TERMINATORS.has(ch)) continue;

      // Collapse consecutive terminators ("..." or "?!") into one boundary.
      let j = i;
      while (j + 1 < this.buffer.length && TERMINATORS.has(this.buffer[j + 1])) {
        j++;
      }

      // Need whitespace (or end of buffer, handled on flush) after the terminator.
      const next = this.buffer[j + 1];
      if (next === undefined) {
        // Trailing terminator, no whitespace yet — wait for more input.
        break;
      }
      if (!/\s/.test(next)) {
        i = j;
        continue;
      }

      const candidate = this.buffer.slice(start, j + 1).trim();
      if (candidate.length < MIN_SENTENCE_CHARS || endsWithKnownAbbreviation(candidate)) {
        // Too short, or ends with a known abbreviation — skip this boundary.
        i = j;
        continue;
      }

      out.push(candidate);
      start = j + 1;
      i = j;
    }

    this.buffer = this.buffer.slice(start);
    return out;
  }

  flush(): string | null {
    const tail = this.buffer.trim();
    this.buffer = '';
    return tail.length > 0 ? tail : null;
  }
}
