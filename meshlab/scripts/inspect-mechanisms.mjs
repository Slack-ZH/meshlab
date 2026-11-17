import {connect} from './linkage-browser.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await connect(),out=new URL('../test-results/mechanisms/',import.meta.url);
try{await mkdir(out,{recursive:true});await b.command('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await b.viewport(1440,1080);
  for(const kind of ['bevel-gears','scissor-jack','ratchet-pawl','eccentric-follower','roller-cam','geneva-drive']){
    await b.command('Page.navigate',{url:'http://127.0.0.1:8090/'+kind+'.html'});await b.waitFor('window.__mechanismLab?.getState().ready');await b.settle();const s=await b.evaluate('window.__mechanismLab.getState()');
    const shot=await b.command('Page.captureScreenshot',{format:'png'});await writeFile(new URL(kind+'-desktop.png',out),Buffer.from(shot.data,'base64'));console.log(kind,JSON.stringify({ready:s.ready,parts:s.view.parts.length,errors:b.errors}));
  }
}finally{await b.close();}
