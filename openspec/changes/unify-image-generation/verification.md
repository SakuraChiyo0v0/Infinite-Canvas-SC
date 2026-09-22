## 实现结果

- 合并为一个「生图」导航入口，删除图像工具分组标题与折叠按钮；zimage.html 保留兼容跳转。
- online.html 使用一个模型选择框，按服务商与模型组合定位；保留参考图、尺寸、质量、数量及两类历史。
- 细节增强、图片编辑、角度控制统一为本地/远程模型下拉框，允许选择服务商的全部已配置图像模型。
- ModelScope 专属后端、默认注入、设置和新建节点入口已删除。旧节点及参数、图片路径、连线保留；旧服务请求返回 410，专属 HTTP 路由已移除。
- ModelScope 软件更新源未改动（比较修改前后相关函数的 AST 确认）。

## 验证

- 8 个 Node 测试脚本全部通过，覆盖生成路由、同名模型准确选择、不可用模型禁止回退、参考图约束、合并历史、工具选择持久化和旧节点保护。
- 项目自带 Python 运行 5 项 test_modelscope_retirement.py 测试全部通过；远程生成使用 mock 验证服务商、第二个模型、数量与历史类型，不调用付费服务。
- 所有 HTML 内联脚本及修改的 JavaScript 文件通过语法检查，main.py 可加载。
- `openspec validate unify-image-generation --strict` 通过。
- 在临时目录的 3001 端口使用独立配置与图片验证：单一生图入口；无分组折叠；同名模型区分；工具选中模型刷新后保留；两类历史展示；设置读取与保存；旧画布节点、连线及参数展示。
- 未执行真实 GPU/远程模型出图，未修改实际账号配置、密钥或历史图片。

## 原有失败与环境限制

- 全量 Python 测试中 test_canvas_log_cleanup.py 的 14 项均因缺少 delete_canvas_log、collect_local_media_urls 或 generated_media_path_from_url 失败。用实施前源码快照复测同样为 14 项失败，本次未处理相邻功能。
- 系统 Python 缺少 python-multipart，改用项目自带 python/python.exe 完成验证。
- 当前 3000 服务没有由本次工作重启；后端移除逻辑需重启本地服务后生效。没有提交、推送或部署。

## 可恢复基线

实施前源码快照：`C:\Users\mafuyu\AppData\Local\Temp\infinite-canvas-before-unify-20260921.zip`。保留了本次实施前的未提交源码，不包含密钥或用户图片。
