# 视觉判断节点验收记录

日期：2026-09-22。首版已本地实现，未提交、推送或部署。

## 实现范围

- 普通无限画布新增视觉判断节点，支持固定审核出口及 2–6 个自定义分类出口。
- 只执行命中分支，传递原图并可附加依据或建议；支持固定次数串行、并行循环，轮次隔离、停止、失败手动重试。
- 支持结果预览、键盘连接、配置变更失效提示、保存加载及版本 2 工作流导入导出。普通工作流继续使用版本 1。
- 新增 `vision_judge.py`、`static/js/vision-routing.js`、`static/js/canvas-vision-judge.js`、`static/css/vision-judge.css`；在 `main.py`、`static/canvas.html`、`static/js/canvas.js` 中接入。

## 自动化验证

新增 28 项测试全部通过：

| 文件 | 数量 | 主要证据 |
| --- | ---: | --- |
| `tests/test_vision_judge.py` | 9 | 严格结果契约、非法响应、已选模型及图片、请求失败、版本与能力往返 |
| `tests/vision-routing.test.cjs` | 9 | 三个审核出口、原图与可选文本、并行隔离、停止、重试、扇出、非法图与版本 |
| `tests/canvas-vision-integration.test.cjs` | 10 | 实际生成器及 LLM 输入适配、循环取图、运行字段序列化、编辑立即生效、历史结果失效、并行错误保存、旧串行与并行循环 |

执行命令：

```powershell
node --test tests/vision-routing.test.cjs tests/canvas-vision-integration.test.cjs
.\python\python.exe tests/test_vision_judge.py
```

相关回归通过：`retired-canvas-models.test.mjs`、`unified-prompt-content.test.mjs`、`functional-findings.test.mjs`，以及 `test_canvas_persistence.py`（6 项）、`test_prompt_reverse.py`（4 项）。新增前端脚本及主画布脚本语法检查通过，OpenSpec 严格校验通过。

## 浏览器与真实模型

新建专用画布「视觉判断 · 功能验收」，ID：`8dbd366c263f4b7193c532ec236fa61e`。输入是自行生成的 512 × 512 白底红色正方形，不使用用户私人图片。

用户未另行指定验收模型，已告知使用画布当前默认配置：AI Gateway / `Codex/gpt-6-astra`。

| 场景 | 实际结果 |
| --- | --- |
| 审核白底红色正方形 | `pass`；依据为图片中央有红色正方形、背景白色，约 10.5 秒 |
| 分类测试：红色色块 / 蓝色色块 | 命中「红色色块」，约 6.0 秒 |
| 完整分类流程 | 命中「红色色块」，依据为「图片主体是白色背景上的红色正方形色块。」；约 9.7 秒；红色出口的 Output 显示原图并完成，蓝色出口的 Output 显示已跳过 |
| 上游连接超时 | 显示执行失败，不激活分支、不自动重试；手动重试后成功 |

浏览器已操作节点创建、上传与拖线、键盘选择连接目标、模式与类别编辑、判断要求编辑后立即执行、测试判断、完整流程运行、结果展示及保存刷新。验收中修复了文本草稿未及时提交、旧结果误亮出口、端口伪元素位置和输出节点局部刷新遗漏运行状态等问题。

截图保存在工作区 `outputs/vision-judge-verification/classification.png`。

试用地址：<http://127.0.0.1:3012/static/canvas.html?id=8dbd366c263f4b7193c532ec236fa61e&project=default>。专用服务绑定本机 3012 端口；原 3000 服务未重启，需要重启后才会加载新的后端接口。

## 验证边界

- 真实调用只覆盖上述一个 API 平台和模型；没有逐一实测其他服务商、ComfyUI、RunningHub 或视频生成后端。相应现有执行器入口已适配，但不能把受控响应测试视为全部后端的真实验收。
- 首版每轮单图；不支持回连自动返工、分支汇合、多循环控制器、智能画布或 CLI 视觉适配。
- 页面驱动运行，刷新会中断未完成流程；已发给服务商的请求不保证能取消或免计费。
- 分类配置较多时节点较高，可缩放画布查看。后续可另行收敛配置区布局，不扩大本次实现范围。
