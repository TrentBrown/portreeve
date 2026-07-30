// @ts-check

/**
 * @param {boolean} json
 * @param {string} key
 * @param {unknown} value
 * @param {string[]} lines
 */
export function renderOutput(json, key, value, lines) {
  if (json) {
    console.log(JSON.stringify({ version: 1, [key]: value }));
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}
