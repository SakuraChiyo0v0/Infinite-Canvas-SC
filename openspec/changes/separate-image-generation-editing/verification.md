## 验证
- 六项后端测试通过：普通模型与 GPT-Image-2 的 generate/edit 成功及失败路由、multipart 原图提交、自动模式兼容、特殊 JSON 适配、无效参数拒绝、操作传递与历史保存。
- 五项 ModelScope 退出回归测试通过。
- 三个前端脚本检查通过：纯文生图请求、模型精确选择和工具脚本语法。
- 浏览器检查文生图无上传入口、无 JavaScript 错误；图片编辑保留原图上传。首屏工作区样式保持。
- OpenSpec strict validate 和 git diff --check 通过。
- 没有真实模型调用、提交或部署；当前运行的后端需重启才会使用新路由逻辑。

## 编辑尺寸补充验证
- 浏览器确认本地 FLUX Klein 显示清晰度和画幅，选择 9:16 后显示 576x1024。
- klein-output-size 测试验证横图参考不会覆盖已选竖屏，实际本地请求的 152/156 两个节点均收到选定宽高，原图节点保持原文件。
- cli-image-tools 与 local-image-tool-scripts 检查通过，未执行真实 GPU 出图；本次仅前端改动，无需重启。
