/** The last path segment, for both POSIX and Windows separators. */
export function campaignFileName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const segment = trimmed.split(/[\\/]/).pop();
  return segment === undefined || segment === "" ? path : segment;
}
