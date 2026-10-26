(() => {
  const $=id=>document.getElementById(id);
  const icons={
    'home-view':'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    'top-view':'<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    'front-view':'<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
    'fullscreen':'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'
  };
  Object.entries(icons).forEach(([id,path])=>$(id).innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`);
  const panel=$('parts-panel'),open=$('open-parts');
  open.setAttribute('aria-label','打开零件目录与搜索');
  function setPanel(show,returnFocus=false){panel.hidden=!show;open.setAttribute('aria-expanded',String(show));if(show)$('part-search').focus({preventScroll:true});else if(returnFocus)open.focus({preventScroll:true});}
  open.addEventListener('click',()=>setPanel(panel.hidden));
  $('close-parts').addEventListener('click',()=>setPanel(false,true));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){setPanel(false,true);e.preventDefault();}});
  $('parts-list').addEventListener('click',e=>{if(e.target.closest('.part-item')&&matchMedia('(max-width:760px)').matches)setPanel(false,true);});
  const toggle=$('clarity-toggle'),preference=matchMedia('(prefers-reduced-transparency:reduce)');
  let saved=null;try{saved=localStorage.getItem('gear-apple-solid');}catch{}
  let solid=saved===null?preference.matches:saved==='true';
  function apply(){document.body.classList.toggle('solid-panels',solid);toggle.setAttribute('aria-pressed',String(solid));toggle.querySelector('span').textContent=solid?'开启玻璃效果':'降低透明度';toggle.setAttribute('aria-label',solid?'开启玻璃效果':'降低界面透明度');toggle.title=toggle.getAttribute('aria-label');}
  toggle.addEventListener('click',()=>{solid=!solid;apply();try{localStorage.setItem('gear-apple-solid',String(solid));}catch{}});
  preference.addEventListener('change',e=>{solid=e.matches;apply();});apply();
  const ranges=[...document.querySelectorAll('input[type=range]')];
  function updateRanges(){ranges.forEach(el=>{el.style.setProperty('--progress',`${(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))*100}%`);});}
  ranges.forEach(el=>el.addEventListener('input',updateRanges));document.addEventListener('click',()=>queueMicrotask(updateRanges));updateRanges();
  const nav=[...document.querySelectorAll('[data-tab]')];
  function syncNav(){nav.forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));}
  nav.forEach(button=>button.addEventListener('click',()=>{queueMicrotask(syncNav);setPanel(false);if(matchMedia('(max-width:760px)').matches)scrollTo({top:0,behavior:'instant'});}));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(syncNav)));syncNav();
  const modeButtons=[...document.querySelectorAll('[data-mode]')];
  function syncModes(){modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));}
  modeButtons.forEach(b=>b.addEventListener('click',()=>{queueMicrotask(syncModes);setPanel(false);}));syncModes();
  const theme=matchMedia('(prefers-color-scheme:dark)');
  function syncTheme(){document.querySelector('meta[name=theme-color]').content=theme.matches?'#17181b':'#f5f5f7';}
  theme.addEventListener('change',syncTheme);syncTheme();
})();
