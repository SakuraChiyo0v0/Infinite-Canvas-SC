## 1. 备份与合并

- [x] 1.1 创建备份分支，备份配置并记录运行数据哈希
- [x] 1.2 合入上游 67f49e4，解决冲突并审查定制功能

## 2. 验证与交付

- [x] 2.1 执行现有回归测试、Python 测试和语法检查
- [x] 2.2 核实运行数据未改变，记录验证结果和最终 Git 状态

## 验证结果

- 备份分支：codex/backup-before-upstream-20260921，指向 9c379e4。
- 上游：67f49e4b9a0ac090bad1f5bd62ae385f8fb5394e（2026.08.28）；35 个上游文件变更，冲突均已解决，未提交或推送。
- HTML 冲突采用上游资源版本号，并保留四个图片工具的 cli-image-tools.js 引用；后端请求同时保留 history_type 和上游 operation、resolution_type 等字段。
- 现有 Node 测试 6/6 通过；26 段 JavaScript 和 main.py 语法检查通过；git diff --cached --check 通过；OpenSpec 严格校验通过。
- 在 .git/local-backup-20260921/validation 的隔离副本中完成后端导入、OpenAPI HTTP 请求、合并请求字段、GPT 尺寸转换、模拟 CLI 服务就绪检查，全部通过。未启动实际服务或调用外部生图。
- 上游 test_canvas_log_cleanup.py 共 14 项测试失败：依赖的 delete_canvas_log、collect_local_media_urls 等函数已被上游 a581fbb 移除。在纯上游 67f49e4 的隔离副本中复现相同 14 项错误，属于上游遗留测试问题，本次不恢复已删除功能或修改测试掩盖失败。
- 本地 API/.env、history.json、data 与 assets 中共 12 个既有文件哈希全部一致；API/.env 未加入暂存区。
- 备份配置与哈希记录位于 .git/local-backup-20260921，未进入业务文件或提交范围。
- Git 保持已解决冲突、待提交的合并状态；未并入 origin/main 的 Docker 变更。
