## Why

本地图片工具的引擎选择目前只显示 CLI 协议提供商，用户已在 API 设置中添加并配置图像模型的自定义 API 无法用于细节增强、图片编辑或角度控制。

## What Changes

- 将已启用、配置了图像模型的自定义 API 提供商加入三个本地图片工具的共享引擎选择器。
- 保留即梦、GPT、Gemini CLI 提供商以及各页面已有的本地和 ModelScope 路径。
- 排除内置 ModelScope、RunningHub、火山引擎平台，避免与页面已有专属入口重复。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `cli-image-tool-editing`: 本地图片工具可发现并选择的远程图像提供商范围扩展为 CLI 与自定义 API。

## Impact

- 修改 `static/js/cli-image-tools.js` 的提供商筛选与选择提示。
- 更新相关静态合同测试；不新增后端接口，继续通过 `/api/online-image` 调用已选提供商。
