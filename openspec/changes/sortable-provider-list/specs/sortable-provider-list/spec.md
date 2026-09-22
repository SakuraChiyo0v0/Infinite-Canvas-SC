## ADDED Requirements
### Requirement: 所有平台可排序
平台列表 SHALL 使用持久化顺序并允许所有平台拖动。
#### Scenario: 原固定平台
- **WHEN** 列表包含 RunningHub 或火山引擎
- **THEN** 与其他平台一样允许拖动、删除，不自动置顶。
#### Scenario: 当前移除
- **WHEN** 完成本次修改
- **THEN** 当前配置不包含两个指定平台，其他配置保持原样。
