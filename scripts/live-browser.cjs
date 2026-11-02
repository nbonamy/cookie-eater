// Opt-in live-site check. Each URL gets an empty WebKit profile and the actual local Swift model.
// This exercises shipped DOM/content code, not Safari's extension registration/native-message transport.
const {webkit}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const urls=process.argv.slice(2);
if(!urls.length || !process.env.COOKIE_EATER_MODEL_RUNNER) throw Error('Use scripts/test-live.sh https://site.example ...');
const engine=fs.readFileSync('Extension/engine.js','utf8'),content=fs.readFileSync('Extension/content.js','utf8');
function interpret(message){return new Promise(resolve=>{
 const child=spawn(process.env.COOKIE_EATER_MODEL_RUNNER,[],{stdio:['pipe','pipe','ignore']});let output='';
 const timer=setTimeout(()=>child.kill(),18000);child.stdout.on('data',x=>output+=x);
 child.on('error',()=>resolve({action:'none',model:'bridgeUnavailable'}));
 child.on('close',()=>{clearTimeout(timer);try{resolve(JSON.parse(output));}catch{resolve({action:'none',model:'timeout'});}});
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(message));
});}
function bridge(){
 const listeners=[];window.browser={runtime:{sendMessage:msg=>window.__nativeTest(msg),onMessage:{addListener:fn=>listeners.push(fn)}},storage:{onChanged:{addListener:()=>{}}}};
 document.addEventListener('click',e=>{if(e.isTrusted)return;const el=e.target.closest('button,a,[role="button"],input,[role="switch"],[role="checkbox"]');if(el)window.__nativeTest({type:'click',label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,180)});},true);
}
(async()=>{const b=await webkit.launch();try{for(const url of urls){
 const parsed=new URL(url);assert(['http:','https:'].includes(parsed.protocol));
 const c=await b.newContext({locale:parsed.hostname.endsWith('.de')?'de-DE':'it-IT'});
 const initial=await c.storageState();assert.equal(initial.cookies.length,0);assert.equal(initial.origins.length,0);
 const outcomes=[],clicks=[],model=[],unrelated=new Map();let readOnly=false,modelBusy=false;
 await c.exposeBinding('__nativeTest',async({frame},msg)=>{
  if(msg.type==='state')return {paused:readOnly,aiEnabled:true};
  if(msg.type==='click'){clicks.push({frame:new URL(frame.url()).hostname,label:msg.label});return;}
  if(msg.type==='outcome'){const i=outcomes.findIndex(x=>x.id===msg.id);if(i<0)outcomes.push(msg);else outcomes[i]=msg;return {ok:true};}
  if(msg.type==='interpret'){
   if(readOnly)return {action:'none',model:'disabled'};
   if(modelBusy)return {action:'none',model:'busy'};modelBusy=true;
   try{const result=await interpret(msg);if(result.scope==='unrelated'){if(!unrelated.has(frame))unrelated.set(frame,new Set());unrelated.get(frame).add(msg.dom);}model.push({frame:new URL(frame.url()).hostname,...result,selected:msg.candidates.find(c=>c.id===result.candidateID)?.label});return result;}finally{modelBusy=false;}
  }
 });
 await c.addInitScript({content:`(${bridge.toString()})();document.addEventListener('DOMContentLoaded',()=>{${engine}\n${content}});`});
 const p=await c.newPage();let error;
 try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(7000);
  const end=Date.now()+30000;while(Date.now()<end && (!outcomes.length||modelBusy)){await p.waitForTimeout(500);}
  await p.waitForTimeout(1500);
 }catch(e){error=e.message.split('\n')[0];}
 async function banners(){const found=[];for(const f of p.frames()){try{const s=await f.evaluate(ignored=>{const CE=globalThis.CookieEater;if(!CE)return null;const ignoredRoots=new WeakSet();for(let i=0;i<40;i++){const s=CE.inspect(document,{ignoredRoots});if(!s)return null;if(ignored.includes(CE.domSnapshot(s))){ignoredRoots.add(s.root);continue;}return {provider:s.provider,controls:s.candidates.filter(c=>c.visible&&!c.disabled).map(c=>c.label)};}return null;},[...(unrelated.get(f)||[])]);if(s)found.push({frame:new URL(f.url()).hostname,...s});}catch{}}return found;}
 const remaining=await banners();let afterReload=null;
 if(outcomes.some(x=>['submitted','accepted','verified'].includes(x.status))&&!remaining.length){readOnly=true;try{await p.reload({waitUntil:'domcontentloaded',timeout:20000});await p.waitForTimeout(5000);afterReload=await banners();}catch{}}
 console.log(JSON.stringify({url,emptyProfile:true,clicks,model,outcomes,remaining,afterReload,error}));await c.close();
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
