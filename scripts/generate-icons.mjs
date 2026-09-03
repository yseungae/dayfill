import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const crcTable = Array.from({length:256}, (_, n) => { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; return c>>>0; });
const crc32 = data => { let c=0xffffffff; for(const b of data) c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; };
const chunk = (type, data) => { const t=Buffer.from(type); const out=Buffer.alloc(data.length+12); out.writeUInt32BE(data.length,0); t.copy(out,4); data.copy(out,8); out.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length); return out; };
const png = size => {
  const raw=Buffer.alloc((size*4+1)*size); const set=(x,y,r,g,b,a=255)=>{const i=y*(size*4+1)+1+x*4;raw[i]=r;raw[i+1]=g;raw[i+2]=b;raw[i+3]=a;};
  for(let y=0;y<size;y++){for(let x=0;x<size;x++){const radius=size*.22;const dx=Math.max(radius-x,0,x-(size-radius));const dy=Math.max(radius-y,0,y-(size-radius));const inside=dx*dx+dy*dy<=radius*radius;set(x,y,...(inside?[246,243,235,255]:[0,0,0,0]));}}
  const rect=(x0,y0,x1,y1,c)=>{for(let y=Math.floor(y0);y<Math.ceil(y1);y++)for(let x=Math.floor(x0);x<Math.ceil(x1);x++)if(x>=0&&y>=0&&x<size&&y<size)set(x,y,...c);};
  rect(size*.10,size*.28,size*.84,size*.72,[30,64,49,255]); rect(size*.84,size*.41,size*.92,size*.59,[30,64,49,255]); rect(size*.16,size*.35,size*.78,size*.65,[168,217,74,255]);
  // Geometric TT remains legible even on small launch icons.
  rect(size*.27,size*.41,size*.49,size*.47,[23,52,39,255]);rect(size*.35,size*.41,size*.41,size*.60,[23,52,39,255]);rect(size*.51,size*.41,size*.73,size*.47,[23,52,39,255]);rect(size*.59,size*.41,size*.65,size*.60,[23,52,39,255]);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
};
await mkdir('icons',{recursive:true}); for(const size of [192,512]) await writeFile(path.join('icons',`icon-${size}.png`),png(size));
