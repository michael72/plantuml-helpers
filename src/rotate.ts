import {Line, CombinedDirection} from './uml';

/** Contains functions to rotate the visual representation of the content of a plantuml line.
The visual represent depends on
 * if the arrow goes from left to right or right to left
 * if it is a horizontal (one dash) or vertical arrow (two dashes).
*/

/** Direction to rotate in */
export enum RotateDirection {
	Left = -1,
	Right = 1,
	Swap = 2
}

export function rotateDirection(c: CombinedDirection, r: RotateDirection) : CombinedDirection {
	// combined direction is numbers 1 - 4, hence subtracting 1, + 4, modulo 4 (which is &3), and adding 1 again
	return ((c + r + 3) & 3) + 1;
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
	let umlLine = Line.fromString(line);
	if (umlLine === undefined) {
		return line;
	}
	umlLine.setCombinedDirection(rotateDirection(umlLine.combinedDirection(), dir));
	return umlLine.toString();
}

