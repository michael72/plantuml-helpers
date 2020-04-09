/**
 * Replaces the characters that indicate the arrow drawn to the left by the characters
 * that go right - or vice versa. Example: replaces `>` by `<` in `->`
 * 
 * @param arrow the actual arrow where the charactes are replace 
 * @param left representation of a character pointing in left direction
 * @param right opposite representation of left parameter
 * @return the reverted arrow
 */
function _reverseChar(arrow: string, left: string, right: string): string {
	return (arrow.indexOf(left) !== -1) ? arrow.replace(left, right) : arrow.replace(right, left);
}

export function reverseHead(head: string) : string {
    return _reverseChar(head, ">", "<");
}

/**
 * Reverses the whole string. `abcd` gets `dcba`.
 * @param s the string to revers
 * @return the reversed string
 */
export function reverse(s: string): string {
	return s.split("").reverse().join("");
}

