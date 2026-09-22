# 精选提示词入库验证

2026-09-22，本次增加 30 条中文完整模板，6 类、每类 5 条。

## 内容与来源

内容文件：static/system-prompts/curated-image-prompts.json。正文原创编写，参考下列公开方法与案例类型，不逐字搬运或宣称已逐条复现来源效果。

- Adobe Firefly 生图示例：https://www.adobe.com/products/firefly/ai-generated-examples/image-prompts.html
- Black Forest Labs 改图指南：https://docs.bfl.ml/kontext/kontext_image_editing
- Adobe 参考图构图说明：https://helpx.adobe.com/firefly/web/work-with-images/generate-images/match-image-composition-to-reference-image.html

包括粗马克笔原创/参考重绘、彩铅、动漫头像、双参考分工、三视图、表情、服装、姿态、四格、贴纸、水彩、剪纸、像素、植物、场景、产品、海报、图卡、改字、扩图、清理、改色与修复。备注标明参考图要求和画幅需另行选择。

## 改动

- main.py：首次加载导入精选包，保存 installed_prompt_packs；不覆盖已有相同 id 词库，删除后不重新加入。
- static/system-prompts/curated-image-prompts.json：完整内容。
- tests/test_curated_prompt_pack.py：6 个持久化与完整性回归测试。
- data/prompt_libraries.json：当前本地实例已自动导入 30 条。原系统库 10 条、自建人设库 1 条及 active_library_id 与备份逐项一致。

## 验证

- 全量 Python：35 项通过。
- 前端：11 个测试文件通过。
- OpenSpec strict、git diff --check 通过。
- 浏览器素材库确认六分类及数量；浏览器画布模板库可选择新库、搜索“参考角色重绘”、应用完整正文。
- 应用验证只在“功能验证 0921”测试画布完成，之后已恢复其原始改色提示词；本轮未执行生图，不将入库验证等同于 30 条出图质量验证。
- 新模板均为完整单字段内容，negative 为空；备注来源不会混入“应用正文”。

## 运行与备份

- 3000 服务已重启，PID 39628。
- 运行日志：C:/Users/mafuyu/AppData/Local/Temp/studio-prompt-pack-runtime-20260922-005659。
- 修改前 main.py 和词库备份：C:/Users/mafuyu/AppData/Local/Temp/studio-prompt-pack-20260922-004957。
- 不改网关、模型或生成接口；未提交和推送。实际范围与设计一致。

## 主页入口追加验证

- online.html（主页生图）和 klein.html（图片编辑）的提示词框旁新增“提示词库”按钮，共用 prompt-library-picker.js / .css。
- 原生 dialog 展示词库、分类、搜索、正文及备注预览；显式替换或追加。每次打开请求最新词库。列表短摘要不影响正文长度。
- 浏览器确认生图页筛选“角色速写 / 白底人物”并追加后保留原草稿；图片编辑取消后草稿不变，替换可完整填入自建的 3512 字马克笔提示词。
- 新增 prompt-library-picker.test.mjs 覆盖旧 negative 合并、备注搜索、替换、追加、取消、空库、失败禁用及重新打开加载；全部 12 个前端测试文件通过。
- 未改变生成模型、尺寸、参考图和后端生成接口，本轮未发起生图请求。仅静态页面改动，无需重启服务。
- 页面改动前备份：C:/Users/mafuyu/AppData/Local/Temp/studio-home-prompts-20260922-010739。
