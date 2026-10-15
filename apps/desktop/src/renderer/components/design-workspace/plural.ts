/** "1 edit", "2 edits"; `none` replaces the zero case ("No edits"). English only: the UI is English. */
export function plural(n: number, one: string, many = `${one}s`, none?: string): string {
  if (n === 0 && none !== undefined) return none;
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
