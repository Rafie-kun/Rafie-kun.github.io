#!/usr/bin/env node
/*
 * Downloads REAL official Minecraft client assets into the site.
 *
 * Sources (both are mirrors of the actual game files):
 *   - PrismarineJS/minecraft-assets  -> blocks, items, GUI sprites, sun/moon, logo
 *   - Nixinova/Original-Panorama     -> the 6 real title-screen panorama faces
 *
 * It also slices two sprite sheets that ship as one PNG in the game:
 *   - 1.8.8 gui/widgets.png  -> hotbar.png + hotbar_sel.png
 *   - 1.21.1 moon_phases.png -> moon.png (the full moon frame)
 *
 * Run: node tools/fetch-official-assets.js
 * No dependencies. Node 18+ (uses global fetch).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/';
const PANO = 'https://raw.githubusercontent.com/Nixinova/Original-Panorama/HEAD/assets/minecraft/textures/gui/title/background/';

/* ─────────────────────────── PNG decode ─────────────────────────── */
/* Minimal PNG reader: 8-bit, colour types 0/2/3/4/6, no interlace.
   Enough for every vanilla texture (they are RGBA8 or indexed-8). */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, depth = 8, ctype = 6, pal = null, trns = null;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'PLTE') pal = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8) throw new Error('bit depth ' + depth + ' unsupported');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      if (ft === 1) line[i] = (line[i] + a) & 255;
      else if (ft === 2) line[i] = (line[i] + b) & 255;
      else if (ft === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (ctype === 6) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]; }
      else if (ctype === 2) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255; }
      else if (ctype === 4) { out[d] = line[s]; out[d + 1] = line[s]; out[d + 2] = line[s]; out[d + 3] = line[s + 1]; }
      else if (ctype === 0) { out[d] = line[s]; out[d + 1] = line[s]; out[d + 2] = line[s]; out[d + 3] = 255; }
      else if (ctype === 3) {
        const p = line[s];
        out[d] = pal[p * 3]; out[d + 1] = pal[p * 3 + 1]; out[d + 2] = pal[p * 3 + 2];
        out[d + 3] = trns && p < trns.length ? trns[p] : 255;
      }
    }
    prev = line;
  }
  return { w, h, data: out };
}

/* ─────────────────────────── PNG encode ─────────────────────────── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
function crop(img, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++)
    img.data.copy(out, row * w * 4, ((y + row) * img.w + x) * 4, ((y + row) * img.w + x + w) * 4);
  return { w, h, data: out };
}
function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
/* area-average (box filter) downscale — alpha-weighted so transparent
   pixels don't darken the edges, unlike nearest-neighbour. */
function resize(img, W, H) {
  const out = Buffer.alloc(W * H * 4), rx = img.w / W, ry = img.h / H;
  for (let y = 0; y < H; y++) {
    const sy0 = Math.floor(y * ry), sy1 = Math.max(sy0 + 1, Math.min(img.h, Math.ceil((y + 1) * ry)));
    for (let x = 0; x < W; x++) {
      const sx0 = Math.floor(x * rx), sx1 = Math.max(sx0 + 1, Math.min(img.w, Math.ceil((x + 1) * rx)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        const o = (sy * img.w + sx) * 4, wgt = img.data[o + 3] / 255;
        r += img.data[o] * wgt; g += img.data[o + 1] * wgt; b += img.data[o + 2] * wgt;
        a += img.data[o + 3]; n++;
      }
      const o = (y * W + x) * 4, alpha = a / (n * 255) || 1;
      out[o]     = Math.min(255, Math.round(r / (n * alpha)));
      out[o + 1] = Math.min(255, Math.round(g / (n * alpha)));
      out[o + 2] = Math.min(255, Math.round(b / (n * alpha)));
      out[o + 3] = Math.round(a / n);
    }
  }
  return { w: W, h: H, data: out };
}
/* separable box blur — bakes the title screen's blur into the panorama
   faces at build time, so the browser needs no expensive CSS filter. */
function blur(img, radius) {
  const w = img.w, h = img.h, size = radius * 2 + 1;
  const tmp = Buffer.alloc(w * h * 4), out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let k = -radius; k <= radius; k++) {
      const sx = Math.min(w - 1, Math.max(0, x + k)), o = (y * w + sx) * 4;
      r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; a += img.data[o + 3];
    }
    const o = (y * w + x) * 4;
    tmp[o] = r / size; tmp[o + 1] = g / size; tmp[o + 2] = b / size; tmp[o + 3] = a / size;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let k = -radius; k <= radius; k++) {
      const sy = Math.min(h - 1, Math.max(0, y + k)), o = (sy * w + x) * 4;
      r += tmp[o]; g += tmp[o + 1]; b += tmp[o + 2]; a += tmp[o + 3];
    }
    const o = (y * w + x) * 4;
    out[o] = r / size; out[o + 1] = g / size; out[o + 2] = b / size; out[o + 3] = a / size;
  }
  return { w, h, data: out };
}

/* ─────────────────────────── download ─────────────────────────── */
let ok = 0, failed = 0;
async function get(url, tries) {
  for (let i = 1; i <= (tries || 3); i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'rafie-kun-fan-page-asset-script' } });
      if (r.status === 404) return null;                 // definitively absent
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 8 || b.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG (' + b.length + ' B)');
      return b;
    } catch (e) {
      if (i === (tries || 3)) throw new Error(e.message);
      await new Promise(r => setTimeout(r, 400 * i));
    }
  }
  return null;
}
async function save(src, dest, opts) {
  const to = path.join(ROOT, dest);
  try {
    const buf = await get(src, opts && opts.tries);
    if (!buf) { if (opts && opts.optional) { console.log('  ~ skip   ' + dest); return null; } throw new Error('404'); }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, buf);
    const s = pngSize(buf);
    ok++;
    console.log('  + ' + dest.padEnd(42) + String(buf.length).padStart(7) + ' B   ' + s.w + 'x' + s.h);
    return buf;
  } catch (e) {
    if (opts && opts.optional) { console.log('  ~ skip   ' + dest + '  (' + e.message + ')'); return null; }
    failed++;
    console.log('  ! FAIL   ' + dest + '  (' + e.message + ')');
    return null;
  }
}

/* ─────────────────────────── manifest ─────────────────────────── */
/* Only what the site actually uses — blocks + items at the top level,
   GUI/sprite sheets under gui/, panorama faces under panorama/. */
const T = 'assets/textures/';
const G = 'assets/textures/gui/';

async function main() {
  console.log('\n── BLOCKS (1.21.1 client) ──');
  const blocks = {
    'grass_block_side.png': 'grass_side.png', 'dirt.png': 'dirt.png', 'stone.png': 'stone.png',
    'diamond_ore.png': 'ore_diamond.png', 'gold_ore.png': 'ore_gold.png', 'iron_ore.png': 'ore_iron.png',
    'bedrock.png': 'bedrock.png', 'oak_leaves.png': 'leaves.png', 'oak_log.png': 'log_side.png',
    'obsidian.png': 'obsidian.png', 'gold_block.png': 'gold_block.png',
    'crafting_table_front.png': 'crafting_table.png', 'jukebox_side.png': 'jukebox.png'
  };
  for (const [from, to] of Object.entries(blocks))
    await save(PJS + '1.21.1/blocks/' + from, T + to);

  console.log('\n── ITEMS (1.21.1 client) ──');
  const items = {
    'music_disc_13.png': 'disc.png', 'paper.png': 'paper.png', 'book.png': 'book.png',
    'clock_00.png': 'clock.png', 'diamond.png': 'diamond.png', 'nether_star.png': 'nether_star.png'
  };
  for (const [from, to] of Object.entries(items))
    await save(PJS + '1.21.1/items/' + from, T + to);

  console.log('\n── GUI SPRITES (1.21.1 client) ──');
  await save(PJS + '1.21.1/gui/sprites/widget/button.png', G + 'button.png');
  await save(PJS + '1.21.1/gui/sprites/widget/button_highlighted.png', G + 'button_hl.png');
  await save(PJS + '1.21.1/gui/sprites/hud/heart/container.png', G + 'heart_bg.png');
  await save(PJS + '1.21.1/gui/sprites/hud/heart/full.png', G + 'heart_full.png');
  await save(PJS + '1.21.1/gui/sprites/hud/heart/half.png', G + 'heart_half.png');
  await save(PJS + '1.21.1/gui/title/minecraft.png', G + 'minecraft_logo.png');
  await save(PJS + '1.21.1/gui/title/edition.png', G + 'edition.png');

  console.log('\n── ENVIRONMENT (1.21.1 client) ──');
  await save(PJS + '1.21.1/environment/sun.png', G + 'sun.png');
  const moonPhases = await save(PJS + '1.21.1/environment/moon_phases.png', G + 'moon_phases.png');

  console.log('\n── CLASSIC GUI SHEET (1.8.8 client) ──');
  const widgets = await save(PJS + '1.8.8/gui/widgets.png', G + 'widgets.png');

  console.log('\n── TITLE PANORAMA (real 6-face cube) ──');
  for (let i = 0; i < 6; i++) {
    const face = await save(PANO + 'panorama_' + i + '.png', 'assets/panorama/panorama_' + i + '.png');
    if (face) {                                    // 837 -> 512 keeps the look, cuts ~2/3 of the bytes
      try {
        const img = decodePNG(face), small = blur(resize(img, 256, 256), 1);
        const file = path.join(ROOT, 'assets/panorama/panorama_' + i + '.png');
        fs.writeFileSync(file, encodePNG(small.w, small.h, small.data));
        console.log('    resized to 256x256 + blurred, ' + fs.statSync(file).size + ' B');
      } catch (e) { console.log('    (resize skipped: ' + e.message + ')'); }
    }
  }
  await save(PANO + 'panorama_overlay.png', 'assets/panorama/panorama_overlay.png');

  /* ── grass: the client stores it un-tinted; tint it plains-green like the game does ── */
  console.log('\n── BIOME TINTING GRASS ──');
  try {
    const side = decodePNG(fs.readFileSync(path.join(ROOT, T, 'grass_side.png')));
    const over = decodePNG(await get(PJS + '1.21.1/blocks/grass_block_side_overlay.png'));
    const tint = [0x91, 0xBD, 0x59];                      // minecraft:plains grass colour
    const out = Buffer.from(side.data);
    for (let i = 0; i < out.length; i += 4) {
      const a = over.data[i + 3] / 255;
      if (a <= 0) continue;
      const luma = over.data[i] / 255;                    // overlay is white-ish where grass
      out[i]     = Math.min(255, out[i]     * (1 - a) + tint[0] * luma * a);
      out[i + 1] = Math.min(255, out[i + 1] * (1 - a) + tint[1] * luma * a);
      out[i + 2] = Math.min(255, out[i + 2] * (1 - a) + tint[2] * luma * a);
    }
    fs.writeFileSync(path.join(ROOT, T, 'grass_side.png'), encodePNG(side.w, side.h, out));
    ok++;
    console.log('  + grass_side.png tinted with minecraft:plains #91BD59');
  } catch (e) { failed++; console.log('  ! grass tint failed: ' + e.message); }

  /* ── slice the hotbar out of the classic widgets sheet ── */
  console.log('\n── SLICING SPRITE SHEETS ──');
  if (widgets) {
    try {
      const img = decodePNG(widgets);
      const bar = crop(img, 0, 0, 182, 22);
      fs.writeFileSync(path.join(ROOT, G, 'hotbar.png'), encodePNG(bar.w, bar.h, bar.data));
      const sel = crop(img, 0, 22, 24, 24);
      fs.writeFileSync(path.join(ROOT, G, 'hotbar_sel.png'), encodePNG(sel.w, sel.h, sel.data));
      ok += 2;
      console.log('  + ' + G + 'hotbar.png'.padEnd(34) + '182x22   (real in-game hotbar)');
      console.log('  + ' + G + 'hotbar_sel.png'.padEnd(32) + '24x24    (selected slot frame)');
    } catch (e) { failed++; console.log('  ! hotbar slice failed: ' + e.message); }
  }
  /* ── slice the full moon out of moon_phases ── */
  if (moonPhases) {
    try {
      const img = decodePNG(moonPhases);
      const cell = Math.floor(img.h / 4);          // phases are laid out in a 4-wide grid
      const m = crop(img, 0, 0, cell, cell);
      fs.writeFileSync(path.join(ROOT, G, 'moon.png'), encodePNG(m.w, m.h, m.data));
      ok++;
      console.log('  + ' + G + 'moon.png'.padEnd(37) + m.w + 'x' + m.h + '    (full moon frame)');
    } catch (e) { failed++; console.log('  ! moon slice failed: ' + e.message); }
  }
  /* ── creeper head + body front faces out of the real 64x32 skin ── */
  const skin = await get(PJS + '1.21.1/entity/creeper/creeper.png').catch(() => null);
  if (skin) {
    try {
      const img = decodePNG(skin);
      const face = crop(img, 8, 8, 8, 8);      // head, front
      fs.writeFileSync(path.join(ROOT, G, 'creeper_face.png'), encodePNG(face.w, face.h, face.data));
      const body = crop(img, 20, 20, 8, 12);   // body, front
      fs.writeFileSync(path.join(ROOT, G, 'creeper_body.png'), encodePNG(body.w, body.h, body.data));
      ok += 2;
      console.log('  + ' + G + 'creeper_face.png'.padEnd(24) + '8x8     (head front, from real skin)');
      console.log('  + ' + G + 'creeper_body.png'.padEnd(24) + '8x12    (body front, from real skin)');
    } catch (e) { failed++; console.log('  ! creeper slice failed: ' + e.message); }
  }
  /* ── crop the logo to its opaque bounding box (the jar file has 80px of dead space) ── */
  const logoPath = path.join(ROOT, G, 'minecraft_logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const img = decodePNG(fs.readFileSync(logoPath));
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++)
        if (img.data[(y * img.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const part = crop(img, x0, y0, w, h);
      fs.writeFileSync(logoPath, encodePNG(part.w, part.h, part.data));
      ok++;
      console.log('  + ' + G + 'minecraft_logo.png'.padEnd(24) + img.w + 'x' + img.h + ' cropped -> ' + w + 'x' + h);
    } catch (e) { failed++; console.log('  ! logo crop failed: ' + e.message); }
  }
  /* ── XP bar (background + green fill) out of the 1.8.8 icons sheet ── */
  const icons = await get(PJS + '1.8.8/gui/icons.png').catch(() => null);
  if (icons) {
    try {
      const img = decodePNG(icons);
      const bg = crop(img, 0, 64, 182, 5);
      fs.writeFileSync(path.join(ROOT, G, 'xp_bar_bg.png'), encodePNG(bg.w, bg.h, bg.data));
      const fg = crop(img, 0, 69, 182, 5);
      fs.writeFileSync(path.join(ROOT, G, 'xp_bar_full.png'), encodePNG(fg.w, fg.h, fg.data));
      ok += 2;
      console.log('  + ' + G + 'xp_bar_bg.png / xp_bar_full.png   182x5  (real XP bar)');
    } catch (e) { failed++; console.log('  ! xp bar slice failed: ' + e.message); }
  }

  console.log('\n' + ok + ' assets written, ' + failed + ' failed.\n');
  if (failed) process.exitCode = 1;
}
main();
