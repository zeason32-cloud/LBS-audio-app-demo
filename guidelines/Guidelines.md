# 设计系统指南（UI Framework）

本项目已重构为「设计 token + UI 原语」的可换肤框架。改风格 / 接素材时遵循下面规则，避免回到散落的硬编码颜色。

## 单一设计源
所有视觉变量集中在 `src/styles/theme.css`，分三层：
1. **Primitives**（基础调色板）：`--ink-*`、`--white`、功能色 `--sound/location/route/social-500`。
2. **Semantic**（语义令牌）：`--surface-0/1/2/3`、`--text-1/2/3`、`--radius-control/card/sheet/pill`、`--elev-1/2/3`、`--space-*`、`--dur-*` / `--ease-out`。
3. **组件消费**：组件只引用语义令牌，绝不写死十六进制色（封面渐变除外，使用 song.color）。

> 换肤：只改 primitives / semantic 即可全局生效。暗色模式已在 `.dark` 下映射好语义令牌。

## 功能色（按含义使用，不要随机）
| 令牌 | 含义 | Tailwind 类 |
|------|------|------------|
| `--sound-500` | 音乐能量（暖色点缀） | `text-sound` / `bg-sound` |
| `--location-500` | 定位 / 导航 / 主交互 | `text-location` |
| `--route-500` | 路线 / 漫游 / 成功 | `text-route` |
| `--social-500` | 社交 / 留言 / 收藏 | `text-social` |

## UI 原语（`src/app/components/ui/kit.tsx`）
统一组成所有页面，新页面优先复用：
- `Screen` / `ScreenHeader`：页面容器 + 顶部安全区 + 标题（eyebrow/title/subtitle/action）。
- `Card`（`level` 1–3 对应 surface 层级，`radius` control/card/sheet）。
- `IconButton`（圆形按钮，≥44px 触控；variant glass/solid/ghost/accent）。
- `SectionTitle`、`SegmentedTabs`、`Badge`、`StatTrio`、`Cover`。

## 布局与可达性规则
- 触控目标 ≥ 44px（`button` 已全局 `min-height:44px`；圆钮用 `.icon-btn`）。
- 底部导航 / sheet 预留安全区（`.pb-safe` / `.pt-safe`）。
- 圆角语义化：列表行 `r-control`(12)、主卡片 `r-card`(20)、底部面板 `r-sheet`(28)、头像/圆钮/标签 `r-pill`。
- 阴影克制：用 `--elev-1/2/3` 三档，不叠加多重阴影。
- 大字号（`.display` 36px）只用于播放器 / 引导大标题，列表页标题用 `h1`(24)。
- 移动端不依赖 hover；交互反馈用 `.pressable`（active 缩放）。
- 尊重 `prefers-reduced-motion`（已全局处理）。

## 接素材 / 进一步美化
- 替换封面占位：改 `Cover` 原语内部为 `<img>` 即可，不动调用方。
- 真实地图：替换 `MapView` 顶部的 SVG 底图层（街区/主路/公园/水域）为地图瓦片或 SVG 素材。
- 真实波形：`ExploreView` 的 `Waveform` 用静态条占位，可接 AnalyserNode 实时数据。
