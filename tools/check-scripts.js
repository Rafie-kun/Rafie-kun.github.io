// Extracts every <script> block from an HTML file and syntax-checks it.
const fs=require('fs');
const file=process.argv[2]||'index.html';
const html=fs.readFileSync(file,'utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m,ok=true,n=0;
while((m=re.exec(html))){
  n++;
  const code=m[1];
  try{
    new Function(code); // parses (does not run)
    console.log('script #'+n+': OK ('+code.split('\n').length+' lines)');
  }catch(e){
    ok=false;
    // locate offending line within the block
    const line=e.stack.match(/<anonymous>:(\d+):(\d+)/);
    console.log('script #'+n+': SYNTAX ERROR — '+e.message+(line?' near script line '+line[1]:''));
    if(line){
      const ln=parseInt(line[1],10);
      const src=code.split('\n');
      for(let i=Math.max(0,ln-3);i<Math.min(src.length,ln+2);i++)console.log('  '+(i+1)+(i+1===ln?' > ':'   ')+src[i]);
    }
  }
}
if(!n){console.log('no inline scripts found');ok=false;}
process.exit(ok?0:1);
