## ADDED Requirements
### Requirement: Local character profiles
系统 SHALL 提供与提示词并列的角色页，支持名称、设定图、封面、可选背景介绍的创建、编辑和软删除。
#### Scenario: Save a reference sheet
- **WHEN** 用户输入名称并上传一张完整设定图
- **THEN** 保存为本地角色档案，刷新后可继续使用，无须拆图或填写额外字段
#### Scenario: Conflicting edits
- **WHEN** 旧版本档案提交覆盖已更新档案
- **THEN** 拒绝覆盖并明确提示刷新
### Requirement: Compose character and template
系统 SHALL 在角色页及提示词创作台提供角色与模板组合，设定图作为身份参考，模板决定本次绘画要求。
#### Scenario: Generate from a character
- **WHEN** 选择角色、模板、画幅并生成
- **THEN** 使用图像编辑请求，包含设定图、角色背景、模板和本次要求，明确不复刻设定图排版
#### Scenario: Preserve plain prompt generation
- **WHEN** 不选择角色且无参考图
- **THEN** 保持原有文生图请求行为
#### Scenario: Too many references
- **WHEN** 角色和附加参考图合计超过三张
- **THEN** 提交前提示调整，不静默丢图
### Requirement: Character works and provenance
系统 SHALL 将结果关联角色并保存角色和模板来源快照，角色页可查看作品并继续修改。
#### Scenario: Edit a profile after generation
- **WHEN** 已生成作品后修改或移除角色档案
- **THEN** 历史作品的角色资料、实际提示词和参考图快照不变
#### Scenario: Continue an existing work
- **WHEN** 从角色作品继续修改或送入画布
- **THEN** 使用原结果及其来源，保留与角色的关联
