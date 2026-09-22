## ADDED Requirements
### Requirement: 显式生成与编辑
两个页面 SHALL 分别发送 generate 和 edit 操作，文生图不提供参考图上传，图片编辑必须上传原图。
#### Scenario: 文生图
- **WHEN** 用户提交纯提示词
- **THEN** 标准协议只请求 generations，失败不得改走 edits。
#### Scenario: 图片编辑
- **WHEN** 用户提交原图和修改要求
- **THEN** 标准协议只请求 edits，失败不得改走 generations。
#### Scenario: 参数矛盾
- **WHEN** generate 包含参考图或 edit 缺少原图
- **THEN** 后端在调用上游前拒绝请求。
#### Scenario: 兼容其他调用
- **WHEN** 调用未指定 operation 或使用非标准服务协议
- **THEN** 保留既有自动模式或专用协议适配。

#### Scenario: 编辑输出画幅独立于参考图
- **WHEN** 用户上传横向参考图并选择竖屏输出
- **THEN** 本地和在线编辑 SHALL 使用选定宽高，上传参考图不得覆盖用户选定画幅。
