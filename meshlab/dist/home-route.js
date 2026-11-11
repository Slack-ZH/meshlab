// 首页可直接进入实验室的原理、工程资料或 AI 助手。
window.addEventListener('DOMContentLoaded',()=>{const view=new URLSearchParams(location.search).get('view');if(['principle','engineering'].includes(view))document.querySelector('[data-tab="'+view+'"]').click();if(view==='assistant'){document.getElementById('chat-tab').click();document.getElementById('chat-pane').scrollIntoView({block:'center'});}});
