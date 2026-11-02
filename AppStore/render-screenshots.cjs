// Render the shipped popup UI with fictional sample activity, at Apple's Mac screenshot size.
const {webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const samples=[
 {file:'01-automatic-consent.jpg',title:'Fewer banners.<br>More browsing.',detail:'Reject optional cookies automatically in Safari.',paused:false,status:'submitted'},
 {file:'02-local-control.jpg',title:'Your Mac.<br>Your choices.',detail:'Pause a site, retry a banner, and keep inference local.',paused:true,status:'submitted'}
];
const server=http.createServer((req,res)=>{
 const name=path.basename(new URL(req.url,'http://localhost').pathname);
 if(!['popup.html','popup.css','popup.js','icon.png'].includes(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':name.endsWith('.js')?'application/javascript':'image/png');
 res.end(fs.readFileSync(path.join(root,'Extension',name)));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await webkit.launch();
 try{
  const c=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,colorScheme:'light'});
  await c.addInitScript(({paused,status})=>{
   const history=[{host:'news.example',status,provider:'Generic',source:'model',evidence:'bannerDismissedWithoutStoredProof',time:1793635200000},{host:'shop.example',status:'submitted',provider:'Generic',source:'rules',evidence:'rejectionClicked',time:1793635140000}];
   window.browser={runtime:{sendMessage:async m=>m.type==='popup'?{host:'news.example',paused,aiEnabled:true,history}:m.type==='status'?{model:'available'}:{ok:true}},storage:{onChanged:{addListener:()=>{}}}};
  },samples[0]);
  fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
  for(const sample of samples){
   const p=await c.newPage();
   // The popup frame reads these values through its own init script below.
   await p.route('**/popup.js',async route=>{
    const source=fs.readFileSync(path.join(root,'Extension','popup.js'),'utf8');
    await route.fulfill({contentType:'application/javascript',body:`const samplePaused=${JSON.stringify(sample.paused)};const originalSend=browser.runtime.sendMessage;browser.runtime.sendMessage=async m=>{const r=await originalSend(m);if(m.type==='popup')r.paused=samplePaused;return r;};\n`+source});
   });
   await p.setContent(`<!doctype html><html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#302b24;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.brand{position:absolute;left:92px;top:72px;font-size:23px;font-weight:650;display:flex;align-items:center;gap:14px}.brand img{width:42px;height:42px}h1{position:absolute;left:92px;top:205px;font-size:72px;line-height:1.08;letter-spacing:-3px;margin:0;max-width:570px}.detail{position:absolute;left:96px;top:420px;font-size:24px;line-height:1.4;width:470px;color:#6d6255}.note{position:absolute;left:96px;bottom:80px;font-size:17px;color:#6d6255}iframe{position:absolute;right:100px;top:80px;width:360px;height:640px;border:0;border-radius:18px;box-shadow:0 20px 60px #302b2426;background:#fbf9f4}</style><div class="brand"><img src="http://127.0.0.1:${server.address().port}/icon.png">Cookie Eater</div><h1>${sample.title}</h1><p class="detail">${sample.detail}</p><div class="note">On-device AI · No account · Safari on Mac</div><iframe src="http://127.0.0.1:${server.address().port}/popup.html"></iframe></html>`);
   const frame=p.frames().find(f=>f!==p.mainFrame());
   await frame.waitForSelector('#active:not([disabled])');
   await frame.waitForFunction(()=>document.querySelector('#host').textContent==='news.example');
   await p.screenshot({path:path.join(__dirname,'screenshots',sample.file),type:'jpeg',quality:95,omitBackground:false});
   await p.close();console.log('Rendered '+sample.file);
  }
  await c.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
