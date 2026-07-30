# 开发规范 (CRITICAL)

## 包管理器

**必须使用 pnpm**，禁止使用 npm 或 yarn：

```bash
pnpm add <package>           # 安装生产依赖
pnpm add -D <package>        # 安装开发依赖
pnpm install                 # 安装所有依赖
pnpm remove <package>        # 移除依赖
```

## 图片与视频资源使用规范

**强制规则**：图片、视频等静态资源必须通过 TOS 对象存储管理，代码中使用 TOS 返回的 URL 引用。

1. **资源存储方式**：
   - 所有图片和视频资源必须上传到 TOS 对象存储，使用返回的 URL 在代码中引用
   - 需要上传功能时，必须加载 `storage` 技能获取 TOS 上传能力
   - 仅 TabBar 图标允许放在 `src/assets/tabbar/` 下（微信小程序 TabBar 强制要求本地 PNG），其余一律走 TOS

2. **禁止事项**：
   - 禁止将大图片、视频等资源直接打包到项目中（会导致包体积超限）
   - 禁止使用 `https://via.placeholder.com/` 等占位符服务
   - 禁止使用 `/images/placeholder.jpg` 等虚构路径
   - 禁止使用 `https://example.com/` 等示例域名

3. **正确实践**：

   ```tsx
   // ✅ 使用 TOS 对象存储返回的 URL
   <Image src={tosImageUrl} />

   // ❌ 禁止将图片打包到项目（TabBar 图标除外）
   <Image src="/assets/logo.png" />

   // ❌ 禁止使用占位符
   <Image src="https://via.placeholder.com/300" />
   ```

## Git 提交规范

项目使用 Commitlint 强制规范提交信息：

```bash
git commit -m "feat: 新增用户登录功能"
git commit -m "fix: 修复列表加载问题"
git commit -m "style: 优化首页样式"
```

## 命名规范

**命名规范**：

- **文件名**：使用 kebab-case，例如 `user-profile.tsx`
- **组件名**：使用 PascalCase，例如 `UserProfile`
- **变量/函数**：使用 camelCase，例如 `getUserInfo`
- **常量**：使用 UPPER_SNAKE_CASE，例如 `API_BASE_URL`
- **类型/接口**：使用 PascalCase，例如 `UserInfo`
- **CSS 类名**：使用 Tailwind css

## 组件库

Taro 版 shadcn/ui 组件库在 `@/components/ui` 路径下，使用 `ls src/components/ui` 可查看所有可用组件。你可以随意使用或修改这个目录下的组件源代码。

可用组件总览如下：

| 组件名称       | 导入路径                          | 典型使用场景                       | 选型提示                             |
| -------------- | --------------------------------- | ---------------------------------- | ------------------------------------ |
| Accordion      | `@/components/ui/accordion`       | FAQ、设置分组、折叠内容列表        | 适合分段展开/收起内容                |
| Alert          | `@/components/ui/alert`           | 页面内提示、风险提醒、状态说明     | 纯展示型提示，不承载强交互           |
| AlertDialog    | `@/components/ui/alert-dialog`    | 删除确认、危险操作二次确认         | 比普通 Dialog 更适合高风险确认       |
| AspectRatio    | `@/components/ui/aspect-ratio`    | 图片卡片、视频封面、媒体占位       | 需要固定宽高比时优先使用             |
| Avatar         | `@/components/ui/avatar`          | 用户头像、群组头像、评论区身份展示 | 支持图片与 fallback 文本             |
| Badge          | `@/components/ui/badge`           | 状态标签、分类标记、数量标识       | 适合轻量状态标识，不替代按钮         |
| Breadcrumb     | `@/components/ui/breadcrumb`      | 层级导航、路径回溯                 | 适合多层信息架构或管理后台           |
| Button         | `@/components/ui/button`          | 提交、确认、取消、主次操作入口     | 所有通用按钮优先用它，不手搓         |
| ButtonGroup    | `@/components/ui/button-group`    | 连续操作按钮、分组操作栏           | 适合同一语义下的多个并列操作         |
| Calendar       | `@/components/ui/calendar`        | 日期选择、签到、行程安排           | 需要可视化日期面板时使用             |
| Card           | `@/components/ui/card`            | 信息卡片、列表项容器、模块分组     | 页面块级容器优先考虑它               |
| Carousel       | `@/components/ui/carousel`        | 轮播图、引导页、Banner 展示        | 多张内容横向切换时使用               |
| Checkbox       | `@/components/ui/checkbox`        | 多选表单、协议勾选、批量选择       | 多项可同时选中时用 Checkbox          |
| CodeBlock      | `@/components/ui/code-block`      | 代码展示、命令示例、技术说明       | 展示代码片段时优先复用               |
| Collapsible    | `@/components/ui/collapsible`     | 展开更多、收起详情、简化视图       | 单块内容折叠比 Accordion 更轻        |
| Command        | `@/components/ui/command`         | 命令面板、搜索动作入口、快捷操作   | 适合“搜索 + 选择动作”交互            |
| ContextMenu    | `@/components/ui/context-menu`    | 长按菜单、上下文操作菜单           | 适合局部对象的附加操作               |
| Dialog         | `@/components/ui/dialog`          | 普通弹窗、表单弹层、信息确认       | 非危险弹窗默认优先用 Dialog          |
| Drawer         | `@/components/ui/drawer`          | 底部抽屉、移动端筛选面板           | 更适合移动端从边缘滑出的层           |
| DropdownMenu   | `@/components/ui/dropdown-menu`   | 更多操作、头像菜单、筛选菜单       | 适合触发后展示短菜单列表             |
| Field          | `@/components/ui/field`           | 表单项布局、标签与控件对齐         | 统一表单结构时优先使用               |
| HoverCard      | `@/components/ui/hover-card`      | 预览卡片、悬停详情、补充信息       | 适合轻量预览，不适合关键流程         |
| Input          | `@/components/ui/input`           | 单行输入、搜索框、账号密码输入     | 通用单行输入必须优先使用             |
| InputGroup     | `@/components/ui/input-group`     | 带前后缀输入框、搜索栏、金额输入   | 输入框需嵌入图标/按钮时使用          |
| InputOTP       | `@/components/ui/input-otp`       | 验证码、短信口令、一次性密码输入   | OTP 场景不要自行拆格手搓             |
| Label          | `@/components/ui/label`           | 表单标签、字段说明、输入关联文本   | 与 Input/Checkbox 等配合使用         |
| Menubar        | `@/components/ui/menubar`         | 顶部菜单栏、桌面式功能菜单         | 适合较复杂的菜单层级                 |
| NavigationMenu | `@/components/ui/navigation-menu` | 导航入口、站点级菜单、分栏导航     | 用于页面级或模块级导航               |
| Pagination     | `@/components/ui/pagination`      | 分页列表、表格翻页、结果页码导航   | 数据量大需分页时优先使用             |
| Popover        | `@/components/ui/popover`         | 浮层说明、轻量表单、局部附加内容   | 比 Dialog 更轻，比 Tooltip 更丰富    |
| Portal         | `@/components/ui/portal`          | 浮层挂载、顶层渲染容器             | 一般作为底层能力，业务少直接使用     |
| Progress       | `@/components/ui/progress`        | 上传进度、任务进度、完成度展示     | 线性进度反馈优先用它                 |
| RadioGroup     | `@/components/ui/radio-group`     | 单选题、规格选择、互斥选项         | 互斥选择不要用 Checkbox 替代         |
| Resizable      | `@/components/ui/resizable`       | 可拖拽分栏、面板尺寸调整           | 适合复杂布局或工作台场景             |
| ScrollArea     | `@/components/ui/scroll-area`     | 自定义滚动区域、长列表容器         | 局部滚动区域优先考虑它               |
| Select         | `@/components/ui/select`          | 下拉选择、选项筛选、单项选择器     | 标准选项选择器优先用 Select          |
| Separator      | `@/components/ui/separator`       | 分割线、内容区块分隔               | 视觉分隔优先用它，不手写边框线       |
| Sheet          | `@/components/ui/sheet`           | 侧边栏、抽屉面板、配置面板         | 适合从边缘滑出的补充面板             |
| Skeleton       | `@/components/ui/skeleton`        | 加载骨架屏、列表占位、页面预加载   | 加载态优先用 Skeleton，不写灰块假 UI |
| Slider         | `@/components/ui/slider`          | 音量、价格区间、数值拖动调节       | 连续数值输入优先用 Slider            |
| Sonner         | `@/components/ui/sonner`          | 轻提示、操作反馈、全局消息提醒     | 偏轻量 toast 通知能力                |
| Switch         | `@/components/ui/switch`          | 开关设置、布尔状态切换             | 开/关场景优先用 Switch               |
| Table          | `@/components/ui/table`           | 数据表格、对账列表、结构化信息展示 | 表格型数据不要用 View 手搓           |
| Tabs           | `@/components/ui/tabs`            | 分段切换、内容分类、频道页         | 标签切换场景优先用 Tabs              |
| Textarea       | `@/components/ui/textarea`        | 多行输入、备注、评论、反馈内容     | 多行文本输入必须优先使用             |
| Toast          | `@/components/ui/toast`           | 操作结果提示、失败提醒、短时反馈   | 适合局部或系统级短反馈               |
| Toggle         | `@/components/ui/toggle`          | 单个开关按钮、格式切换、选中态按钮 | 适合按钮式开/关选择                  |
| ToggleGroup    | `@/components/ui/toggle-group`    | 多个切换按钮组合、视图模式选择     | 适合按钮组式互斥/多选切换            |
| Tooltip        | `@/components/ui/tooltip`         | 图标说明、补充提示、悬停解释       | 只放简短解释，不承载复杂内容         |

IMPORTANT: 优先使用 `@/components/ui` 下的组件，只对必要情况（如组件库缺失组件，或者 View、Text、Camera、Canvas 等无需封装的组件）才能直接使用 `@tarojs/components` 原生组件。

CRITICAL（执行约束）：

- 只要涉及“通用 UI 组件”（按钮/输入框/弹窗/表单控件/菜单/提示/卡片/表格/标签页等），必须先在 `src/components/ui` 查找并优先使用；存在即从 `@/components/ui/*` 导入使用。
- 禁止用 `View/Text` + Tailwind 手搓上述通用组件的外观与交互，除非组件库确实缺失且你已按下条补齐或说明理由。
- 组件库缺失时，优先把组件补齐到 `src/components/ui`（可复用、可维护），再在页面中引用；不要在页面/业务组件里临时造轮子。
- 页面实现前必须先判断：按钮、输入框、卡片、标签、Tabs、弹窗、Toast、Skeleton 等是否已有 `@/components/ui/*` 可复用；能用组件库的地方，不要退回原生组件或单独写样式。
- 若最终没有使用 `@/components/ui/*` 中已存在的通用组件，必须先自查并改回；不要把“赶时间”当作例外理由。
- 以上规则以页面级 ESLint 作为兜底；若页面中直接使用原生 `Input`，或用 `View/Text` 手搓通用 UI，`pnpm validate` 会报错。

示例：

```tsx
// ✅ 优先使用 ui 组件
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Text } from '@tarojs/components'

<Card>
  <CardContent className="p-4">
    <Button onClick={() => {}}>
      <Text>提交</Text>
    </Button>
  </CardContent>
</Card>
```

```tsx
// ❌ 不要手搓“按钮/弹窗/输入框”等通用组件（除非组件库缺失）
import { View, Text } from '@tarojs/components'

<View className="px-4 py-2 rounded bg-primary">
  <Text className="text-primary-foreground">提交</Text>
</View>
```

## 样式开发

IMPORTANT：样式默认优先使用 Tailwind。凡是 Tailwind 能表达的样式，都不要退回 `style` 或 `.css`；只有动画、关键帧、复杂选择器、第三方组件覆盖、框架级兼容处理等场景，才允许少量使用 CSS。

CRITICAL：

- 默认先写 `className`，再考虑 `style`。
- 颜色、间距、圆角、边框、阴影、排版、flex/grid、宽高等常规样式必须收敛在 Tailwind 类名中。
- 禁止使用 `w-[340px]`、`text-[14px]`、`p-[16px]` 这类带 `px` 的 Tailwind 任意值。
- 禁止使用 `style={{ width: '200px' }}`、`fontSize: '14px'` 这类硬编码尺寸。
- Taro 会通过 `pxtransform` 将尺寸转换为跨端单位（小程序 `rpx`、H5 `rem`），业务代码里直接写 `px` 容易导致不同端显示不一致。
- `style` 只允许用于少量跨端兼容修正；`.css` 只用于 Tailwind 明显不适合的场景，且范围必须最小。
- 若页面主要样式本可用 Tailwind 表达，却仍主要来自 `style={{ ... }}` 或 `.css` 文件，视为不合规实现。

> 项目已集成 Tailwind CSS 4 + weapp-tailwindcss，支持跨端原子化样式：

```tsx
<View className="flex flex-col h-full">
  <Text className="text-2xl font-bold text-blue-600 mb-4">标题</Text>
  <View className="w-full px-4">
    <Button className="w-full bg-blue-500 text-white rounded-lg py-3">
      按钮
    </Button>
  </View>
</View>
```

**推荐做法**：优先使用 Tailwind 预设类名或相对单位，避免硬编码 `px`。

```tsx
// ❌ 错误：硬编码 px 值，跨端显示不一致
<View className="w-[340px] h-[200px] p-[16px]">
  <Text className="text-[14px]">内容</Text>
</View>

// ✅ 正确：使用 Tailwind 预设类名
<View className="w-full max-w-sm h-48 p-4">
  <Text className="text-sm">内容</Text>
</View>
```

## 图标库 (lucide-react-taro)

项目使用 `lucide-react-taro` 作为图标库，这是 Lucide 图标的 Taro 适配版本，已经进行预安装。

### 渲染原理（微信小程序端）

每个 icon 不是用 `<svg />` 渲染，而是把 SVG 字符串编码成 `data:image/svg+xml,...`，再用 `@tarojs/components` 的 `<Image />` 渲染。

这带来一个关键结论：`className` 只作用在 `<Image />` 本身（布局/外边距/对齐等），不会作用到 SVG 内部的 `stroke/fill`，也不会从父级继承 `currentColor`。

### 用法示例

✅ 正确示例（优先用 `color/size/strokeWidth`，避免再额外写尺寸样式）

```tsx
import { House, Settings, Camera } from 'lucide-react-taro'

<House />
<Settings size={32} />
<Camera color="#ff0000" />
<Camera size={48} color="#1890ff" strokeWidth={1.5} />

<House className="mr-2" size={18} color="#1890ff" />
```

❌ 错误示例（`className` 的 `text-*` 不会改变 icon 的 `stroke/fill`；它只是 `<Image />` 的 class）

```tsx
import { House } from 'lucide-react-taro'

<House className="text-red-500 w-8 h-8" />
```

### 查找可用图标

图标命名与 Lucide 官方一致（PascalCase），完整列表可使用命令查询：

```bash
npx taro-lucide-find --list
```

推荐在生成代码前，使用 `--json` 参数批量验证图标是否存在：

```bash
npx taro-lucide-find arrow-up user settings arw --json
```

## 网络请求规范 (Network Request Guidelines)

### 1. 全局路由前缀

项目后端入口 `main.ts` 中已配置 `app.setGlobalPrefix('api')`，所有路由会自动加上 `/api` 前缀。

**严格约束**：

后端响应状态码：在编写 NestJS 后端接口时，我会显式处理 HTTP 状态码，确保所有成功的请求（包括通常默认返回 201 的 POST 请求）统一返回 HTTP 200 OK。

在编写 NestJS Controller 代码时，**绝对禁止**在 `@Controller()` 或 `@Get()`/`@Post()` 等路由装饰器的路径中手动添加 `api` 字样。

**示例**：

- ✅ 正确：`@Controller('users')` (实际路由: `/api/users`)
- ❌ 错误：`@Controller('api/users')` (实际路由: `/api/api/users`)

### 2. 发送请求

Network 是对 Taro.request、Taro.uploadFile、Taro.downloadFile 的封装，自动添加项目域名前缀，参数与 Taro 一致。

IMPORTANT: 禁止直接使用 Taro.request、Taro.uploadFile、Taro.downloadFile，使用 Network.request、Network.uploadFile、Network.downloadFile 替代。

IMPORTANT: 禁止自己封装 Network 类/库/文件，必须使用预先封装好的 Network `import { Network } from '@/network'`

IMPORTANT: 如无必要，禁止修改 `@/network` 中的文件，即使遇到 tsc 类型报错，也不能修改

✅ 正确使用方式

```typescript
import { Network } from '@/network'

// GET 请求
const data = await Network.request({
  url: '/api/hello'
})

// POST 请求
const result = await Network.request({
  url: '/api/user/login',
  method: 'POST',
  data: { username, password }
})

// 文件上传
await Network.uploadFile({
  url: '/api/upload',
  filePath: tempFilePath,
  name: 'file'
})

// 文件下载
await Network.downloadFile({
  url: '/api/download/file.pdf'
})
```

❌ 错误用法

```typescript
import Taro from '@tarojs/taro'

// ❌ 会导致自动域名拼接无法生效，除非是特殊指定域名
const data = await Network.request({
  url: 'http://localhost/api/hello'
})

// ❌ 不要直接使用 Taro.request
await Taro.request({ url: '/api/hello' })

// ❌ 不要直接使用 Taro.uploadFile
await Taro.uploadFile({ url: '/api/upload', filePath, name: 'file' })
```

### 3. URL 构建规范 (CRITICAL)

**禁止硬编码 localhost 或域名到请求 URL 中**

在使用 `Network.request`、`Network.uploadFile`、`Network.downloadFile` 等 API 时，**严禁**硬编码完整的域名或 localhost 地址。

**错误示范**：

```typescript
// ❌ 错误：硬编码 localhost 地址
await fetch('http://localhost:3000/api/knowledge/chat', {
  method: 'POST',
  body: JSON.stringify({ message })
})

// ❌ 错误：硬编码域名
await Network.request({
  url: 'http://example.com/api/hello'
})
```

**正确做法**：

```typescript
// ✅ 正确：使用相对路径，让 Network 自动处理
await Network.request({
  url: '/api/knowledge/chat',
  method: 'POST',
  data: { message }
})

// ✅ 正确：如果需要使用外部域名，显式判断
const isExternalUrl = url.startsWith('http://') || url.startsWith('https://')
if (isExternalUrl) {
  // 使用完整 URL
  await Network.request({ url })
} else {
  // 使用相对路径，Network 会自动添加 PROJECT_DOMAIN
  await Network.request({ url: '/api/...' })
}
```

**工作原理**：

1. **开发环境（H5）**：使用 `/api/xxx` 相对路径，Vite 的 proxy 会自动将其代理到 `http://localhost:3000/api/xxx`
2. **生产环境**：如果配置了 `PROJECT_DOMAIN` 环境变量，Network 会自动拼接为 `${PROJECT_DOMAIN}/api/xxx`
3. **小程序端**：同样会根据 `PROJECT_DOMAIN` 配置使用正确的域名

**Vite 代理配置**（已在项目中配置，无需修改）：

```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
}
```

**关键原则**：

- ✅ 始终使用 `/api/xxx` 形式的相对路径
- ✅ 让 Network 自动处理域名拼接
- ✅ 在 H5 开发环境中依赖 Vite proxy
- ❌ 禁止硬编码 `http://localhost:3000`
- ❌ 禁止在业务代码中使用 `fetch` 直接调用 API

### 4. 接口数据解包与防御性编程 (API Response Handling & Unwrapping)

**警惕 "嵌套 Data" 陷阱 (Critical: The Double Data Trap)**
在处理前后端交互时，必须敏锐识别数据结构的嵌套层级：

1. **第一层 (`res.data`)**：`Taro.request` 返回的对象包含 `statusCode`, `header`, `data`。这里的 `data` 是 HTTP 响应体。
2. **第二层 (`res.data.data`)**：现代后端（NestJS）通常遵循 "Envelope Pattern"（信封模式），将业务数据再次封装在 JSON 的 `data` 字段中（如 `{ code: 200, msg: "success", data: { ... } }`）。

**严格执行以下约束：**
- **先打印，后访问**：在编写数据处理逻辑前，必须先 `console.log(res.data)` 确认后端返回的 JSON 结构。
- **拒绝盲目直连**：禁止想当然地认为 `res.data` 就是业务对象。
- **防御性取值**：优先使用可选链 (`?.`) 或编写明确的解包逻辑。
- **TypeScript 强类型**：如果可能，应定义通用的 `ApiResponse<T>` 接口来强制提示数据层级。

**错误示范 (Don't do this)**：

```typescript
// ❌ 假设后端直接返回了用户对象，实际上后端返回的是包裹后的 JSON
const { avatar_url } = res.data; // 报错或 undefined
```

## H5/小程序跨端兼容性（CRITICAL）

### 跨端规则速查表

- Taro 原生 Text 换行/白屏：小程序 block 正常，H5 inline 白屏 → 垂直 Text 添加 `block` 类 + 平台检 测直接判断
- Taro 原生 Input 样式：H5 端 inline 导致样式失效 → View 包裹，样式放外层
- Taro 原生 Input/Button Flex：H5 不支持 flex → View 包装，flex 放 View 上
- Fixed + Flex：H5 Tailwind 失效 → 必须 `style={{ position: 'fixed', display: 'flex' }}`
- 底部 TabBar 重叠 → 底部固定元素 `bottom: 50`+，列表加底部内边距
- 原生组件：H5 不可用 → `Taro.getEnv() === WEAPP` + H5 降级
- RecorderManager：H5 报错 → 检测平台 + useEffect 初始化 + H5 降级
- 文件上传：H5 readFile 报错 → 用 `Network.uploadFile(tempFilePath)`
- 后端文件读取：小程序 file.path / H5 file.buffer → 同时支持两种方式
- H5 上传图片偶发裂开：Coze 平台 SW 拦截 blob fetch → H5 端取原始 File 对象手动构建 FormData 上传，绕过 Taro uploadFile

### 一、强制规范与代码模板

平台检测直接判断，禁止 useState + useEffect 设置平台（会导致状态延迟、H5 白屏）

```tsx
// ✅ 正确
const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
// ❌ 错误：状态延迟导致初始渲染错误
const [isWeapp, setIsWeapp] = useState(false)
useEffect(() => { setIsWeapp(Taro.getEnv() === Taro.ENV_TYPE.WEAPP) }, [])
```

**Taro 原生 Text 换行**：所有垂直排列的 Text 必须添加 `block`

```tsx
<Text className="block text-lg font-semibold">标题</Text>
<Text className="block text-sm text-gray-500">说明</Text>
```

**Taro 原生 Input/Textarea 样式**：必须 View 包裹，样式放 View 上（H5 端 Input 是 inline 元素）

```tsx
// ✅ 正确：View 包裹
<View className="bg-gray-50 rounded-xl px-4 py-3">
  <Input className="w-full bg-transparent" placeholder="请输入内容" />
</View>
// ❌ 错误：H5 端样式不生效
<Input className="bg-gray-50 rounded-xl px-4 py-3 w-full" />

// ✅ Textarea 同理
<View className="bg-gray-50 rounded-2xl p-4 mb-4">
  <Textarea style={{ width: '100%', minHeight: '100px', backgroundColor: 'transparent' }} placeholder="请输入详细描述..." maxlength={500} />
</View>
```

**Taro 原生 Input + Button Flex 布局**：flex 放 View，Input 用 `width: 100%`

```tsx
// ✅ 正确：View 包装 + inline style
<View style={{ display: 'flex', flexDirection: 'row', gap: '8px', padding: '12px' }}>
  <View style={{ flex: 1, backgroundColor: '#f5f5f5', borderRadius: '20px', padding: '8px 12px' }}>
    <Input style={{ width: '100%', fontSize: '14px' }} placeholder="输入消息..." />
  </View>
  <View style={{ flexShrink: 0 }}>
    <Button size="mini" type="primary">发送</Button>
  </View>
</View>
// ❌ 错误：H5 端 Input 不支持 flex
<View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
  <Input style={{ flex: 1 }} placeholder="输入消息..." />
  <Button>发送</Button>
</View>
```

**Fixed + Flex 布局**：必须 inline style（Tailwind fixed+flex 在 H5 失效），`bottom: 50` 避开 TabBar

```tsx
// ✅ 正确：inline style + 避开 TabBar
<View style={{
  position: 'fixed', bottom: 50, left: 0, right: 0,
  display: 'flex', flexDirection: 'row', gap: '12px',
  padding: '12px', backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', zIndex: 100
}}>
  <View style={{ flex: 1 }}><Button>取消</Button></View>
  <View style={{ flex: 1 }}><Button>确认</Button></View>
</View>
// ❌ 错误：Tailwind fixed+flex H5 失效，bottom-0 被 TabBar 遮挡
<View className="fixed bottom-0 left-0 right-0 flex flex-row gap-3 p-4 bg-white z-50">
  <Button className="flex-1">取消</Button>
</View>
```

### 二、原生组件平台检测

**需检测组件**: Camera, Map, Canvas, Video, RecorderManager

```tsx
{Taro.getEnv() === Taro.ENV_TYPE.WEAPP ? (
  <Camera className="w-full h-96" devicePosition="back" />
) : (
  <View className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
    <Text className="block text-gray-500 text-center">
      相机功能仅在小程序中可用{'\n'}请在微信小程序中打开体验完整功能
    </Text>
  </View>
)}
```
