(function(root, factory){
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    else root.VisionRouting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
    'use strict';
    const runTypes = ['generator','midjourney','comfy','ltxDirector','llm','video','rh','minimax','visionJudge'];
    const staticTypes = ['image','prompt','group','promptGroup'];
    const features = ['vision-judge-v1','conditional-routing-v1'];
    const clone = value => JSON.parse(JSON.stringify(value));
    const reviewBranches = () => [
        {id:'pass',label:'通过',description:'全部要求满足'},
        {id:'fail',label:'不通过',description:'存在明确违反项'},
        {id:'unknown',label:'无法判断',description:'证据不足或没有匹配类别'}
    ];
    function branches(node){ return node.mode === 'classify' ? node.branches || [] : reviewBranches(); }
    function validateJudge(node){
        const bs = branches(node), ids = bs.map(b => b.id);
        if(!['review','classify'].includes(node.mode)) throw Error('判断模式无效');
        if(!String(node.instruction || '').trim() || node.instruction.length > 4000) throw Error('请填写 1–4000 字判断要求');
        if(!node.provider || !node.model) throw Error('请选择视觉模型');
        if(bs.length < 3 || bs.length > 7 || new Set(ids).size !== ids.length || ids.at(-1) !== 'unknown') throw Error('需要 2–6 个类别和最后的无法判断出口');
        if(bs.some(b => !/^[a-zA-Z0-9_-]{1,80}$/.test(b.id) || !String(b.label || '').trim() || b.label.length > 40 || String(b.description || '').length > 500)) throw Error('类别名称、ID 或描述不合法');
    }
    function validateResult(value, node){
        if(!value || !branches(node).some(b => b.id === value.branchId) || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 1000 || typeof value.suggestion !== 'string' || value.suggestion.length > 2000) throw Error('视觉模型返回的判断格式不正确');
        return value;
    }
    // Static shared inputs are dependencies, not bridges between unrelated workflows.
    function component(allNodes, allEdges, anchor){
        const byId = new Map(allNodes.map(n => [n.id,n]));
        const found = new Set([anchor]), queue = [anchor];
        while(queue.length){
            const id = queue.shift();
            for(const child of byId.get(id)?.items || []){
                if(byId.has(child) && !found.has(child)){ found.add(child); queue.push(child); }
            }
            for(const e of allEdges){
                let next = e.to === id ? e.from : e.from === id && !staticTypes.includes(byId.get(id)?.type) ? e.to : null;
                if(next && byId.has(next) && !found.has(next)){ found.add(next); queue.push(next); }
            }
        }
        return found;
    }
    function containsJudge(allNodes, allEdges, anchor){
        const ids = component(allNodes, allEdges, anchor);
        return allNodes.some(n => ids.has(n.id) && n.type === 'visionJudge');
    }
    function plan(allNodes, allEdges, anchor, {validateConfig=true}={}){
        const ids = component(allNodes, allEdges, anchor);
        const ns = allNodes.filter(n => ids.has(n.id));
        const es = allEdges.filter(e => ids.has(e.from) || ids.has(e.to));
        const byId = new Map(ns.map(n => [n.id,n]));
        if(byId.size !== ns.length) throw Error('节点 ID 重复');
        const loops = ns.filter(n => n.type === 'loop');
        if(loops.length > 1) throw Error('视觉分支首版只支持一个固定次数循环');
        const incoming = new Map(ns.map(n => [n.id,[]])), outgoing = new Map(ns.map(n => [n.id,[]]));
        for(const n of ns){
            if(![...runTypes,...staticTypes,'loop','output'].includes(n.type)) throw Error(`此分支流程暂不支持节点 ${n.type}`);
            if(n.type === 'visionJudge' && validateConfig) validateJudge(n);
        }
        for(const e of es){
            const from = byId.get(e.from), to = byId.get(e.to);
            // Edges leaving a shared static input into an unrelated workflow aren't in this plan.
            if(from && !to && staticTypes.includes(from.type)) continue;
            if(!from || !to) throw Error('存在悬空连线，请检查工作流');
            if(staticTypes.includes(to.type)) throw Error(`不支持向静态输入节点连线：${to.id}`);
            if(from.type === 'visionJudge' && !branches(from).some(b => b.id === e.fromPort)) throw Error(`判断节点 ${from.id} 存在无效出口`);
            if(from.type !== 'visionJudge' && e.fromPort) throw Error(`普通节点 ${from.id} 不支持分支出口`);
            if(e.textField && !['none','reason','suggestion'].includes(e.textField)) throw Error('连线文本选项不合法');
            if(to.type === 'loop' && !staticTypes.includes(from.type) && from.type !== 'output') throw Error('循环输入只接受已有素材或提示词');
            incoming.get(e.to).push(e); outgoing.get(e.from).push(e);
        }
        const order = [], active = new Set(), visited = new Set();
        function visit(id){
            if(active.has(id)) throw Error('不支持回连上游或循环连线，请使用固定次数循环节点');
            if(visited.has(id)) return;
            active.add(id);
            incoming.get(id).forEach(e => visit(e.from));
            active.delete(id); visited.add(id); order.push(id);
        }
        ns.forEach(n => visit(n.id));
        for(const judge of ns.filter(n => n.type === 'visionJudge')){
            const owner = new Map();
            for(const branch of branches(judge)){
                const queue = outgoing.get(judge.id).filter(e => e.fromPort === branch.id).map(e => e.to), seen = new Set();
                while(queue.length){
                    const id = queue.shift();
                    if(seen.has(id)) continue;
                    seen.add(id);
                    if(owner.has(id) && owner.get(id) !== branch.id) throw Error(`不同出口不能汇合到节点 ${id}`);
                    owner.set(id, branch.id);
                    outgoing.get(id).forEach(e => queue.push(e.to));
                }
            }
        }
        return {nodes:ns, byId, incoming, outgoing, order, loop:loops[0] || null};
    }
    const empty = () => ({refs:[],text:''});
    function edgeValue(edge, round, p){
        if(round.states[edge.from] !== 'done') return null;
        const value = round.outputs[edge.from] || empty();
        if(p.byId.get(edge.from).type === 'visionJudge'){
            if(value.branchId !== edge.fromPort) return null;
            return {refs:value.refs || [],text:edge.textField === 'reason' ? value.reason : edge.textField === 'suggestion' ? value.suggestion : ''};
        }
        return value;
    }
    function createRun(p, {id,rounds=1,start=1,stride=1,parallel=1}={}){
        return {id:id || `vision-${Date.now()}`,plan:p,status:'idle',parallel,stopped:false,error:null,
            rounds:Array.from({length:rounds},(_,i) => ({id:i,index:start+i*stride,total:start+(rounds-1)*stride,attempt:0,states:{},outputs:{},errors:{}}))};
    }
    async function execute(run, adapter, onState=()=>{}){
        run.status='running'; run.stopped=false; run.error=null;
        const stopped = () => run.stopped || run.status !== 'running';
        let cursor = 0;
        async function worker(){
            while(cursor < run.rounds.length && !stopped()){
                const round = run.rounds[cursor++]; round.attempt++;
                for(const id of run.plan.order){
                    if(stopped()) break;
                    if(['done','skipped'].includes(round.states[id])) continue;
                    const node = run.plan.byId.get(id), ins = run.plan.incoming.get(id);
                    const values = ins.map(e => ({edge:e,value:edgeValue(e,round,run.plan)}));
                    if(values.some(v => v.value === null)){
                        round.states[id]='skipped'; delete round.outputs[id]; onState(node,round,run); continue;
                    }
                    round.states[id]='running'; delete round.errors[id]; onState(node,round,run);
                    try {
                        const result = await adapter(node, values, round, run);
                        if(stopped()) { round.states[id]='interrupted'; onState(node,round,run); break; }
                        round.outputs[id]=result || empty(); round.states[id]='done'; onState(node,round,run);
                    } catch(error){
                        if(stopped()){ round.states[id]='interrupted'; onState(node,round,run); break; }
                        round.states[id]='failed'; round.errors[id]=error.message || String(error);
                        run.error=error; run.status='failed'; onState(node,round,run); break;
                    }
                }
            }
        }
        await Promise.all(Array.from({length:Math.max(1,Math.min(run.parallel,run.rounds.length))},worker));
        if(run.stopped) run.status='stopped';
        else if(run.status==='running') run.status='done';
        return run;
    }
    function validateVersion(data){
        const w = data?.workflow || data;
        if(![1,2].includes(w?.version ?? 1)) throw Error('不支持此工作流版本');
        if(w?.requiredFeatures && (!Array.isArray(w.requiredFeatures) || w.requiredFeatures.some(f => !features.includes(f)))) throw Error('工作流需要当前版本不支持的能力');
        if(w?.nodes?.some(n => n.type==='visionJudge') && (w.version !== 2 || !features.every(f => w.requiredFeatures?.includes(f)))) throw Error('视觉判断工作流需要版本 2 及完整能力声明');
    }
    return {runTypes,staticTypes,features,clone,reviewBranches,branches,validateJudge,validateResult,component,containsJudge,plan,createRun,execute,validateVersion};
});
