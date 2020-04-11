import * as helpers from './helpers';

// Contains all functions to rotate the visual representation of the content of a plantuml line.
// The visual represent depends on
// * if the arrow goes from left to right or right to left
// * if it is a horizontal (one dash) or vertical arrow (two dashes).

/** Direction to rotate in */
export enum Direction {
	Left,
	Right,
	Swap
}

/**
 * Rotates the given arrow from vertical to horizontal or vice versa.
 *
 * @param arrow actual arrow to rotate
 * @param isVert true if the given arrow is vertical, else horizontal.
 * @return the rotated arrow
 */
function rotateArrow(arrow: string, isVert: boolean): string {
	// - <=> -- or . <=> ..
	if (isVert) {
		return arrow.replace("--", "-").replace("..", ".");
	} else {
		return arrow.replace("-", "--").replace(".", "..");
	}
}


function reverseArrow(arrow: string, dash: number, isDot: boolean, isVert: boolean): string {
	arrow = helpers.reverseHead(arrow);
	let arrowLeft = arrow.substring(0, dash);
	let arrowRight = arrow.substring(dash + (isVert ? 2 : 1));
	return helpers.reverse(arrowRight)
		+ (isVert ? (isDot ? ".." : "--") : (isDot ? "." : "-"))
		+ helpers.reverse(arrowLeft);
}

const regex_mul_1: RegExp = /(\S+)(\s+)(".*")/;
const regex_mul_2: RegExp = /(".*")(\s+)(\S+)/;
// return item and its multiplicity. Example 'A "1"' will get '"1" A'
function reverseWithMul(item: string): string {
	var m = item.match(regex_mul_1);
	if (!m) {
		m = item.match(regex_mul_2);
	}
	if (!m) {
		return item;
	}
	return m[3] + m[2] + m[1];
}

/// Regex to find an arrow in the current line.
const regex: RegExp = /(\s*)(\S+(?:\s+"[^"]+")?)(\s*)(\S*[-~=.]\S*)(\s*)((?:"[^"]+"\s+)?\S+)(.*)/;
// example:                    A "1"                  ->          "2"          B  : foo

// rotate line of plantuml code preserving the dependency.
/* @startuml directions
[B] <-- [A] : up
A -> [C] : right
C --> [D] : down
B <- D : left
@enduml */
export function rotateLine(line: string, dir: Direction): string {
	let m = line.match(regex);
	if (!m) {
		return line;
	}
	let a = 4; // arrow-index
	var arrow = m[a];
	var dash = arrow.indexOf("-");
	var arr = "--";
	if (dash === -1) {
		dash = arrow.indexOf(".");
		arr = "..";
	}
	if (dash === -1) {
		return line;
	}
	let left_space = m[a - 3];
	var left = m[a - 2]; // left element of the arrow
	var right = m[a + 2]; // right elemet the arrow points to
	let right_rest = m[a + 3];

	let isVert = arrow.indexOf(arr, dash) !== -1;
	if ((isVert === (dir === Direction.Right)) || dir === Direction.Swap) {
		// reverse arrow
		arrow = reverseArrow(arrow, dash, arr === "..", isVert);
		// also reverse content
		[left, right] = [reverseWithMul(right), reverseWithMul(left)];
	}
	if (dir !== Direction.Swap) {
		arrow = rotateArrow(arrow, isVert);
	}
	return left_space + left + m[a - 1] + arrow + m[a + 1] + right + right_rest;
}

