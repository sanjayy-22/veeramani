// Compact binary container for baked skinned meshes.
// Layout: "MSH1" | u32 headerBytes | JSON header | 4-byte aligned attribute blocks.
// Per vertex: position f32x3, normal i8x4, uv f32x2, colour u8x4, bones u8x4, weights u8x4.
const MAGIC = 0x3148534d; // "MSH1" little-endian

export function encodeModels(meshes) {
  const header = { meshes: {} };
  const blocks = [];
  let offset = 0;
  const push = (typed) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const at = offset;
    blocks.push(bytes);
    offset += bytes.byteLength;
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      blocks.push(new Uint8Array(pad));
      offset += pad;
    }
    return at;
  };
  for (const [name, m] of Object.entries(meshes)) {
    const n = m.count;
    const normals = new Int8Array(n * 4),
      colors = new Uint8Array(n * 4),
      bones = new Uint8Array(n * 4),
      weights = new Uint8Array(n * 4);
    for (let v = 0; v < n; v++) {
      for (let k = 0; k < 3; k++) normals[v * 4 + k] = Math.round(m.normals[v * 3 + k] * 127);
      for (let k = 0; k < 4; k++) {
        colors[v * 4 + k] = Math.round((m.colors ? m.colors[v * 4 + k] : 1) * 255);
        bones[v * 4 + k] = m.boneIndices[v * 4 + k];
      }
      // Quantise weights so they still sum to exactly 255.
      const w = [0, 1, 2, 3].map((k) => m.boneWeights[v * 4 + k] * 255);
      const q = w.map(Math.floor);
      let rest = 255 - q.reduce((a, b) => a + b, 0);
      const order = [0, 1, 2, 3].sort((a, b) => w[b] - q[b] - (w[a] - q[a]));
      for (const k of order) if (rest-- > 0) q[k]++;
      weights.set(q, v * 4);
    }
    const indices = m.count > 65535 ? new Uint32Array(m.indices) : new Uint16Array(m.indices);
    header.meshes[name] = {
      count: n,
      indexCount: indices.length,
      index32: indices instanceof Uint32Array,
      positions: push(new Float32Array(m.positions)),
      normals: push(normals),
      uvs: push(new Float32Array(m.uvs)),
      colors: push(colors),
      bones: push(bones),
      weights: push(weights),
      indices: push(indices),
    };
  }
  const json = new TextEncoder().encode(JSON.stringify(header));
  const headLen = Math.ceil((8 + json.byteLength) / 4) * 4;
  const out = new Uint8Array(headLen + offset);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, json.byteLength, true);
  out.set(json, 8);
  let at = headLen;
  for (const b of blocks) {
    out.set(b, at);
    at += b.byteLength;
  }
  return out;
}

export function decodeModels(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error("models.bin: bad magic");
  const jsonLen = view.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, 8, jsonLen)));
  const base = Math.ceil((8 + jsonLen) / 4) * 4;
  const out = {};
  for (const [name, h] of Object.entries(header.meshes)) {
    const n = h.count;
    const normalsI8 = new Int8Array(arrayBuffer, base + h.normals, n * 4);
    const normals = new Float32Array(n * 3);
    for (let v = 0; v < n; v++)
      for (let k = 0; k < 3; k++) normals[v * 3 + k] = normalsI8[v * 4 + k] / 127;
    const c8 = new Uint8Array(arrayBuffer, base + h.colors, n * 4),
      b8 = new Uint8Array(arrayBuffer, base + h.bones, n * 4),
      w8 = new Uint8Array(arrayBuffer, base + h.weights, n * 4);
    const colors = new Float32Array(n * 4),
      bones = new Float32Array(n * 4),
      weights = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) {
      colors[i] = c8[i] / 255;
      bones[i] = b8[i];
      weights[i] = w8[i] / 255;
    }
    out[name] = {
      count: n,
      positions: new Float32Array(arrayBuffer.slice(base + h.positions, base + h.positions + n * 12)),
      normals,
      uvs: new Float32Array(arrayBuffer.slice(base + h.uvs, base + h.uvs + n * 8)),
      colors,
      boneIndices: bones,
      boneWeights: weights,
      indices: h.index32
        ? new Uint32Array(arrayBuffer.slice(base + h.indices, base + h.indices + h.indexCount * 4))
        : new Uint16Array(arrayBuffer.slice(base + h.indices, base + h.indices + h.indexCount * 2)),
    };
  }
  return out;
}
