# Learn As You Go · DSH 原生插件

> Keep the technical output. Put the plain-language Chinese meaning directly below it.
>
> 保留可复制、可检索的技术原文，在下一行补充中文白话解释。

`learn-as-you-go-dsh` 是 Learn-As-You-Go 理念在 DeepSeek Harness (DSH) 上的**原生实现**：
一个零 pi 依赖、直接消费 DSH 服务的 Cordis bundle 插件。它向 agent 的系统提示词注入
"↳ 通俗解释"格式规则，让技术输出旁边始终带着给非技术读者的中文白话解释。

```md
The retry loop can create duplicate writes because the idempotency key is generated inside the retry callback.
↳ 重试时可能写入重复数据，因为“判断是不是同一次操作”的 key 是每次重试时重新生成的。
```

## 与 pi 移植版的区别

这是全新实现，不复用旧项目的 Core/pi 契约：

| 维度 | 旧移植版（learn-as-you-go） | 本插件 |
|---|---|---|
| 宿主 | pi 原生 + DSH 双宿主，共享 host-agnostic Core | 纯 DSH 原生 |
| 依赖 | `@earendil-works/pi-coding-agent` peerDeps、Core 抽象 | 仅 `@deepseek-ai/*` 服务包 |
| 契约 | `PromptPolicyCapability` / `complete-prompt` 压制（DSH 中为死代码） | 无；依赖 DSH 自身的 complete-section 机制 |
| 命令 | `on\|off\|status`（level 不可调） | `on\|off\|status\|level 1\|2` |
| 设置 | 无 UI 字段 | schema 驱动设置面板（enabled + level），热更新 |
| 测试 | mock ctx | 真实 Cordis + 真实 DSH 服务集成测试 |

## 安装

打包后安装进 profile：

```bash
npm run build
npm pack                          # 产生 learn-as-you-go-dsh-<version>.tgz
dsh plugin --profile web add ./learn-as-you-go-dsh-<version>.tgz
```

启动 profile（如 `dsh web`）后，启动日志出现
`[learn-as-you-go-dsh] plugin loaded ...`。新安装默认关闭。

### 开发 overlay（不安装）

```bash
dsh web --patch ./cordis.patch.yml
```

### 零 harness 独立运行

```bash
npm run dev      # 通过 Cordis loader 挂载 ./cordis.yml，加载后退出
```

## 使用

| 命令 | 效果 |
|---|---|
| `/learn-as-you-go on` | 开启解释（写入 settings，持久化） |
| `/learn-as-you-go off` | 关闭解释 |
| `/learn-as-you-go status` | 显示当前状态与 section 挂载情况 |
| `/learn-as-you-go level 1` | 入门档（30–50 字，口语化、可加类比） |
| `/learn-as-you-go level 2` | 标准档（15–25 字，简短直白，默认） |

设置面板（Web UI 设置 → 插件）中可编辑 `learn-as-you-go` 命名空间的
`enabled` 与 `level`，即时生效（live applies）。

## 读者档位

| 档位 | 解释行为 | 配对 | 目标长度 |
|---|---|---|---|
| 1 · 入门 | 概念术语换成日常中文，给具体因果或类比 | 每个技术段落/列表项各一条 `↳` | 30–50 字 |
| 2 · 标准 | 技术名词保留在原文，只解释核心含义或影响 | 每个语义块一条；同类短列表可合并 | 15–25 字 |

两种档位下，`APP_DATABASE_URL`、路径、命令、端口、ID、hash、产品名等标识符原样保留。

## 输出规则（理念核心）

- 用户要求的输出形态优先：要求精确 JSON/XML/YAML、只要代码/命令/日志、只要技术结论、
  或要求当前请求不做白话解释时，不加 `↳`；
- `↳` 永不进入代码块、shell 命令、表格、路径、URL、hash、标识符内部；
- 技术锚点跟随用户请求的语言，不为了配对而切换语言；
- 用户提供的源文本原样保留；生成的解释写成"技术锚点 + ↳ 行"；
- 不添加原文没有的事实、风险、确定性或更强语气。

## 开发

```bash
npm install
npm run check     # typecheck + 全部测试 + 合规门禁
```

`npm run check` 覆盖：

- **7 个 policy 单测**（`test/policy.test.ts`）——档位文本契约、level 解析别名；
- **14 个集成测试**（`test/plugin.test.ts`）——真实 Cordis Context 挂载真实
  `SystemPrompt` / `SettingsProvider` / `CommandRuntime`，断言 section 组装、
  热更新、命令行为、设置持久化，全程零 mock；
- **合规门禁**（`scripts/validate.mjs`）——manifest、patch 行、entry 契约。

## 项目结构

```text
learn-as-you-go-dsh/
├── src/index.ts          # 插件入口：name / inject / Config / apply
├── src/policy.ts         # L1/L2 档位提示词正文（理念核心，字节冻结）
├── test/policy.test.ts   # 档位与 level 解析单测
├── test/plugin.test.ts   # 真实服务集成测试
├── scripts/loader.mjs    # 零 harness standalone loader
├── scripts/validate.mjs  # 合规门禁
├── cordis.patch.yml      # bundle patch 层
├── cordis.yml            # standalone 组合
└── lib/                  # 构建产物（npm run build）
```

## License

MIT
