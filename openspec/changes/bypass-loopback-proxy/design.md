## Context
httpx 在 Windows 读取系统代理但没有继承注册表的 localhost 排除行为。
## Goals / Non-Goals
本机直连，外部地址保留代理；不增加失败重试。
## Decisions
在客户端创建前合并 NO_PROXY/no_proxy，仅修改本进程环境，保持现有两种大小写配置。
## Risks / Trade-offs
需要重启服务生效。仅排除明确的回环主机，不扩大到局域网。
