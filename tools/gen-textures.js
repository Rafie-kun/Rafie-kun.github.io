#!/usr/bin/env node
/*
 * Generates Minecraft-style 16x16 pixel textures into assets/textures/
 * Run: node tools/gen-textures.js
 */
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');

const OUT=path.join(__dirname,'..','assets','textures');
fs.mkdirSync(OUT,{recursive:true});

/* ---------- tiny PNG encoder (RGBA8) ---------- */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xFFFFFFFF;for(let i=0;i<buf.length;i++)c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td),0);return Buffer.concat([len,td,crc]);}
function writePNG(file,w,h,grid){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){
    raw[y*(w*4+1)]=0;
    for(let x=0;x<w;x++){
      const p=grid[y][x]||[0,0,0,0];const o=y*(w*4+1)+1+x*4;
      raw[o]=p[0];raw[o+1]=p[1];raw[o+2]=p[2];raw[o+3]=p[3]===undefined?255:p[3];
    }
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  const png=Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR',ihdr),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
  fs.writeFileSync(file,png);
  console.log('  '+path.basename(file).padEnd(20)+png.length+' B');
}

/* ---------- helpers ---------- */
function hex(h){h=h[0]==='#'?h.slice(1):h;return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),255];}
function rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function G(w,h){return Array.from({length:h},()=>Array.from({length:w},()=>null));}
function pick(r,pal){return pal[(r()*pal.length)|0];}
function shade(c,f){return [Math.min(255,c[0]*f)|0,Math.min(255,c[1]*f)|0,Math.min(255,c[2]*f)|0,c[3]===undefined?255:c[3]];}
function save(name,w,h,g){writePNG(path.join(OUT,name+'.png'),w,h,g);}

/* per-pixel noise */
function noiseTex(name,seed,pal,opts){
  opts=opts||{};
  const w=16,h=16,r=rng(seed),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(opts.holes&&r()<opts.holes){g[y][x]=[0,0,0,0];continue;}
    let c=pick(r,pal);
    if(opts.speck&&r()<opts.speck)c=pick(r,opts.speck);
    g[y][x]=c;
  }
  save(name,w,h,g);
}

/* blocky noise: random color per cell (cell x cell pixels) */
function blockyTex(name,seed,pal,cell){
  const w=16,h=16,r=rng(seed),g=G(w,h);
  const cw=Math.ceil(w/cell),ch=Math.ceil(h/cell);
  const cells=Array.from({length:ch},()=>Array.from({length:cw},()=>pick(r,pal)));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y][x]=cells[(y/cell)|0][(x/cell)|0];
  save(name,w,h,g);
}

/* stone base used by ores */
function stoneBase(r,pal){return pick(r,pal||['#7f7f7f','#757575','#8a8a8a','#787878','#6e6e6e','#828282']);}

function oreTex(name,seed,blobPal){
  const w=16,h=16,r=rng(seed),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y][x]=hex(stoneBase(r));
  const spots=[[(r()*12+2)|0,(r()*12+2)|0],[(r()*12+2)|0,(r()*12+2)|0],[(r()*12+2)|0,(r()*12+2)|0],[(r()*10+4)|0,(r()*10+4)|0]];
  spots.forEach(([cx,cy])=>{
    for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){
      if(r()<0.35)continue;
      const x=cx+dx-1,y=cy+dy-1;
      if(x<0||y<0||x>=w||y>=h)continue;
      g[y][x]=hex(pick(r,blobPal));
    }
  });
  save(name,w,h,g);
}

/* ---------- structured block textures ---------- */
const DIRT=['#866043','#7a573c','#96795a','#6b4c33','#8f6b47','#806041'];
const GRASS=['#8ab552','#7ba849','#9ac25e','#6f9a41','#91bd59','#83ac4d'];

function grassSideTex(){
  const w=16,h=16,r=rng(101),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y][x]=hex(pick(r,DIRT));
  // ragged green overlay on top ~4 rows
  for(let x=0;x<w;x++){
    const depth=3+((r()*3)|0);
    for(let y=0;y<depth;y++)g[y][x]=hex(pick(r,GRASS));
    if(r()<0.4&&depth<6)g[depth][x]=hex(pick(r,GRASS));
  }
  save('grass_side',w,h,g);
}

function planksTex(){
  const w=16,h=16,r=rng(202),g=G(w,h);
  for(let band=0;band<4;band++){
    const base=hex(pick(r,['#a0813f','#977a3c','#aa8b4a','#9c7f45']));
    const seam=(r()*12+2)|0;
    for(let y=band*4;y<band*4+4;y++)for(let x=0;x<w;x++){
      let c=shade(base,0.92+r()*0.16);
      if(y===band*4)c=hex('#6b5530');                 // horizontal seam
      if(x===seam&&y!==band*4)c=hex('#6b5530');       // vertical seam
      if(x===seam+1&&y!==band*4)c=shade(base,1.08);
      g[y][x]=c;
    }
  }
  save('planks',w,h,g);
}

function logTex(){
  const w=16,h=16,r=rng(303),g=G(w,h);
  for(let x=0;x<w;x++){
    const colBase=hex(pick(r,['#6b5231','#77593a','#5e4a2c','#715638']));
    for(let y=0;y<h;y++){
      let c=shade(colBase,0.9+r()*0.2);
      if(r()<0.08)c=hex('#4a3a20');
      if(x%5===0)c=shade(colBase,0.78);
      g[y][x]=c;
    }
  }
  save('log_side',w,h,g);
}

function cobbleTex(name,seed,rocks,mortar){
  const w=16,h=16,r=rng(seed),g=G(w,h);
  // split into irregular chunks
  const xs=[0,3+((r()*3)|0),7+((r()*3)|0),11+((r()*3)|0),16];
  const ys=[0,3+((r()*3)|0),7+((r()*3)|0),11+((r()*3)|0),16];
  for(let bi=0;bi<4;bi++)for(let bj=0;bj<4;bj++){
    const base=hex(pick(r,rocks));
    for(let y=ys[bi];y<ys[bi+1];y++)for(let x=xs[bj];x<xs[bj+1];x++){
      const isEdge=x===xs[bj]||y===ys[bi]||x===xs[bj+1]-1||y===ys[bi+1]-1;
      g[y][x]=isEdge?hex(mortar):shade(base,0.9+r()*0.2);
    }
  }
  save(name,w,h,g);
}

/* ---------- item textures ---------- */
function chestTex(){
  const w=16,h=16,r=rng(404),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let c=hex(pick(r,['#9c6b2f','#a87435','#8e612a','#a36e31']));
    if(x===0||y===0||x===w-1||y===h-1)c=hex('#4a3a1a');       // frame
    if(x===1&&y>0&&y<h-1)c=shade(c,1.1);
    if(y===6||y===7)c=hex('#4a3a1a');                          // lid split
    g[y][x]=c;
  }
  // latch (iron plate centered)
  for(let y=5;y<=9;y++)for(let x=6;x<=9;x++)g[y][x]=hex('#8a8a8a');
  for(let x=6;x<=9;x++){g[5][x]=hex('#c0c0c0');g[9][x]=hex('#5a5a5a');}
  for(let y=6;y<=8;y++){g[y][6]=hex('#d8d8d8');g[y][9]=hex('#4a4a4a');}
  g[7][7]=hex('#f0f0f0');g[7][8]=hex('#f0f0f0');
  save('chest',w,h,g);
}

function paperTex(){
  const w=16,h=16,r=rng(505),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let c=hex(pick(r,['#f2f2ee','#ededeb','#f6f6f2']));
    if(x===0||y===0||x===w-1||y===h-1)c=hex('#cfcfc8');
    g[y][x]=c;
  }
  save('paper',w,h,g);
}

function discTex(){
  const w=16,h=16,g=G(w,h);
  const cx=7.5,cy=7.5;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const d=Math.hypot(x-cx,y-cy);
    if(d>7.6){g[y][x]=[0,0,0,0];continue;}
    if(d>5.1)g[y][x]=hex(d>7.2?'#000000':'#141414');            // vinyl edge
    else if(d>4.6)g[y][x]=hex('#3a3a3a');                       // ring
    else if(d>1.7)g[y][x]=hex(d>4.0?'#c94444':'#e05555');       // label
    else if(d>1.1)g[y][x]=hex('#f0f0f0');                       // label ring
    else g[y][x]=hex('#0a0a0a');                                // hole
  }
  save('disc',w,h,g);
}

function moonTex(){
  const w=16,h=16,r=rng(606),g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)g[y][x]=hex(pick(r,['#e8e8e8','#f0f0f0','#dedede']));
  const patches=[[4,4],[10,6],[6,11],[11,11]];
  patches.forEach(([cx,cy])=>{
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      if(r()<0.3)continue;
      const x=cx+dx,y=cy+dy;
      if(x<15&&y<15)g[y][x]=hex(pick(r,['#c4c4c4','#b4b4b4','#d0d0d0']));
    }
  });
  save('moon',w,h,g);
}

function logoStoneTex(){
  cobbleTex('logo_stone',777,['#b8b8b8','#ababab','#c4c4c4','#b0b0b0','#bdbdbd'],'#787878');
}

/* ---------- cursor + hearts ---------- */
function cursorTex(){
  const map=[
    'K...............',
    'KW..............',
    'KWK.............',
    'KWWK............',
    'KWWWK...........',
    'KWWWWK..........',
    'KWWWWWK.........',
    'KWWWWWWK........',
    'KWWWWWWWK.......',
    'KWWWWWWWWK......',
    'KWWWWWWWWWK.....',
    'KWWWWWWWWWWK....',
    'KWWWWWKKKKKKK...',
    'KWWKWWK.........',
    'KWK.KWWK........',
    'KK..KWWK........'
  ];
  const g=G(16,16);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const ch=map[y][x];
    g[y][x]=ch==='K'?[0,0,0,255]:ch==='W'?[255,255,255,255]:[0,0,0,0];
  }
  save('cursor',16,16,g);
}

function heartShape(w,h,sx,sy){
  const m=[];
  for(let y=0;y<h;y++){m.push([]);for(let x=0;x<w;x++){
    const fx=((x+0.5)/w*2-1)*sx;
    const fy=(1-(y+0.5)/h*2)*sy;
    const v=Math.pow(fx*fx+fy*fy-1,3)-fx*fx*Math.pow(fy,3);
    m[y].push(v<=0);
  }}
  return m;
}

function heartTex(name,mode){
  const w=11,h=10;
  const shape=heartShape(w,h,1.3,1.25);
  const g=G(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!shape[y][x]){
      const near=(y>0&&shape[y-1][x])||(y<h-1&&shape[y+1][x])||(x>0&&shape[y][x-1])||(x<w-1&&shape[y][x+1]);
      g[y][x]=near?[0,0,0,255]:[0,0,0,0];
      continue;
    }
    if(mode==='empty'){g[y][x]=hex((x+y)%3?'#373737':'#2d2d2d');continue;}
    const fy=(1-(y+0.5)/h*2);
    const fx=((x+0.5)/w*2-1);
    if(fx<-0.25&&fy>0.3)g[y][x]=hex('#ff9a9a');       // highlight
    else if(fy<-0.25)g[y][x]=hex('#a80000');          // bottom shade
    else g[y][x]=hex('#ff0000');
  }
  save(name,w,h,g);
}

/* ---------- main ---------- */
console.log('Generating textures ->',OUT);
noiseTex('dirt',11,DIRT);
noiseTex('grass_top',12,GRASS);
grassSideTex();
noiseTex('stone',13,['#7f7f7f','#757575','#8a8a8a','#787878','#6e6e6e','#828282']);
cobbleTex('cobblestone',14,['#8a8a8a','#7d7d7d','#949494','#737373'],'#4e4e4e');
planksTex();
logTex();
noiseTex('leaves',15,['#4f9a2c','#437f22','#5cae38','#37701a','#56a532'],{holes:0.14});
oreTex('ore_diamond',16,['#5decf5','#4ac8e0','#8ff8ff','#3fb8d4']);
oreTex('ore_gold',17,['#fcee4b','#e0cc3c','#fff9a0','#c9a82c']);
oreTex('ore_iron',18,['#d8af93','#c4967a','#e8c4ab','#b07f63']);
blockyTex('bedrock',19,['#3a3a3a','#575757','#232323','#6b6b6b','#151515'],2);
noiseTex('obsidian',20,['#150f24','#0e0a18','#1c1530','#0a0712'],{speck:['#3a2a66','#503a8c','#2a1e4d']});
noiseTex('glowstone',21,['#f7d273','#e8b94f','#ffe9a5','#c99a35','#d9a83f']);
noiseTex('diamond_block',22,['#61e0d8','#4cc9c1','#8ff2ec','#3eb3ab']);
noiseTex('gold_block',23,['#fcee4b','#e8d63f','#fffbc0','#d4bc33']);
noiseTex('iron_block',24,['#d8d8d8','#c8c8c8','#eeeeee','#b8b8b8']);
chestTex();
paperTex();
discTex();
moonTex();
logoStoneTex();
cursorTex();
heartTex('heart_full','full');
heartTex('heart_empty','empty');
console.log('Done.');
