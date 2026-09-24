const { assert, skip, test, module: describe } = require('qunit');
const { GPU } = require('../../src');

describe('issue #874 negated operand');

// `a - -b` emitted the two minus signs back to back, `a--b`, which GLSL and
// WGSL both tokenize as a decrement and reject. Minified kernels produce it
// routinely (`a + 0.95` folds to `a - -0.95`), and so does a negative
// constant baked into WGSL.

const MODES = [
  ['cpu', true],
  ['webgl', GPU.isWebGLSupported],
  ['webgl2', GPU.isWebGL2Supported],
  ['headlessgl', GPU.isHeadlessGLSupported],
  ['webasm', GPU.isWebAssemblySupported],
];

function kernelSource(v) {
  const a = v[this.thread.x];
  return (a - -0.95) + (a - -a) + (- -a) + (a + +a) + (a - this.constants.c) + (a - this.constants.i);
}

const input = [1, 2, 3, 4];
const constants = { c: -5.5, i: -3 };
const expected = input.map(a => (a - -0.95) + (a - -a) + (- -a) + (a + +a) + (a - constants.c) + (a - constants.i));

function check(assert, result) {
  assert.equal(result.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(Math.abs(result[i] - expected[i]) < 1e-4, `[${ i }] expected ${ expected[i] }, got ${ result[i] }`);
  }
}

for (const [mode, supported] of MODES) {
  (supported ? test : skip)(`Issue #874 - a - -b compiles and matches JavaScript ${ mode }`, assert => {
    const gpu = new GPU({ mode });
    const kernel = gpu.createKernel(kernelSource, {
      output: [4],
      constants,
      constantTypes: { c: 'Float', i: 'Integer' },
    });
    check(assert, kernel(input));
    gpu.destroy();
  });
}

(GPU.isWebGPUSupported ? test : skip)('Issue #874 - a - -b compiles and matches JavaScript webgpu', async assert => {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    if (typeof window !== 'undefined') {
      window.__webgpuRuntimeSkips = (window.__webgpuRuntimeSkips || 0) + 1;
    }
    assert.ok(true, 'navigator.gpu present but no adapter (headless/blocklisted) — runtime skip');
    return;
  }
  const gpu = new GPU({ mode: 'webgpu' });
  const kernel = gpu.createKernel(kernelSource, {
    output: [4],
    constants,
    constantTypes: { c: 'Float', i: 'Integer' },
  });
  check(assert, await kernel(input));
  gpu.destroy();
});
