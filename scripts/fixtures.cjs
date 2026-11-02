const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
function createFixtureServer(){
 const html=fs.readFileSync(path.join(__dirname,'../tests/fixtures/banner.html'));
 return http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);});
}
if(require.main===module){
 const server=createFixtureServer();
 server.listen(Number(process.env.PORT||8765),'127.0.0.1',()=>console.log('Test kitchen: http://127.0.0.1:'+server.address().port));
}
module.exports={createFixtureServer};
