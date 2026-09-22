(function(){
'use strict';
const target=location.pathname.endsWith('/klein.html')?'klein':'zimage';
let consuming=false;
async function consume(){
 if(consuming)return;
 let data;try{data=JSON.parse(sessionStorage.getItem('studio_prompt_handoff')||'null');}catch(_){return;}
 if(!data||data.target!==target)return;
 if(Date.now()-data.createdAt>3600000){sessionStorage.removeItem('studio_prompt_handoff');return;}
 const input=document.getElementById('promptInput');if(!input)return;
 consuming=true;
 try{
  if(target==='klein'&&data.image){
   if(!/^\/(assets|output|api\/storage-files)\//.test(data.image.url))throw Error('参考图地址无效');
   base64Images[1]=data.image.url;
   uploadedNames[1]='';
   const preview=document.getElementById('prev1');preview.src=data.image.url;preview.classList.remove('hidden');document.getElementById('del1').classList.remove('hidden');
   clearSlot(2);clearSlot(3);
  }
  input.value=String(data.prompt||'');input.dispatchEvent(new Event('input',{bubbles:true}));
  sessionStorage.removeItem('studio_prompt_handoff');input.focus();window.scrollTo(0,0);
 }finally{consuming=false;}
}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='prompt-handoff-ready')consume();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',consume);else consume();
})();
