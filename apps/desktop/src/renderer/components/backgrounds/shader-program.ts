export interface ShaderProgram {
  readonly program: WebGLProgram;
  dispose(): void;
}

type AnyWebGlContext = WebGLRenderingContext | WebGL2RenderingContext;

function compileShader(gl: AnyWebGlContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  console.error("Shader compile error:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

/** Compiles, links, and owns one WebGL program and both of its shaders. */
export function createShaderProgram(
  gl: AnyWebGlContext,
  vertexSource: string,
  fragmentSource: string,
): ShaderProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (vertexShader === null || fragmentShader === null) {
    if (vertexShader !== null) gl.deleteShader(vertexShader);
    if (fragmentShader !== null) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (program === null) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  let disposed = false;
  return {
    program,
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
}
