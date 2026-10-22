export function humanizeId(id: string): string {
  const words = id
    .split(/[_\s]+/)
    .filter((word) => word.length > 0)
    .join(" ")
    .toLowerCase();
  return words.length === 0 ? id : words.charAt(0).toUpperCase() + words.slice(1);
}
