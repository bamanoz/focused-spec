export function encodeMessage(message) {
  return JSON.stringify(message);
}

export function decodeMessage(encoded) {
  return JSON.parse(encoded);
}
