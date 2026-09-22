## MODIFIED Requirements

### Requirement: CLI image providers are discoverable as an engine source
统一生图页面 SHALL 在单个模型下拉框中列出已启用且已配置图像能力的远程服务模型和本地模型，不再提供来源切换。

#### Scenario: Configured CLI providers are available
- **WHEN** GPT CLI、即梦 CLI 或自定义 API 已配置图像模型
- **THEN** 模型下拉框展示其模型和服务商名称

#### Scenario: CLI provider configuration changes
- **WHEN** 设置页通知配置变化
- **THEN** 刷新模型选项并保留仍有效的选择

#### Scenario: No CLI image provider is configured
- **WHEN** 没有配置远程服务
- **THEN** 不展示虚构远程模型，本地模型仍可选择

### Requirement: Selected CLI provider generates local text-to-image output
系统 SHALL 使用模型选项对应的 provider_id 和 model 提交图像生成，保留提示词、尺寸、参考图、质量和数量。GPT CLI MUST 继续使用支持的 GPT Image 2 Skill 命令及可写 --out 路径。

#### Scenario: Generate with a selected CLI provider
- **WHEN** 用户选择模型并生成
- **THEN** 请求准确使用该服务商和所选模型，结果显示在统一页面

#### Scenario: GPT CLI command receives an output path
- **WHEN** GPT CLI 生成或编辑图像
- **THEN** 命令包含 --out 与输出路径

### Requirement: CLI output is retained in zimage history
统一页面 SHALL 展示旧 zimage 和 online 历史，新远程生成记录归入 online，本地生成记录归入 zimage。服务端 SHALL 保留调用方传入的历史类型。

#### Scenario: zimage submits a CLI generation
- **WHEN** 旧调用方携带 history_type=zimage 生成
- **THEN** 记录类型保留为 zimage，刷新统一页面后仍可访问
