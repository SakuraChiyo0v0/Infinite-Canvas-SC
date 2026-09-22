## ADDED Requirements

### Requirement: Single image generation entry
系统 SHALL 仅展示一个生图导航入口，使用一个模型下拉框选择本地或远程模型，保留参考图、尺寸、质量和数量设置。

#### Scenario: Select models across providers
- **WHEN** 用户选择一个模型选项
- **THEN** 系统以该选项对应的服务商与模型提交生成，不要求再次选择来源

#### Scenario: Open legacy links
- **WHEN** 用户进入旧文生图或在线生图链接
- **THEN** 展示统一页面及两种历史记录

#### Scenario: Local model with references
- **WHEN** 用户选择本地文生图模型且已有参考图
- **THEN** 提示该模型不支持参考图并阻止提交，不丢弃参考图

### Requirement: Retire ModelScope model service
系统 MUST 移除 ModelScope 专属模型调用、设置推荐和新建节点入口，MUST 保留已有图片、节点参数和连线，MUST NOT 自动替换为其他服务执行。

#### Scenario: Load legacy configuration
- **WHEN** 配置文件中包含 ModelScope
- **THEN** 可用服务列表不包含该服务，保存时不自动重新添加

#### Scenario: Execute legacy node
- **WHEN** 用户打开或执行旧 ModelScope 节点
- **THEN** 显示服务已移除、保留原内容并阻止该节点执行

#### Scenario: ModelScope software update source
- **WHEN** 软件更新逻辑引用 ModelScope 更新源
- **THEN** 本次变更保留原更新源行为
