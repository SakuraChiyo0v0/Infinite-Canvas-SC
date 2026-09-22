(function(){
'use strict';
const $=id=>document.getElementById(id), key='studio_prompt_reverse_draft';
let image=null,busy=false,saving=false,saver;
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);}
function persist(){try{localStorage.setItem(key,JSON.stringify({image,prompt:$('result').value,focus:$('focus').value,model:$('model').value,name:$('promptName').value}));}catch(_){status('浏览器草稿保存失败，请先复制提示词',true);}}
function controls(){const locked=busy||saving;const text=!!$('result').value.trim();$('analyze').disabled=locked||!image||!$('model').value;$('analyze').textContent=busy?'正在反推…':'开始反推';$('imageFile').disabled=locked;$('clearImage').disabled=locked||!image;$('model').disabled=locked;$('focus').disabled=locked;$('result').readOnly=locked;for(const id of ['copy','useGenerate'])$(id).disabled=busy||!text;$('useEdit').disabled=busy||!text||!image;saver?.refresh();}
function showImage(){$('sourceImage').hidden=!image;$('uploadHint').hidden=!!image;if(image)$('sourceImage').src=image.url;else $('sourceImage').removeAttribute('src');$('imageName').textContent=image?.name||'尚未选择图片';controls();}
async function api(url,options){const r=await fetch(url,options);const d=await r.json();if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:`请求失败（${r.status}）`);return d;}
async function upload(file){if(!file||busy||saving)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){status('请选择 PNG、JPG、WebP 或 GIF 图片',true);return;}if(file.size>50*1024*1024){status('图片不能超过 50 MB',true);return;}busy=true;controls();status('正在上传图片…');try{const form=new FormData();form.append('files',file);const data=await api('/api/ai/upload',{method:'POST',body:form});const next=data.files?.find(f=>f.kind==='image');if(!next)throw Error('上传未返回图片');image=next;$('result').value='';$('promptName').value='';persist();showImage();status('图片已就绪，选择识图模型后开始反推');}catch(e){status(e.message,true);}finally{busy=false;controls();}}
$('imageFile').onchange=e=>{upload(e.target.files[0]);e.target.value='';};
$('dropzone').onkeydown=e=>{if(!busy&&['Enter',' '].includes(e.key)){e.preventDefault();$('imageFile').click();}};
$('dropzone').ondragover=e=>{e.preventDefault();if(!busy)$('dropzone').classList.add('drag-over');};
$('dropzone').ondragleave=()=> $('dropzone').classList.remove('drag-over');
$('dropzone').ondrop=e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');upload(e.dataTransfer.files[0]);};
$('clearImage').onclick=()=>{image=null;$('result').value='';showImage();persist();status('已移除图片');};
$('analyze').onclick=async()=>{if(busy||saving||!image||!$('model').value)return;busy=true;controls();status('正在分析图片，请稍候…');const [provider,model]=JSON.parse($('model').value);try{const data=await api('/api/prompt-reverse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image_url:image.url,provider,model,focus:$('focus').value})});$('result').value=data.prompt;persist();status('反推完成，可直接编辑或用于创作');}catch(e){status(e.message,true);}finally{busy=false;controls();}};
for(const id of ['result','focus','promptName'])$(id).oninput=()=>{persist();controls();};$('model').onchange=()=>{persist();controls();};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('result').value);status('提示词已复制');}catch(_){$('result').focus();$('result').select();status('无法访问剪贴板，已选中文本，请按 Ctrl+C');}};
function handoff(target){const data={target,prompt:$('result').value,image:target==='klein'?image:null,createdAt:Date.now()};try{sessionStorage.setItem('studio_prompt_handoff',JSON.stringify(data));if(parent!==window)parent.postMessage({type:'prompt-reverse-use',target},location.origin);else location.href=target==='klein'?'/static/klein.html':'/static/online.html';}catch(e){status('无法转交提示词：'+e.message,true);}}
$('useGenerate').onclick=()=>handoff('zimage');$('useEdit').onclick=()=>handoff('klein');
saver=ReversePromptSave.create({api,getPrompt:()=>$('result').value,isBusy:()=>busy,setSaving:value=>{saving=value;controls();},persist});
async function loadModels(selected){const data=await api('/api/providers');$('model').replaceChildren(new Option('请选择支持识图的模型',''));for(const p of data.providers||[]){if(p.enabled===false||p.id==='modelscope')continue;for(const model of p.chat_models||[])$('model').add(new Option(`${p.name||p.id} · ${model}`,JSON.stringify([p.id,model])));}if([...$('model').options].some(o=>o.value===selected))$('model').value=selected;else if($('model').options.length>1)$('model').selectedIndex=1;controls();}
async function init(){let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}image=saved.image&&/^\/(assets|output|api\/storage-files)\//.test(saved.image.url)?saved.image:null;$('result').value=saved.prompt||'';$('focus').value=saved.focus||'';$('promptName').value=saved.name||'';if(image&&saved.name===image.name?.replace(/\.[^.]+$/,'')+' · 反推')$('promptName').value='';showImage();const results=await Promise.allSettled([loadModels(saved.model),saver.load()]);const errors=results.filter(r=>r.status==='rejected');if(errors.length)status(errors.map(r=>r.reason.message).join('；'),true);controls();}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='providers-changed')loadModels($('model').value).catch(e=>status(e.message,true));});
init();
})();
