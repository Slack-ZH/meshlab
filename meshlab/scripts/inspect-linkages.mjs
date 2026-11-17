import {connect} from './linkage-browser.mjs';
const b=await connect();
try{
  await b.viewport(1440,1080);
  for(const kind of ['scotch-yoke','crank-rocker','parallelogram','double-rocker','quick-return']){
    await b.navigate(kind+'.html');await b.screenshot(kind+'-desktop.png');console.log(kind,JSON.stringify({ready:(await b.state()).ready,errors:b.errors}));
  }
}finally{await b.close();}
