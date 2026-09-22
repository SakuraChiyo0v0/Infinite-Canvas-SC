## ADDED Requirements
### Requirement: 回环地址直连
服务 SHALL 对 localhost、127.0.0.1、::1 绕过系统代理，并保留外部代理。
#### Scenario: 本机网关
- **WHEN** 系统代理开启且调用本机网关
- **THEN** 请求直接到达本机服务
#### Scenario: 外部请求
- **WHEN** 请求非排除项的外部主机
- **THEN** 继续使用原有代理
#### Scenario: 已有排除配置
- **WHEN** 已配置 NO_PROXY 或 no_proxy
- **THEN** 保留已有排除项且重复初始化不增加重复项
