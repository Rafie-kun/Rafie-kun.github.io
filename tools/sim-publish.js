// Simulates the editor's publish pipeline against the LOCAL index.html.
// Loads the WHOLE editor script in a mocked DOM environment, seeds the
// default content, then runs buildFullHTML and verifies the output.
const fs=require('fs');

const editorHtml=fs.readFileSync('editor.html','utf8');
const indexHtml=fs.readFileSync('index.html','utf8');

const scripts=[...editorHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const edScript=scripts[scripts.length-1];

// ── state ────────────────────────────────────────────────────────────
const state={fields:{}};

function makeEl(tag){
  return {
    tagName:tag||'div',
    value:'',
    style:{setProperty(){},removeProperty(){}},
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    dataset:{},
    children:[],
    appendChild(c){this.children.push(c);return c;},
    removeChild(c){return c;},
    remove(){},
    setAttribute(){},
    getAttribute(){return null;},
    addEventListener(){},
    querySelector(){return null;},
    querySelectorAll(){return [];},
    insertBefore(n){return n;},
    get innerHTML(){return this._h||'';},
    set innerHTML(v){this._h=v;},
    get textContent(){return this._t||'';},
    set textContent(v){this._t=v;},
    get className(){return this._c||'';},
    set className(v){this._c=v;},
    href:'',
    checked:false,
    focus(){},
    blur(){},
    scrollIntoView(){}
  };
}
function makeDocument(){
  const byId={};
  return {
    getElementById(id){
      if(id in state.fields){
        const el=byId[id]||(byId[id]=makeEl());
        el.value=state.fields[id];
        return el;
      }
      if(!byId[id])byId[id]=makeEl();
      return byId[id];
    },
    querySelector(){return null;},
    querySelectorAll(){return [];},
    createElement(tag){return makeEl(tag);},
    addEventListener(){},
    removeEventListener(){},
    body:makeEl('body'),
    documentElement:{style:{setProperty(){},removeProperty(){}}},
    _byId:byId
  };
}
const windowMock={onload:null,addEventListener(){},innerWidth:1400,innerHeight:900,scrollY:0};
const storageMock={getItem(){return null;},setItem(){},removeItem(){}};
async function fetchMock(url){
  if(url.includes('/contents/index.html')){
    const b64=Buffer.from(indexHtml,'utf8').toString('base64');
    return {ok:true,status:200,json:async()=>({content:b64,sha:'deadbeef'})};
  }
  throw new Error('unexpected fetch: '+url);
}
const noop=()=>0;

const factory=new Function('document','window','localStorage','fetch','setInterval','clearInterval','setTimeout','console',
  edScript+'\n;return {buildFullHTML,renderTypingLines,renderWork,renderSkills,renderProjects,renderAchievements,defaultTypingLines,defaultWork,defaultSkills,defaultProjects,defaultAchievements};');

const api=factory(makeDocument(),windowMock,storageMock,fetchMock,noop,noop,noop,console);

// seed default content exactly like window.onload does
api.renderTypingLines();
api.renderWork(api.defaultWork);
api.renderSkills(api.defaultSkills);
api.renderProjects(api.defaultProjects);
api.renderAchievements(api.defaultAchievements);

// ── checks ───────────────────────────────────────────────────────────
let allOk=true;
function parseCheck(html,label){
  const openDiv=(html.match(/<div\b/g)||[]).length;
  const closeDiv=(html.match(/<\/div>/g)||[]).length;
  const openSec=(html.match(/<section\b/g)||[]).length;
  const closeSec=(html.match(/<\/section>/g)||[]).length;
  const js=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  let jsOk=true,jsErr='';
  for(const s of js){try{new Function(s);}catch(e){jsOk=false;jsErr=e.message;}}
  const ok=openDiv===closeDiv&&openSec===closeSec&&jsOk;
  console.log('── '+label+(ok?'  ✓':'  ✗'));
  console.log('   div  '+openDiv+'/'+closeDiv+'  sect '+openSec+'/'+closeSec+'  JS '+(jsOk?'ok':'FAIL: '+jsErr));
  allOk&=ok;
}
function expect(html,re,label){
  const ok=re.test(html);
  console.log('   '+(ok?'✓':'✗')+' '+label);
  allOk&=ok;
}
function expectNot(html,re,label){
  const ok=!re.test(html);
  console.log('   '+(ok?'✓':'✗')+' '+label);
  allOk&=ok;
}

async function run(){
  // ── CASE A: defaults ──────────────────────────────────────────────
  const a=await api.buildFullHTML('tok');
  parseCheck(a.html,'CASE A: defaults');
  console.log('   work sec-title kept: '+(a.html.includes('<div class="sec-title">Work Experience</div>')?'✓':'✗ DESTROYED'));
  allOk&=a.html.includes('<div class="sec-title">Work Experience</div>');
  expect(a.html,/<!-- WORK -->/,'<!-- WORK --> marker intact');
  expect(a.html,/const TYPING_LINES=\["Freelancer","HS Student","Coder","Psych Student","Dungeon Explorer","Block Builder","Article Writer"\];/,'TYPING_LINES patched');
  expect(a.html,/COMMON → UNCOMMON → RARE → EPIC → LEGENDARY/,'rarity legend kept');
  expect(a.html,/function updateSocialCards\(\)\{[\s\S]*?\n\}/,'updateSocialCards re-matchable');
  expect(a.html,/<span class="player-name">Hossain Fazle Rafie<\/span>/,'player-name intact');
  expect(a.html,/class="xp-bar" style="--w:60%"/,'skill xp bars use --w');
  expect(a.html,/id="ghRepos"/,'github ids intact');
  expect(a.html,/access_key:'6415f871-a4b7-430b-ab24-db5d9dfc5111'/,'access_key present');
  expect(a.html,/async function loadNowWorking\(\)\{\s*const el=document\.getElementById\('nowText'\);/,'loadNowWorking intact (auto mode untouched)');
  for(const t of ['About Me','Work Experience','Skills / Inventory','Projects / Builds','Achievements','GitHub / Code Vault','Contact Me']){
    const ok=a.html.includes('>'+t+'<');
    console.log('   '+(ok?'✓':'✗')+' sec-title "'+t+'"');
    allOk&=ok;
  }
  for(const id of ['about','work','skills','projects','achievements','github','contact']){
    const n=(a.html.match(new RegExp('id="'+id+'"','g'))||[]).length;
    const ok=n===1;
    console.log('   '+(ok?'✓':'✗')+' id="'+id+'" count='+n);
    allOk&=ok;
  }
  const dividers=(a.html.match(/<div class="divider">/g)||[]).length;
  const dOk=dividers===7;
  console.log('   '+(dOk?'✓':'✗')+' divider count='+dividers+' (expected 7)');
  allOk&=dOk;
  // editor-injected markup should be styled by index CSS
  expect(a.html,/class="skill-emo"/,'skill-emo markup present (CSS exists in index)');
  // ids required by index JS
  for(const id of ['mName','mDisc','mPlayBtn','mViz','mVol','fsubmit','formOk','formErr','nowText','typingText','pgWrap','ghTotal','ghYearTabs','pgTip','xpFill','hudHearts','splash','logo']){
    const ok=a.html.includes('id="'+id+'"');
    if(!ok)console.log('   ✗ id="'+id+'" MISSING');
    allOk&=ok;
  }
  console.log('   (required element ids checked)');

  // ── CASE B: manual now-mode ──────────────────────────────────────
  state.fields={nowMode:'manual',nowManual:'Forging the next build'};
  const b=await api.buildFullHTML('tok');
  parseCheck(b.html,'CASE B: manual now-mode');
  expect(b.html,/el\.textContent="Forging the next build";/,'manual text injected');
  expect(b.html,/async function loadNowWorking\(\)\{const el=document\.getElementById\('nowText'\);if\(!el\)return;el\.textContent="Forging the next build";\}/,'whole fn replaced cleanly');
  expectNot(b.html,/if\(false\)\{/,'no if(false) leftovers');
  state.fields={};

  // ── CASE C: custom values ────────────────────────────────────────
  state.fields={linkedin:'https://linkedin.com/in/rafiex',twitter:'@rafiex',email:'me@example.org',github:'RafieX',discord:'rafiex',phone:'+1 555 0100',
                name:'Test Name',age:'20',level:'Pro',location:'Nowhere',hpVal:'500/1000'};
  const c=await api.buildFullHTML('tok');
  parseCheck(c.html,'CASE C: custom values');
  expect(c.html,/id="contact-linkedin">rafiex</,'linkedin card built');
  expect(c.html,/id="contact-twitter">@rafiex</,'twitter card built');
  expect(c.html,/me@example\.org/,'email replaced');
  expect(c.html,/Level 20 · Pro · Nowhere/,'player-level patched');
  expect(c.html,/<span class="hp-num" id="hpNum">500\/1000<\/span>/,'hp-num patched (id preserved)');
  expect(c.html,/width:50%/,'hp fill width computed');
  expect(c.html,/<span class="player-name">Test Name<\/span>/,'name patched');
  state.fields={};

  console.log('\n'+(allOk?'ALL CHECKS PASSED ✓':'SOME CHECKS FAILED ✗'));
  process.exit(allOk?0:1);
}
run().catch(e=>{console.error('HARNESS ERROR:',e);process.exit(2);});
