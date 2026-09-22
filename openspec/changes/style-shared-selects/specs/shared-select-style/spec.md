## ADDED Requirements
### Requirement: 统一下拉框
支持 base-select 的浏览器 SHALL 展示与主题一致的单选框及菜单，保留原有选项和 change 行为。
#### Scenario: 展开与选择
- **WHEN** 用户打开并选择选项
- **THEN** 菜单具有圆角、选中提示和悬停状态，原控件 value 与 change 逻辑正常工作
#### Scenario: 键盘与兼容性
- **WHEN** 用户使用键盘或不支持定制 select 的浏览器
- **THEN** 选择、关闭、焦点与禁用行为仍可用，旧浏览器保留标准下拉菜单
