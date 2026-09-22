## ADDED Requirements

### Requirement: 独立项目展示
界面 SHALL 不再展示原作者署名、社交入口、DX-OS 及私信推广；项目主页 SHALL 指向本 fork。

#### Scenario: 打开首页和 API 设置
- **WHEN** 用户打开对应页面
- **THEN** 不显示原作者推广，README 仍注明原项目、原作者和许可证

### Requirement: 停用上游自动更新
系统 MUST 停止自动检查上游版本并拒绝旧更新及回滚接口。

#### Scenario: 旧页面请求更新
- **WHEN** 旧客户端调用更新或回滚接口
- **THEN** 返回 410 且不访问上游或覆盖文件
