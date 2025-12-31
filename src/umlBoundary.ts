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
  cursorLine: number
): UmlBoundary | undefined {
  const lineCount = lines.length;

  // Search backwards for the start of the UML block
  let startLine = cursorLine;
  while (startLine >= 0 && startLine < lineCount) {
    const currentLine = lines[startLine];
    if (currentLine === undefined) break;
    const text = currentLine.trim();
    const nextLineText = lines[startLine + 1];
    const nextLine =
      startLine + 1 < lineCount && nextLineText !== undefined
        ? nextLineText.trim()
        : "";

    if (
      // auto format starting from the start of the document (without start)
      // or from opening bracket - including that bracket
      text.startsWith("@startuml") ||
      text === "```plantuml" ||
      text.includes("{") ||
      nextLine === "{"
    ) {
      if (text === "{") {
        // add identifier _before_ the opening bracket (like package etc.)
        startLine -= 1;
      } else if (nextLine !== "{" && !text.includes("{")) {
        startLine += 1;
      }
      break;
    }
    startLine -= 1;
  }

  // Search forwards for the end of the UML block
  let bracketCount = 0;
  let endLine = startLine;
  while (endLine >= 0 && endLine < lineCount) {
    const endLineText = lines[endLine];
    if (endLineText === undefined) break;
    const text = endLineText.trim();
    if (
      text === "@enduml" ||
      text === "```" ||
      (text.includes("}") && bracketCount === 1)
    ) {
      if (!text.includes("}")) {
        endLine -= 1;
      }
      break;
    } else if (text.includes("{")) {
      bracketCount += 1;
    } else if (text.includes("}")) {
      bracketCount -= 1;
    }
    endLine += 1;
  }

  // Check if we found valid boundaries
  if (endLine === lineCount || startLine < 0) {
    return undefined;
  }

  return { startLine, endLine };
}
