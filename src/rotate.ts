import { Line, CombinedDirection } from "./uml/line.js";

/** Contains functions to rotate the visual representation of the content of a plantuml line.
The visual represent depends on
 * if the arrow goes from left to right or right to left
 * if it is a horizontal (one dash) or vertical arrow (two dashes).
*/

/** Direction to rotate in */
export enum RotateDirection {
  Left = -1,
  Right = 1,
  Swap = 2,
}

export function rotateDirection(
  c: CombinedDirection,
  r: RotateDirection
): CombinedDirection {
  // combined direction is numbers 0 - 3, hence adding 4 (to ensure positive number) and modulo 4 (which is &3)
  return (c + r + 4) & 3;
}

/**  rotate line of plantuml code preserving the dependency.
@startuml directions
[B] <-- [A] : up
A -> [C] : right
C --> [D] : down
B <- D : left
@enduml 
*/
export function rotateLine(line: string, dir: RotateDirection): string {
  const umlLine = Line.fromString(line);
  if (umlLine === undefined) {
    return line;
  }
  umlLine.setCombinedDirection(
    rotateDirection(umlLine.combinedDirection(), dir)
  );
  return umlLine.toString();
}
