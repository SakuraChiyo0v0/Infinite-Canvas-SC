## Context

已确认第二轮审阅中的 A/B/C 范围。应用为同源 iframe 页面，已有 PromptCreation、PromptWorkbench 和 CanvasProvenance，但普通工具的历史格式与来源协议尚未统一。工作区已有大量未提交修改，保留现状，所有修改按文件分工。

## Goals / Non-Goals

**Goals:** 可靠恢复历史，未填模板不可误提交，可复用角色/素材，跨工具继续创作保留来源，主操作与新手下一步可发现。

**Non-Goals:** 不更换生成服务、不改变画布类型、不迁移旧素材、不猜测缺失来源，不为测试实际生成或改用户数据，不提交推送部署。

## Decisions

1. 使用已有来源结构的可选扩展：`version/resultId/parentResultId/prompt/model/provider/size/operation/references/character/source/createdAt`，实际质量和数量也随结果保存。旧数据没有该字段仍可读取。后端验证/限制来源字段，禁止将凭证或任意配置透传到素材。
2. 新增共用浏览器模块 `CreationFlow`，依赖已有 `PromptCreation`，提供 `pickReference()`、`toEditor(payload)`、`listen(target, callback)`、`toCanvas(result)`、`toWorkbench(result)`、`saveAsset(result)`、`configureModels()`、`openPrompts({libraryId,itemId})`。角色选择返回 `{character,references}`，图片选择返回 `{character:null,references,provenance}`。交接通过同源、有时限的 sessionStorage 信封和已验证父页面消息完成；不会自动调用生成。
3. `toCanvas` 弹出目的地，限定新建或已有智能画布；保存已有画布时读取最新版本、追加命名空间化节点与连接、保留已有设置/日志/视口，以版本校验避免覆盖并发修改。普通画布保留原有能力，并补起步指引。
4. 角色/素材选择由各入口明确调用，不自动将素材的“角色”分类当作角色身份。多角色来源无法唯一确定时不自动归属，向用户说明并允许选择。
5. 角色/模板创作台继续使用已有变量与草稿能力。普通工具拦截变量并提供填写入口；画布中的“完整应用”明确为正文与参数说明，不暗示改变模型控件。
6. 主智能体负责共用交接/选择模块、主导航接收、画布列表和普通画布起步；子智能体 A 负责 online/klein/提示词选择器；B 负责 smart-canvas/后端来源；C 负责 prompt-workbench/characters/asset-manager。共享文件和来源接口改动通过消息协调，不同时写同一文件。新增模块先落盘再接入消费者，资源版本统一在集成阶段更新。
7. 实测确认智能空画布会隐藏整块创作面板，因此角色入口同时出现在不受画布缩放影响的空态起步卡；首节点创建后隐藏卡片。关闭的创作面板使用 `inert`，防止不可见控件获得焦点。重绘保留已挂载的面板，避免中途移动其 DOM。

## Risks / Trade-offs

- [已有历史格式多] → 分支兼容本地与云端，缺失或不可用参数显示给用户，不静默选其他模型。
- [跨页覆盖正在编辑的内容] → 接收端显式确认替换，取消时保留原内容与可重试交接。
- [来源数据不完整或多角色] → 显示缺失/冲突，不凭图片外观猜身份。
- [工作区直接服务静态文件] → 新模块完整后接入，单次原子文件替换，语法与共享渲染冒烟检查；验证通过再刷新浏览器。
- [后端正在运行旧进程] → 离线验证源码，前端浏览器按实际运行版本标记边界；必要时确认服务归属后在本地重启，不声称已部署。

## Migration Plan

新增可选字段，无数据迁移。保留修改前快照用于仅回退本次增量。资源引用版本在集成后更新，现有用户刷新浏览器获取完整版本。

## Open Questions

无阻塞问题。已有画布目的地限定智能画布，与当前结果导出结构一致；普通画布不自动转换。
