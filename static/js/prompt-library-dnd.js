(function(global){
    'use strict';
    function intent(source,target,position,category){
        const base={kind:source.kind,id:source.id,source_library_id:source.library,position};
        if(source.kind==='library'){
            if(target.kind!=='library' || source.id===target.id)return null;
            return {...base,target_library_id:target.library,anchor_id:target.id};
        }
        if(source.kind==='category'){
            if(target.kind==='item' || (target.kind==='category' && source.id===target.id && source.library===target.library))return null;
            return {...base,target_library_id:target.library,anchor_id:target.kind==='category'?target.id:''};
        }
        if(source.kind==='item'){
            if(target.kind==='item' && source.id===target.id && source.library===target.library)return null;
            return {...base,target_library_id:target.library,
                target_category_id:target.kind==='category'?target.id:target.kind==='item'?category:'',
                anchor_id:target.kind==='item'?target.id:''};
        }
        return null;
    }
    function mount(root,callbacks){
        let source=null,busy=false,marked=null,completedAt=0;
        const selector='[data-prompt-drag-kind],[data-prompt-drop-library]';
        const clear=()=>{if(marked)marked.removeAttribute('data-prompt-drop');marked=null;};
        function targetAt(event){
            const candidate=event.target.closest?.(selector);
            const element=candidate?.closest?.('.prompt-nav-row') || candidate;
            if(!source || !element)return null;
            const target=element.dataset.promptDropLibrary
                ?{kind:'library',id:element.dataset.promptDropLibrary,library:element.dataset.promptDropLibrary}
                :{kind:element.dataset.promptDragKind,id:element.dataset.promptDragId,library:element.dataset.promptDragLibrary};
            const position=event.clientY<element.getBoundingClientRect().top+element.getBoundingClientRect().height/2?'before':'after';
            const operation=intent(source,target,position,callbacks.category(target.id));
            return operation?{element,operation,marker:source.kind===target.kind?position:'inside'}:null;
        }
        root.addEventListener('dragstart',event=>{
            const element=event.target.closest?.('[data-prompt-drag-kind]');
            if(!element)return;
            if(element.dataset.promptDragKind !== 'item' && !event.target.closest?.('[data-prompt-drag-handle]')){event.preventDefault();return;}
            if(busy || element.getAttribute('draggable')!=='true'){event.preventDefault();return;}
            source={kind:element.dataset.promptDragKind,id:element.dataset.promptDragId,library:element.dataset.promptDragLibrary};
            event.dataTransfer.effectAllowed='move';
            event.dataTransfer.setData('application/x-studio-prompt',JSON.stringify(source));
            element.classList.add('prompt-dragging');
            callbacks.status('拖到前后位置排序，或拖到分组/词库中移动');
        });
        root.addEventListener('dragover',event=>{
            const scroll=source && event.target.closest?.('.nav-scroll,.content-scroll');
            if(scroll){const rect=scroll.getBoundingClientRect();if(event.clientY<rect.top+35)scroll.scrollTop-=12;else if(event.clientY>rect.bottom-35)scroll.scrollTop+=12;}
            const target=targetAt(event);clear();
            if(!target)return;
            event.preventDefault();event.dataTransfer.dropEffect='move';
            marked=target.element;marked.dataset.promptDrop=target.marker;
        });
        root.addEventListener('drop',async event=>{
            const target=targetAt(event);clear();
            if(!target || busy)return;
            event.preventDefault();event.stopPropagation();source=null;busy=true;completedAt=Date.now();
            root.querySelectorAll('.prompt-dragging').forEach(el=>el.classList.remove('prompt-dragging'));
            try {await callbacks.move(target.operation);}
            catch(error){callbacks.status(error.message || '移动失败，原内容已保留');}
            finally {busy=false;}
        });
        root.addEventListener('dragend',()=>{source=null;clear();root.querySelectorAll('.prompt-dragging').forEach(el=>el.classList.remove('prompt-dragging'));});
        root.addEventListener('click',event=>{if(busy || Date.now()-completedAt<250){event.preventDefault();event.stopImmediatePropagation();}},true);
    }
    global.PromptLibraryDnD={mount,intent};
})(typeof window==='undefined'?globalThis:window);
