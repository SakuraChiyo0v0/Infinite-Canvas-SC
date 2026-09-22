## 验证结果
- 本地 3000 服务实际查看四页桌面截图：标题、参数、预览和 Archive 层次一致。增强上传区缩至 170px，角度控制保留三维预览。
- 390px 窄屏四页 document.scrollWidth 均为 380px，无横向溢出；角度三维视图与滑杆纵向可见。已恢复视口。
- local-image-tool-scripts、image-tool-model-picker、zimage-cli-engine 三个现有 Node 检查通过。
- 与本次修改前临时快照逐页比较，所有 script 标签及控件 ID 完全相同；业务脚本未改变。
- git diff --check 与 OpenSpec strict validate 通过。
- 未调用模型实际出图，未提交、部署或修改其他页面。

角度布局修复：桌面 1280x720 截图确认生成按钮与结果预览可见、滑杆无内层滚动；390px 窄屏无横向溢出，三维视图高度 200px。工具脚本语法和 OpenSpec 校验通过，仅修改角度页及其专用 CSS。
