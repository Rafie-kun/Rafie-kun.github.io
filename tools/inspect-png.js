/* Decode a PNG and report its real pixels (palette + tRNS aware), so sprite
   problems can be diagnosed instead of guessed at.
   Usage: node tools/inspect-png.js <file.png> [--ascii]
*/
'use strict';
const fs = require('fs'), ZLIB = require('zlib');

function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, depth = 8, ctype = 6, idat = [], pal = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), tag = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    else if (tag === 'PLTE') pal = data;
    else if (tag === 'tRNS') trns = data;
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    pos += len + 12;
  }
  if (depth !== 8) throw new Error('only 8-bit supported, got ' + depth);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
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
      if (ctype === 6) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = line[s+3]; }
      else if (ctype === 2) { out[o] = line[s]; out[o+1] = line[s+1]; out[o+2] = line[s+2]; out[o+3] = 255; }
      else if (ctype === 4) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = line[s+1]; }
      else if (ctype === 0) { out[o] = out[o+1] = out[o+2] = line[s]; out[o+3] = 255; }
      else if (ctype === 3) { const i = line[s];
        out[o] = pal[i*3]; out[o+1] = pal[i*3+1]; out[o+2] = pal[i*3+2];
        out[o+3] = trns && i < trns.length ? trns[i] : 255; }
    }
    prev = line;
  }
  return { w, h, data: out, ctype, palCount: pal ? pal.length / 3 : 0, hasTrns: !!trns };
}

const file = process.argv[2];
if (!file) { console.log('usage: node tools/inspect-png.js <file.png> [--ascii]'); process.exit(1); }
const img = decodePNG(fs.readFileSync(file));
let opaque = 0, transparent = 0, semi = 0;
const hist = new Map();
for (let i = 0; i < img.w * img.h; i++) {
  const a = img.data[i*4+3];
  if (a === 0) transparent++; else if (a === 255) opaque++; else semi++;
  const key = img.data[i*4] + ',' + img.data[i*4+1] + ',' + img.data[i*4+2] + ',' + a;
  hist.set(key, (hist.get(key) || 0) + 1);
}
console.log(file + '  ' + img.w + 'x' + img.h + '  colortype ' + img.ctype +
            '  palette ' + img.palCount + '  tRNS ' + (img.hasTrns ? 'yes' : 'no'));
console.log('opaque ' + opaque + '  semi ' + semi + '  transparent ' + transparent);
const top = [...hist.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8);
console.log('top colours (r,g,b,a -> count):');
for (const [k, n] of top) console.log('  ' + k.padEnd(16) + ' ' + n);

if (process.argv.includes('--ascii')) {
  const ramp = ' .:-=+*#%@';
  console.log('\nalpha map (@ = opaque, space = transparent):');
  for (let y = 0; y < img.h; y++) {
    let row = '';
    for (let x = 0; x < img.w; x++) {
      const a = img.data[(y*img.w+x)*4+3];
      row += a === 0 ? ' ' : a === 255 ? '@' : ramp[Math.min(9, Math.floor(a/26))];
    }
    console.log('  ' + row);
  }
}
