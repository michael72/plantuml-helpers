/**
 * Result of finding UML boundaries in text.
 */
export interface UmlBoundary {
  /** Start line (inclusive) */
  startLine: number;
  /** End line (inclusive) */
  endLine: number;
}

/**
 * Finds the boundaries of a UML diagram in an array of lines.
 * This is pure logic that can be tested without VS Code dependencies.
 *
 * @param lines Array of text lines
 * @param cursorLine The line where the cursor is positioned
 * @returns The start and end line numbers, or undefined if no UML found
 */
export function findUmlBoundaries(
  lines: string[],
  cursorLine: number,
  withBrackets: boolean
): UmlBoundary | undefined {
  const lineCount = lines.length;

  // Search backwards for the start of the UML block. Braces are balanced on
  // the way up so that a block already closed above the cursor (e.g. a
  // preceding `skinparam x { ... }` or `package { ... }`) is not mistaken
  // for the block enclosing the cursor.
  let startLine = cursorLine;
  let bracketStart = false;
  let unmatchedClosers = 0;
  while (startLine >= 0 && startLine < lineCount) {
    const currentLine = lines[startLine];
    /* v8 ignore next @preserve */
    if (currentLine === undefined) break;
    const text = currentLine.trim();

    if (text.startsWith("@startuml") || text === "```plantuml") {
      startLine += 1;
      break;
    }

    if (withBrackets) {
      const net = _netBraces(text);
      if (net > 0) {
        // the identifier naming the block may sit on the line above a bare "{"
        const prevLineText = startLine > 0 ? lines[startLine - 1] : undefined;
        const label =
          text === "{" && prevLineText !== undefined ? prevLineText.trim() : text;
        if (unmatchedClosers >= net) {
          // this block is already closed above the cursor - keep searching
          unmatchedClosers -= net;
        } else if (!_isStyleBlock(label)) {
          bracketStart = true;
          if (text === "{") {
            // add identifier _before_ the opening bracket (like package etc.)
            startLine -= 1;
          }
          break;
        }
        // style blocks (skinparam) hold no diagram content - keep searching
      } else if (net < 0 && startLine < cursorLine) {
        // closer above the cursor: its block does not enclose the cursor;
        // a closer on the cursor line itself still counts as "inside"
        unmatchedClosers -= net;
      } else if (
        net === 0 &&
        startLine === cursorLine &&
        startLine + 1 < lineCount &&
        lines[startLine + 1]?.trim() === "{" &&
        !_isStyleBlock(text)
      ) {
        // cursor on the identifier line directly above the opening bracket
        bracketStart = true;
        break;
      }
    }
    startLine -= 1;
  }

  if (startLine < 0) {
    return undefined;
  }

  // Search forwards for the end of the UML block
  let endLine = startLine;
  let depth = 0;
  while (endLine < lineCount) {
    const endLineText = lines[endLine];
    /* v8 ignore next @preserve */
    if (endLineText === undefined) break;
    const text = endLineText.trim();
    if (text === "@enduml" || text === "```") {
      endLine -= 1;
      break;
    }
    if (bracketStart) {
      depth += _netBraces(text);
      if (depth <= 0 && text.includes("}")) {
        // closing bracket of the block is included in the selection
        break;
      }
    }
    endLine += 1;
  }

  // Check if we found valid boundaries
  if (endLine === lineCount) {
    return undefined;
  }

  return { startLine, endLine };
}

// Style-only blocks contain no diagram content that could be formatted, so
// they are never selected as the enclosing block.
function _isStyleBlock(text: string): boolean {
  return text.toLowerCase().startsWith("skinparam");
}

// Net brace count of a line: "{" minus "}", ignoring braces in quoted text
// (e.g. arrow labels) so they cannot unbalance the block detection.
function _netBraces(line: string): number {
  const text = line.replace(/"[^"]*"/g, "");
  return _count(text, "{") - _count(text, "}");
}

function _count(text: string, char: string): number {
  return text.split(char).length - 1;
}
