const {webkit}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const {createFixtureServer}=require('../scripts/fixtures.cjs');
const engine=fs.readFileSync('Extension/engine.js','utf8'),content=fs.readFileSync('Extension/content.js','utf8');
(async()=>{
 const server=createFixtureServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));server.unref();
 const base='http://127.0.0.1:'+server.address().port+'/?case=';
 const browser=await webkit.launch();
 try {
  function mockBrowser() {
   window.__outcomes=[];window.__finalOutcomes=()=>__outcomes.filter(e=>!['acceptanceClicked','rejectionClicked'].includes(e.evidence));window.__modelCalls=0;window.__paused=false;window.__ai=true;
   const listeners=[],changes=[];
   window.__retry=()=>listeners.forEach(fn=>fn({type:'retry'}));
   window.__pause=value=>{__paused=value;changes.forEach(fn=>fn({pausedSites:{newValue:value?['127.0.0.1']:[]}},'local'));};
   window.browser={runtime:{onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async msg=>{
    if(msg.type==='state')return {host:'127.0.0.1',paused:__paused,aiEnabled:__ai};
    if(msg.type==='outcome'){const index=__outcomes.findIndex(e=>e.id===msg.id);if(index>=0)__outcomes[index]=msg;else __outcomes.push(msg);await __reportOutcome(msg);return {ok:true};}
    if(msg.type==='interpret'){
     __modelCalls++;
     if(window.__delayInference)await new Promise(r=>setTimeout(r,1200));
     if(window.__busyCount>0){__busyCount--;return {action:'none',model:'busy'};}
     if(window.__unavailable)return {action:'none',model:'unavailable'};
     return {action:'reject',effect:'rejectOptionalCookies',requiresPaymentOrAccount:false,alternatives:'rejectionAvailable',candidateID:msg.candidates.find(c=>['Use essential cookies only','CONFIRMER VOTRE REFUS','Nur erforderliche zulassen','Continua senza accettare'].includes(c.label))?.id||'bogus'};
    }
   }},storage:{onChanged:{addListener:fn=>changes.push(fn)}}};
  }
  const c=await browser.newContext();
  const delivered=[];await c.exposeBinding('__reportOutcome',(_,message)=>delivered.push(message));
  await c.addInitScript({content:`(${mockBrowser.toString()})();document.addEventListener('DOMContentLoaded',()=>{${engine}\n${content}});`});
  const p=await c.newPage();
  async function run(scenario){await p.goto(base+scenario);await p.waitForFunction(()=>__finalOutcomes().length>0,{},{timeout:12000});return p.evaluate(()=>({outcomes:__outcomes,clicks:__clicks,modelCalls:__modelCalls}));}
  for(const scenario of ['direct','french','settings','delayed','model','misleading','stuck','cookieWall','tf1','german','italian']){
   const r=await run(scenario);
   assert(!r.clicks.some(x=>x.startsWith('ERROR')),JSON.stringify(r));
   if(scenario==='direct'||scenario==='delayed')assert.equal(r.outcomes[0].status,'verified');
   if(scenario==='french'||scenario==='settings'||scenario==='model')assert.equal(r.outcomes[0].status,'submitted');
   if(scenario==='settings')assert(r.clicks.includes('Saved: optional cookies and legitimate interest off'));
   if(scenario==='model'){assert.equal(r.outcomes[0].source,'model');assert.equal(r.modelCalls,1);}
   if(scenario==='misleading'){assert.deepEqual(r.clicks,[]);assert.equal(r.outcomes[0].status,'needsAttention');}
   if(scenario==='cookieWall'){assert.deepEqual(r.clicks,['Accepted to continue']);assert.equal(r.outcomes[0].status,'accepted');assert.equal(r.outcomes[0].evidence,'acceptedToContinue');assert.equal(r.modelCalls,0);}
   if(['german','italian'].includes(scenario)){assert.deepEqual(r.clicks,['Optional purposes refused']);assert.equal(r.outcomes[0].source,'model');assert.equal(r.modelCalls,1);}
   if(scenario==='tf1'){assert.deepEqual(r.clicks,['Initial refusal','Refusal confirmed']);assert.equal(r.outcomes[0].status,'submitted');assert.equal(r.outcomes[0].source,'model');assert.equal(r.modelCalls,1);}
   if(scenario==='stuck'){assert.equal(r.clicks.length,1);assert.equal(r.outcomes[0].evidence,'interactionLimit');}
   console.log('PASS WebKit '+scenario);
  }
  await p.goto(base+'model');await p.evaluate(()=>window.__unavailable=true);
  await p.waitForFunction(()=>__finalOutcomes().length);assert.deepEqual(await p.evaluate(()=>__clicks),[]);console.log('PASS unavailable model leaves unfamiliar banner');
  await p.goto(base+'delayed');await p.evaluate(()=>__pause(true));
  await p.waitForTimeout(2300);assert.deepEqual(await p.evaluate(()=>__clicks),[]);await p.evaluate(()=>__pause(false));
  await p.waitForFunction(()=>__finalOutcomes().length);console.log('PASS pause/resume delayed banner');
  await p.goto(base+'model');await p.evaluate(()=>{__delayInference=true;setTimeout(()=>{history.pushState({},'', '?case=changed');document.querySelector('#mount').innerHTML='<section role="dialog">Cookie settings<button>Accept all</button></section>';},700);});
  await p.waitForTimeout(2600);assert.deepEqual(await p.evaluate(()=>__clicks),[]);console.log('PASS navigation cancels stale inference');
  await p.goto(base+'model');await p.evaluate(()=>window.__busyCount=1);
  await p.waitForFunction(()=>__finalOutcomes().length);assert.equal((await p.evaluate(()=>__outcomes))[0].source,'model');console.log('PASS model busy retry');
  await p.goto(base+'stuck');await p.waitForFunction(()=>__finalOutcomes().length);await p.evaluate(()=>__retry());
  await p.waitForFunction(()=>__finalOutcomes().length===2);assert.equal(await p.evaluate(()=>__clicks.length),2);console.log('PASS explicit retry resets bounded run');
  await p.goto(base+'frame');await p.waitForFunction(()=>document.querySelector('iframe'));
  const frame=p.frames().find(f=>f!==p.mainFrame());await frame.waitForFunction(()=>__finalOutcomes().length);
  assert.equal((await frame.evaluate(()=>__outcomes))[0].status,'submitted');assert.equal(await frame.locator('#mount').textContent(),'');assert.equal(await p.evaluate(()=>__finalOutcomes().length),0);console.log('PASS cross-origin frame');
  delivered.length=0;await p.goto(base+'removedFrame');await p.waitForFunction(()=>document.querySelector('iframe')===null);
  assert(delivered.some(e=>e.status==='submitted'),'Rejection action must survive consent-frame teardown');console.log('PASS consent frame removal preserves action history');
  await c.close();
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
