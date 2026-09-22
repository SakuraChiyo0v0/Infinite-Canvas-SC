## ADDED Requirements

### Requirement: Keyboard navigation and explicit labels
系统 SHALL 允许键盘激活主导航、项目及画布入口，提供焦点指示、表单标签，并阻止焦点进入非活动 iframe。

#### Scenario: Switch workspace by keyboard
- **WHEN** 用户 Tab 聚焦主导航并按 Enter 或 Space
- **THEN** 对应页面显示且非活动页面不参与顺序焦点导航

### Requirement: Reliable workspace request feedback
系统 SHALL 在加载失败时保留已有列表并提供重试，创建和元数据保存失败时保留输入或原状态，不显示成功。

#### Scenario: Refresh fails
- **WHEN** 项目或画布列表返回 HTTP 错误
- **THEN** 保留原列表并显示错误与重试入口，不展示虚假的空列表

#### Scenario: Mutation fails
- **WHEN** 创建、移动或重命名失败
- **THEN** 保留输入、原名称归属和必要的剪切状态，允许重试

### Requirement: Prompt draft and deletion protection
系统 SHALL 在搜索重绘时保留提示词编辑内容，放弃未保存内容前确认，单条素材与提示词删除须经过明确确认。

#### Scenario: Search while editing
- **WHEN** 用户编辑提示词后更改搜索条件
- **THEN** 编辑中的名称、正文与备注均保持不变

#### Scenario: First deletion intent
- **WHEN** 用户首次点击素材或提示词的删除
- **THEN** 显示确认步骤且尚不发出删除请求，取消后保留条目

### Requirement: Reachable controls in narrow workspaces
系统 SHALL 使画布新建浮层、提示词和角色页在窄窗口中保持主要控件可达，角色上传入口支持键盘操作。

#### Scenario: Narrow embedded page
- **WHEN** 主窗口宽约 846px 且侧栏展开
- **THEN** 提示词和角色页面可纵向访问编辑、保存、创作入口，无需横向追逐主要操作

#### Scenario: Open canvas creation
- **WHEN** 在画板边缘或缩放后打开新建表单
- **THEN** 表单保持可读尺寸，名称、类型、创建和取消都在可视区域内
