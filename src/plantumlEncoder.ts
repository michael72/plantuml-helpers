import * as zlib from "zlib";

/**
 * PlantUML text encoding module.
 * Encodes PlantUML diagram text for use in URLs.
 *
 * The encoding process:
 * 1. Encode text as UTF-8
 * 2. Compress with Deflate
 * 3. Re-encode using PlantUML's custom base64-like encoding
 *
 * @see https://plantuml.com/text-encoding
 */

// PlantUML uses a custom base64 alphabet:
// Standard base64: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
// PlantUML:        0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_
const PLANTUML_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/**
 * Encodes a 6-bit value to a PlantUML base64 character.
 */
function encode6bit(value: number): string {
  return PLANTUML_ALPHABET.charAt(value & 0x3f);
}

/**
 * Encodes 3 bytes into 4 PlantUML base64 characters.
 */
function encode3bytes(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

/**
 * Encodes a byte array to PlantUML's base64-like format.
 */
function encodeToPlantUmlBase64(data: Uint8Array): string {
  let result = "";
  const length = data.length;

  for (let i = 0; i < length; i += 3) {
    const b1 = data[i] ?? 0;
    const b2 = data[i + 1] ?? 0;
    const b3 = data[i + 2] ?? 0;
    result += encode3bytes(b1, b2, b3);
  }

  return result;
}

/**
 * Encodes PlantUML diagram text for use in a PlantUML server URL.
 *
 * @param text The PlantUML diagram source text
 * @returns The encoded string ready for URL usage
 */
export function encodePlantUml(text: string): string {
  // Convert to UTF-8 buffer using TextEncoder (standard API)
  const encoder = new TextEncoder();
  const utf8Buffer = encoder.encode(text);

  // Compress with raw deflate (no zlib header)
  const deflated = zlib.deflateRawSync(utf8Buffer, { level: 9 });

  // Encode to PlantUML's base64-like format
  return encodeToPlantUmlBase64(deflated);
}
