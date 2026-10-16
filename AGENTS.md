# AGENTS.md — 心跳艺术 Heartbeat Art

## 项目概览
把可穿戴设备导出的心率 CSV（时间戳 + BPM）转化为全屏动态视觉作品。纯前端、零依赖、无构建步骤。

- **技术栈**：原生 HTML + CSS + JavaScript + Canvas 2D（`native-static` 模板）
- **本地预览**：`python3 -m http.server ${DEPLOY_RUN_PORT}`（即 `.coze` 中的 run 命令）
- **入口**：`index.html` / `styles/main.css` / `scripts/app.js`

## 文件结构
```
index.html          页面骨架：全屏 canvas + 悬浮 UI（左上品牌/上传、右上风格/参数、底部保存）
styles/main.css     三套材质主题变量（body[data-style]）：neon / watercolor / mono
scripts/app.js      全部引擎逻辑（无外部依赖）
DESIGN.md           设计语言与材质规范（改动任何视觉前先读）
```

## 核心模块（均在 scripts/app.js）
| 函数/区段 | 职责 |
| --- | --- |
| `parseCSV` | 鲁棒 CSV 解析：逗号/分号/Tab、表头探测、BPM 列名识别（bpm/heart rate/hr/心率）、ISO/毫秒/相对时间戳、单列 BPM、范围校验 |
| `generateDemoData` | 内置 12 分钟示例心率（静息 60 → 运动 140+ → 恢复），无文件也能播放 |
| `finalizeDataset` | 排序、BPM 范围、**累计节拍表**（beats = ∫bpm/60 dt），是数据时间↔节拍位置的映射基础 |
| `bpmAt` / `timeAtBeat` | 二分查表：数据时间 → BPM；累计节拍 → 数据时间（保证波形节拍间隔恒定） |
| `ecgShape` | 高斯函数合成 PQRST 心动波形（R 峰、S 谷、T 波） |
| `buildNormLut` / `normAtBeat` | 沿节拍轴采样的归一化 BPM 查找表（O(1)，供 2000 粒子复用） |
| `buildSprites` | 按当前调色板预渲染 48 张粒子精灵（neon 径向发光 / watercolor 多层晕染 / mono 墨点） |
| `drawHalo` / `drawWave` / `drawParticles` | 背景脉动光晕（与 R 峰同步）、发光波形分段着色、景深粒子轨道 |
| `frame` | rAF 主循环：半透明底色覆盖做拖尾、推进播放头、FPS 统计与 DPR 自适应降级 |
| `savePNG` | canvas.toBlob 导出 `heartbeat-art-{风格}-{时间戳}.png` |

## 三种风格差异
- **neon**：近黑紫底、`lighter` 加色混合、shadowBlur 发光、毛玻璃面板
- **watercolor**：暖宣纸底、多层低透明度软边、无加色混合
- **mono**：冷白底、纯墨 1px 线、墨点粒子、同心线光晕、无任何 blur/渐变发光（主题色仅在 R 峰极细强调）

## 常用命令
```bash
# JS 语法检查
node --check scripts/app.js

# 纯逻辑单元测试（临时文件，不入库；需复制 app.js 后用 Module 编译纯函数段）
node /tmp/heartbeat-logic-test.js

# 启动静态服务（沙箱内由 .coze 管理，通常无需手动）
python3 -m http.server 5000
```
无 package.json，无 lint/test 脚本；验证通过 `test_run`（静态资源 200 + node --check）。

## 性能约束
- 粒子上限 2000（滑块 100–2000），目标 ≥30fps
- DPR 初始上限 1.75；fps <28 持续时自动降到 1.25 → 1
- 粒子用预渲染精灵 `drawImage`，仅波形做 shadowBlur（每帧 1–2 次）
- 拖尾用一次全屏半透明 fillRect，避免逐帧 clearRect

## 可访问性
- `prefers-reduced-motion`：自动勾选开关，运动速度 ×0.12、光晕脉冲减弱、拖尾更快消退；用户可手动覆盖
- 所有控件可聚焦，焦点环按材质区分；滑块带 `aria-valuenow`，按钮带 `aria-label`
- BPM 高低同时用色相 + 粒子尺寸/亮度/透明度表达，灰度可辨

## CSV 兼容格式
```csv
timestamp,bpm          # 标准（秒/毫秒/相对秒自动识别）
2024-01-01T00:00:00Z,72  # ISO 时间
72                     # 仅一列 BPM 也可
```
合理 BPM 范围 30–240，范围外行丢弃；有效行不足 3 行报错（错误显示在上传按钮下方，不弹 alert）。

## 修改注意
- 改视觉前先读 `DESIGN.md`：禁止与心率无关的装饰脉动、禁止霓虹风格外的毛玻璃、禁止水彩/极简混用发光
- 风格新增：在 `STYLE_CONFIG` 增加一个 key，并同步 index.html 的 seg 按钮、CSS 变量块、`body[data-style=...]`
- 颜色主题新增：向对应风格 `palettes` 数组追加 `{name, low, high, glow}` 即可，色板 UI 自动生成
- 端口必须取 `${DEPLOY_RUN_PORT}`，禁止硬编码
