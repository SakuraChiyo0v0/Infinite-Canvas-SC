## ADDED Requirements

### Requirement: Reliable history reuse
系统 SHALL 区分恢复原生成条件与以上次结果继续修改，恢复可用的参考图、模型、画幅、质量和数量；历史模型不可用时 SHALL 明确提示。

#### Scenario: Cloud edit history reuse
- **WHEN** 用户复用带 URL 参考图的云端编辑历史
- **THEN** 必需参考图和可用模型参数恢复，旧本地工作流历史仍兼容，并且不自动生成

### Requirement: Valid template and model prerequisites
系统 SHALL 拦截未填写模板变量，并在无模型、加载失败、原模型失效时提供适当的配置、重试或重选入口。

#### Scenario: Unfilled template
- **WHEN** 用户将含变量模板带入普通工具或画布并提交
- **THEN** 系统阻止生成并说明需要填写，提示词管理入口指向独立提示词页

### Requirement: Reusable references and explicit handoff
系统 SHALL 提供角色及素材选择、继续编辑/创作和结果进入新建或已有智能画布的明确入口；接收端 SHALL 保留来源且不自动生成。

#### Scenario: Continue with a stored character
- **WHEN** 用户在普通工具或创作台选择角色
- **THEN** 明确显示角色与设定图，发送时携带身份与参考信息，取消选择或交接不破坏已有草稿

#### Scenario: Append to existing canvas
- **WHEN** 用户把结果加入已有智能画布
- **THEN** 保留原节点、连接、设置、日志和视口，追加无冲突节点，并在版本冲突时保留原画布且报告失败

### Requirement: Provenance survives reuse
系统 SHALL 兼容可选来源快照，并在画布继续生成、保存素材及再导入时保留角色、模板、父结果和实际参数；无法唯一确定角色时 SHALL 不自动猜测归属。

#### Scenario: Asset round trip
- **WHEN** 带来源的结果保存素材后再导入画布
- **THEN** 图片仍可查看原角色/模板/参数和父结果关系，旧素材缺字段时显示来源未记录

### Requirement: Accessible creation steps
系统 SHALL 使创作主操作可发现，角色可直接自由创作、模板可按用途筛选，并为普通/智能画布提供用途和空画布起步说明。

#### Scenario: First creation
- **WHEN** 新手进入角色创作或打开空画布
- **THEN** 可发现下一步且无需理解内部模型或节点编号，资料编辑与图片编辑使用不同名称

### Requirement: Parameter application is explicit
系统 SHALL 区分模板参数说明与实际应用的生成设置。

#### Scenario: Text-only parameter import
- **WHEN** 用户应用包含参数说明的模板正文
- **THEN** 操作名称与提示明确说明不会改变当前模型或画幅
