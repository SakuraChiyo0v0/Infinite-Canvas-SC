## ADDED Requirements
### Requirement: 默认展示列表首个平台
API 设置页面 SHALL 在加载完成后展示当前可见平台列表第一项的配置。

#### Scenario: 平台列表非空
- **WHEN** 用户进入 API 设置且存在可见平台
- **THEN** 选中并展示列表第一项，不自动打开推荐 API。

#### Scenario: 无可见平台
- **WHEN** 加载完成后没有可见平台
- **THEN** 展示推荐 API。

#### Scenario: 手动打开推荐 API
- **WHEN** 用户点击推荐 API 入口
- **THEN** 正常打开推荐 API 页面。
