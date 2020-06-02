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
	return arrow.includes(left) ? arrow.replace(left, right) : arrow.replace(right, left);
}

export function reverseHead(head: string): string {
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

/**
 * Map class that with a getter function that returns the 
 * default value given by the callback function used in the
 * constructor.
 * A default value can not be used as it would always return
 * the same reference.
 */
// eslint-disable-next-line no-undef
export class DefaultMap<K, V> extends Map<K, V> {
	/** Saves the default value callback */
	private defaultVal: () => V;
	public constructor(defaultVal: () => V) {
		super();
		this.defaultVal = defaultVal;
	}
	/** Gets the value for the given key or the default value, 
	 * if none was yet added. Also adds the default value to the map.
	 * In comparison to get() it also returns the actual type, not undefined.
	 * @param key the search key to find its value.
	 * @returns the value - either the saved or default. 
	 */
	public getDef(key: K): V {
		const v = super.get(key);
		if (v === undefined) {
			const newValue = this.defaultVal();
			super.set(key, newValue);
			return newValue;
		} else {
			// value was already added
			return v;
		}
	}
}

