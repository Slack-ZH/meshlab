import {connect,base} from './linkage-browser.mjs';
import {definitions} from '../dist/experiments/catalog.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const b=await connect(),out=new URL('../test-results/full-standard/',import.meta.url);
try{
 await mkdir(out,{recursive:true});await b.viewport(1440,1080);await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 for(const kind of Object.keys(definitions)){
  await b.command('Page.navigate',{url:new URL(kind+'.html',base).href});await b.waitFor('window.__experimentLab?.getState().ready');await b.settle();
  const result=await b.evaluate(`({ready:window.__experimentLab.getState().ready,parts:document.querySelectorAll('#parts-list [data-part]').length,ai:!!document.getElementById('chat-input'),sliders:document.querySelectorAll('#geometry-fields input[type=range]').length,spec:document.getElementById('part-spec').textContent,connection:document.getElementById('chat-connection').textContent})`);
  const r=await b.command('Page.captureScreenshot',{format:'png'});await writeFile(new URL(kind+'-desktop.png',out),Buffer.from(r.data,'base64'));console.log(kind,JSON.stringify(result));
 }
 console.log('errors',JSON.stringify(b.errors));
}finally{await b.close();}
