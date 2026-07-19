## Why

已配置的 GPT CLI 和即梦 CLI 在本地文生图页面被错误显示为“未配置可用”，而 API 设置页又将无需 Base URL 的 CLI 标为“未配置地址”。用户无法区分真正缺失配置与 CLI 的正常本机登录方式。

## What Changes

- 修正文生图页面的远程提供商筛选，支持 CLI 与已配置图像模型的自定义 API。
- 更新嵌入页面的资源版本，使新版选择器不会被旧 iframe 缓存遮蔽。
- 在 API 设置平台列表中，将 CLI 的空 Base URL 正确显示为本机 CLI 登录态。

## Capabilities

### New Capabilities

- `cli-provider-status-display`: 在 API 设置列表中正确表达 CLI 提供商的本机认证状态。

### Modified Capabilities

- `local-cli-image-generation`: 文生图远程提供商选择范围扩展为 CLI 与自定义图像 API，并可靠加载当前页面版本。

## Impact

- 修改 `static/zimage.html`、`static/index.html` 和 `static/js/api-settings.js`。
- 添加静态合同测试；不修改后端接口或提供商数据。
