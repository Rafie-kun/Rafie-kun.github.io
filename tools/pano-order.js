/* Figure out how panorama_0..3 (the 4 side faces) tile around the cube by
   testing which edges of which faces actually line up. The real title screen
   is a continuous 360° scene, so a true neighbour's edge is far closer to the
   other than any non-neighbour — no guessing at Mojang's face order needed.

   Usage: node tools/pano-order.js
*/
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

/* minimal PNG reader (8-bit, colour types 0/2/3/4/6) — mirrors the fetcher */
const ZLIB = require('zlib');
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, depth = 8, type = 6, idat = [], pal = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), tag = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    else if (tag === 'PLTE') pal = data;
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    pos += len + 12;
  }
  if (depth !== 8) throw new Error('only 8-bit supported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = ZLIB.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[p++], a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let r;
      if (f === 0) r = v; else if (f === 1) r = v + a; else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
             r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      line[x] = r & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (type === 6) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = line[s+3]; }
      else if (type === 2) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = 255; }
      else if (type === 4) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = line[s+1]; }
      else if (type === 0) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = 255; }
      else if (type === 3) { out[o] = pal[line[s]*3]; out[o+1] = pal[line[s]*3+1]; out[o+2] = pal[line[s]*3+2]; out[o+3] = 255; }
    }
    prev = line;
  }
  return { w, h, data: out };
}

/* mean |Δ| over a vertical edge of a face; edge = 0 left, 1 right */
function edge(img, side) {
  const px = [];
  for (let y = 0; y < img.h; y++) for (let k = 0; k < 3; k++)
    px.push(img.data[(y * img.w + (side ? img.w - 1 : 0)) * 4 + k]);
  return px;
}
function diff(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }

const faces = [0, 1, 2, 3].map(i =>
  decodePNG(fs.readFileSync(path.join(ROOT, 'assets/panorama', 'panorama_' + i + '.png'))));
const E = faces.map(f => ({ L: edge(f, 0), R: edge(f, 1), LT: edge(f, 0).slice(0, 3 * 32), RT: edge(f, 1).slice(0, 3 * 32) }));

console.log('mean |ΔRGB| between every face edge pair (lower = more likely neighbours):\n');
console.log('      ' + [0, 1, 2, 3].map(j => 'L' + j + '     ').join('  ') + ' | ' + [0, 1, 2, 3].map(j => 'R' + j + '     ').join('  '));
for (let i = 0; i < 4; i++) {
  const rowL = [0, 1, 2, 3].map(j => diff(E[i].R, E[j].L).toFixed(1).padStart(6));
  const rowR = [0, 1, 2, 3].map(j => diff(E[i].R, E[j].R).toFixed(1).padStart(6));
  console.log('R' + i + '  ' + rowL.join('  ') + ' | ' + rowR.join('  ') + '   <- right edge vs left / right edges');
}
console.log('');
for (let i = 0; i < 4; i++) {
  const rowL = [0, 1, 2, 3].map(j => diff(E[i].L, E[j].L).toFixed(1).padStart(6));
  const rowR = [0, 1, 2, 3].map(j => diff(E[i].L, E[j].R).toFixed(1).padStart(6));
  console.log('L' + i + '  ' + rowL.join('  ') + ' | ' + rowR.join('  ') + '   <- left  edge vs left / right edges');
}

/* the ring: face A's right edge should match face B's left edge */
console.log('\nbest continuation after each face (R -> L):');
for (let i = 0; i < 4; i++) {
  const best = [0, 1, 2, 3].filter(j => j !== i)
    .map(j => ({ j, d: diff(E[i].R, E[j].L) })).sort((a, b) => a.d - b.d);
  console.log('  ' + i + ' -> ' + best.map(b => b.j + ' (' + b.d.toFixed(1) + ')').join(',  '));
}
console.log('\nbest continuation after each face (R -> R, flipped):');
for (let i = 0; i < 4; i++) {
  const best = [0, 1, 2, 3].filter(j => j !== i)
    .map(j => ({ j, d: diff(E[i].R, E[j].R) })).sort((a, b) => a.d - b.d);
  console.log('  ' + i + ' -> ' + best.map(b => b.j + ' (' + b.d.toFixed(1) + ')').join(',  '));
}
