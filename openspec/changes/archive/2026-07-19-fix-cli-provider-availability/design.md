## Context

本地功能由 `index.html` 的 iframe 加载。iframe URL 固定在旧版本查询参数时，浏览器会继续返回旧页面，导致子页面中新选择器代码不可见。文生图还有自己的提供商筛选，未复用其余三个工具的共享选择器。API 设置则把空 Base URL 当成配置缺失，未识别 CLI 的本机认证模式。

## Goals / Non-Goals

**Goals:**

- 保证本地文生图加载当前选择器并列出可用 CLI/自定义图像 API。
- 清晰展示 CLI 无需 Base URL 的认证状态。

**Non-Goals:**

- 不把 ModelScope、RunningHub、火山引擎作为文生图的自定义 API 选项。
- 不改变 CLI 登录、API Key 保存或后端图片请求协议。

## Decisions

- 为相关 iframe 与 API 设置脚本更新版本查询参数，确保主界面重新加载后必定取得更新后的页面与脚本。
- 文生图采用与共享选择器一致的“已启用 + 有图像模型 + CLI 或非内置 ID”资格规则。
- API 设置列表针对 `jimeng`、`codex`、`gemini-cli` 显示“本机 CLI 登录态”，而不是要求 Base URL。

## Risks / Trade-offs

- [自定义 API 不支持图像生成或参考图] → 选择器仍可显示已配置模型，实际请求会呈现上游错误；不在前端猜测服务能力。
- [用户保留旧页面标签] → 刷新主界面时新 iframe URL 会使其更新。
