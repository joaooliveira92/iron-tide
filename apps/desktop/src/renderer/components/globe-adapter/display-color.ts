const LINEAR_CANVAS_FROM_SRGB: readonly (readonly [number, number, number])[] = [
  [0.724933, 0.2534105, 0.0216566],
  [0.0511458, 0.9431731, 0.0056812],
  [0.016737, 0.0802054, 0.9030576],
];

function decode(channel: number): number {
  const unit = channel / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function encode(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const unit = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(unit * 255);
}

export class DisplayColorError extends Error {
  readonly _tag = "DisplayColorError";
  constructor(message: string) {
    super(message);
    this.name = "DisplayColorError";
  }
}

export function srgbToCanvasHex(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) throw new DisplayColorError(`expected a #rrggbb colour, got ${hex}`);
  const value = Number.parseInt(match[1] as string, 16);
  const linear = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map(decode);
  const channels = LINEAR_CANVAS_FROM_SRGB.map((row) =>
    encode(
      row[0] * (linear[0] as number) +
        row[1] * (linear[1] as number) +
        row[2] * (linear[2] as number),
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
