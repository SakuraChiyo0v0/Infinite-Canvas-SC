## Context
词库保存在 data/prompt_libraries.json，素材库及画布模板共用接口。系统库首次从旧 Markdown 初始化，已有库不会自动随内容更新。用户可修改和删除所有词库。

## Goals / Non-Goals
目标：新增 30 条易用的中文提示词，原有库不变，新增库可正常编辑删除。
非目标：变量替换引擎、变更生成模型、承诺逐条出图质量。

## Decisions
- 内置内容用独立 JSON 词库，类别使用 pack_ 前缀以避开非系统库的保留分类过滤。
- 完整内容保存在 positive，negative 为空；参考图数量、使用方式、来源保存在 scene 备注。正文使用可直接生成的默认题材，无必须替换的大量变量。
- 加载词库时按固定 pack id 导入一次，归一化保留 installed_prompt_packs 标记。标记独立于库存在与否，因此用户删条目、删整个库后不会复活。相同库 id 已存在则保留它。
- 只增加新库，不改 active_library_id。磁盘内容和代码修改前备份。
- 内容由公开方法和案例类型启发后原创编写；来源不作为必须运行的模型、参数或指令。
- 主页 online.html 与 klein.html 共用轻量原生 dialog 选择器，每次打开重新读取 /api/prompt-libraries。只将 positive 和旧 negative 合并为正文，备注与 params 不进入输入框；显式替换/追加，不改变模型、图片或尺寸。通过 textContent 渲染用户内容。

## Risks / Trade-offs
- 各模型改图与文字能力不同 → 备注写清参考图和画幅需手动设置；不承诺透明通道、精确像素、身份绝对一致。
- 标记丢失可能重新导入 → load/save 统一保留标记，测试删除、重复加载和保存路径。

## Migration Plan
备份词库与 main.py，完成测试后重启服务，首次读取词库自动加入新增包。验证旧库内容和当前选择不变；无需用户手动导入。
