export interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export interface RippleField {
  width: number;
  height: number;
  read: RenderTarget;
  write: RenderTarget;
}

export type UniformLocations<K extends string> = Record<K, WebGLUniformLocation | null>;

export const FIELD_UNIFORMS = [
  "uSize",
  "uDpr",
  "uOrigin",
  "uPitch",
  "uWave",
  "uTime",
  "uUnit",
  "uHeading",
  "uAmp",
  "uDepth",
  "uLight",
  "uShine",
  "uContrast",
  "uInk",
  "uOpacity",
  "uFade",
  "uFadeSize",
  "uAppear",
  "tRipple",
  "uRipple",
] as const;

export const RIPPLE_UNIFORMS = [
  "tState",
  "uTexel",
  "uSize",
  "uFrom",
  "uTo",
  "uRadius",
  "uImpulse",
  "uDamping",
] as const;

export const MARK_UNIFORMS = [
  "tField",
  "tAtlas",
  "uOrigin",
  "uPitch",
  "uGrid",
  "uPattern",
  "uMarkSize",
  "uStroke",
  "uColor",
  "uAccent",
  "uBackground",
  "uAtlas",
] as const;

export function lookupUniforms<K extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly K[],
): UniformLocations<K> {
  const locations = {} as UniformLocations<K>;
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, name);
  }
  return locations;
}

export function createBlankTexture(gl: WebGL2RenderingContext) {
  const blank = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return blank;
}

export function createAtlasTexture(gl: WebGL2RenderingContext) {
  const atlasTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return atlasTexture;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  float: boolean,
): RenderTarget {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    float ? gl.RGBA16F : gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    null,
  );
  const filter = float ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture, width, height };
}

export function disposeTarget(gl: WebGL2RenderingContext, target: RenderTarget) {
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

export function bindTarget(gl: WebGL2RenderingContext, target: RenderTarget | null) {
  if (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
}

export function createPositionBinder(gl: WebGL2RenderingContext, vertexBuffer: WebGLBuffer | null) {
  return (location: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  };
}
