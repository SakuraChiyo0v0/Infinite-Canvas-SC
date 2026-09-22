## Why

当前定制分支基于 2026.07.17，上游已更新至 2026.08.28。同步上游修复和功能，同时保留本地图片工具定制。

## What Changes

- 合入 hero8152/Infinite-Canvas 的 67f49e4，包含模型适配、画布清理、API 修复和 MiniMax H3 工作流。
- 保留远程图片工具、就绪状态、历史分类及自定义尺寸功能。
- 保留本地配置与运行数据，创建备份分支；不包含 fork main 的 Docker 变更，不提交或推送。

## Capabilities

### New Capabilities
- `upstream-sync`: 上游更新与定制功能的兼容集成。

### Modified Capabilities
无，现有图片工具规范保持不变。

## Impact

主要涉及 main.py、static 页面和脚本、CLI 安装脚本、工作流和上游测试。无需更改本地凭证或数据。
