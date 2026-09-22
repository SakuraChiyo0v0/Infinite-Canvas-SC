## Why

文生图与在线生图重复，用户需要先选择来源再找模型。ModelScope 的专属入口与默认配置占据多个页面，但用户不使用这项服务。

## What Changes

- 合并为一个「生图」入口，以单个模型下拉框选择本地 ComfyUI 或已配置远程模型，保留参考图、尺寸、质量、数量与历史能力。
- **BREAKING** 移除 ModelScope 专属生图/聊天服务、设置、推荐、自动配置及新建节点入口。
- 已有 ModelScope 节点保留参数、图片和连线，明确显示服务已移除并拒绝执行，不自动替换模型。
- 保留历史图片、原有配置文件及 ModelScope 软件更新源；旧生图页面链接跳转到统一入口。

## Capabilities

### New Capabilities
- `unified-image-generation`: 合并入口、统一模型选择与 ModelScope 退役兼容。

### Modified Capabilities
- `local-cli-image-generation`: 来源切换改为统一模型选择，合并在线与文生图历史。

## Impact

涉及 main.py、导航、生图页面、图片工具、画布、聊天、API 设置及相关测试。沿用现有生成接口，不增加依赖。不修改用户密钥与图片数据，不提交、推送或部署。工作区已有大量未提交改动，实施前保存文件快照，增量修改。
