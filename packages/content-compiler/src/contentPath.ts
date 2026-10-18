export function canonicalContentPath(contentDir: string, file: string): string {
  const path = file.replaceAll("\\", "/");
  const root = contentDir.replaceAll("\\", "/").replace(/\/+$/, "");
  if (root !== "" && path === root) return "";
  if (root !== "" && path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  return path;
}
