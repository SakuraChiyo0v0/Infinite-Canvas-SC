## Why
系统代理接管 localhost 请求，导致本机网关之前返回空 502。
## What Changes
服务进程启动时合并代理排除项，增加 localhost、127.0.0.1、::1。保留外部代理及已有排除项。
## Capabilities
### New Capabilities
- `loopback-proxy`: 本机直连。
### Modified Capabilities
无。
## Impact
仅当前服务进程网络环境，不修改操作系统或网关配置。
