## Why
页面默认下拉框仍显示系统菜单，与现有工具界面不一致。

## What Changes
- 统一单选下拉框和展开菜单的边框、圆角、阴影及交互状态。
- 使用可定制 select 的 CSS 能力，不修改选项、事件或业务请求；不支持的浏览器保留可用回退。

## Capabilities
### New Capabilities
- `shared-select-style`: 共享下拉框视觉样式。
### Modified Capabilities
无。

## Impact
static/css/theme.css。保持现有未提交改动，不提交推送。
