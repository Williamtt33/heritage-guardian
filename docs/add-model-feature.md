# 添加场景功能 — 实现逻辑与修复记录

## 概述

"添加场景"功能运行在管理页面（`/admin`），用户上传 `.splat` 3D 模型文件、填写名称、设置封面，保存后在画廊中查看和进入 3D 查看器。

---

## 触发链路

```
Admin.tsx                          ModelForm.tsx                  存储层
─────────                          ─────────────                  ──────
                                                                  
[+ 添加场景] 按钮                   
  │ onClick                        
  │  setEditingModel(null)         
  │  setShowForm(true)             
  │                                
  └──► isOpen=true ──────────────► 渲染表单弹窗
       editingModel=null              │
                                     ├─ 拖拽/选择 .splat 文件
                                     ├─ 输入场景名称
                                     ├─ (可选) 设置封面图
                                     │
                                     └─ handleSave()
                                          │
                                          ├─ storeSplatFile()  → IndexedDB
                                          ├─ storeThumbnail()  → IndexedDB
                                          ├─ addCustomModel()  → localStorage
                                          │
                                          └─ onSaved() → load()
                                               │
                                               ├─ getBuiltinModels()  刷新
                                               └─ getCustomModels()   刷新
```

---

## 核心文件

| 文件 | 职责 |
|------|------|
| `src/pages/Admin.tsx` | 管理页面：模型列表 + 表单状态管理 |
| `src/components/editor/ModelForm.tsx` | 表单弹窗：文件上传、名称输入、保存逻辑 |
| `src/components/FileDropZone.tsx` | 文件拖拽/选择组件 |
| `src/store/modelStore.ts` | localStorage 的 CRUD |
| `src/utils/fileStorage.ts` | IndexedDB 的读写 |
| `src/utils/models.ts` | manifest 加载 + `[local]` 前缀解析 |
| `src/types/index.ts` | `ModelMeta` 类型定义 |

---

## Admin.tsx — 状态管理

```tsx
// 关键状态
const [showForm, setShowForm] = useState(false)       // 表单显隐
const [editingModel, setEditingModel] = useState(null) // null=新建, 对象=编辑

// 按钮
<button onClick={() => { setEditingModel(null); setShowForm(true) }}>
  + 添加场景
</button>

// 表单
<ModelForm
  isOpen={showForm}                           // 控制显隐
  editingModel={editingModel}                 // null=新建, 对象=编辑
  onSaved={load}                              // 保存后刷新列表
  onClose={() => { setShowForm(false); setEditingModel(null) }}  // 关闭 + 重置
/>
```

**"编辑"按钮的区别**：
```tsx
<button onClick={() => { setEditingModel(model); setShowForm(true) }}>
  编辑
</button>
```
传入已有 `model` 对象，表单会预填数据。

---

## ModelForm.tsx — 表单逻辑

### Props 类型

```tsx
interface Props {
  isOpen: boolean                    // 控制显隐
  editingModel?: ModelMeta | null    // null=新建, 对象=编辑
  onSaved: () => void                // 保存成功回调
  onClose: () => void                // 关闭回调
}
```

### 显隐方式（修复后）

```tsx
// 不用 if (!isOpen) return null，改用 CSS 控制
<div className={`fixed inset-0 ... ${isOpen ? '' : 'hidden'}`}>
```

**为什么**：`return null` 会让组件卸载/重新挂载，Hook 调用顺序可能不一致导致 React 报错。CSS `hidden` 保持组件始终挂载，Hook 顺序稳定。

### 表单状态同步（修复后）

由于组件不卸载，`useState(initialValue)` 只在首次渲染时生效。必须在 `useEffect` 中手动同步：

```tsx
useEffect(() => {
  if (!isOpen) return
  if (editingModel) {
    // 编辑模式：预填已有数据
    setName(editingModel.name || '')
    setFile(editingModel.file || '')
    setSplatFile(null)
    setCoverPreview(null)
  } else {
    // 新建模式：清空所有字段
    setName(''); setFile(''); setSplatFile(null); setCoverPreview(null)
  }
}, [isOpen, editingModel])
```

### 保存流程

```
handleSave()
  │
  ├─ 1. 校验
  │     name.trim() 不能为空
  │     splatFile 或 file 至少一个有值
  │
  ├─ 2. 生成 ID
  │     modelId = editingModel?.id || generateId()
  │     generateId() = Date.now().toString(36) + Math.random().toString(36).slice(2,8)
  │
  ├─ 3. 存储文件 → IndexedDB
  │     if (splatFile):
  │       buffer = await splatFile.arrayBuffer()
  │       storeSplatFile(modelId, buffer, filename)
  │       存到 DB 'gs-showcase-files' → store 'splat-files'
  │
  ├─ 4. 存储封面 → IndexedDB
  │     if (coverPreview):
  │       storeThumbnail(modelId, dataUrl)
  │       存到 DB 'gs-showcase-files' → store 'thumbnails'
  │
  ├─ 5. 存储元数据 → localStorage
  │     base = {
  │       name, nameEn: name,         // 注意：英文名自动用中文名
  │       file: splatFile ? '[local]文件名' : 手动路径,
  │       thumbnail: coverPreview ? '[local]' : '',
  │       hotspots: editingModel?.hotspots || [],
  │       cameraPaths: editingModel?.cameraPaths || [],
  │     }
  │     新建: addCustomModel(base, modelId)   → push 到数组
  │     编辑: updateCustomModel(id, base)     → 覆盖对应项
  │     存储在 localStorage['gs_custom_models']
  │
  └─ 6. 回调
         onSaved() → Admin.load() 刷新列表
         onClose() → setShowForm(false)
```

---

## 存储架构

```
┌──────────────────────────────────────────────────┐
│  localStorage['gs_custom_models']                │
│  类型: ModelMeta[] (JSON)                        │
│  示例: [{ id:"abc", name:"我的场景",             │
│           file:"[local]my.splat",                │
│           thumbnail:"[local]", hotspots:[], ...}]│
│  容量: ~5-10MB                                   │
├──────────────────────────────────────────────────┤
│  IndexedDB: 'gs-showcase-files'                  │
│    ├─ store 'splat-files'                        │
│    │   key = modelId                             │
│    │   value = { buffer: ArrayBuffer, filename } │
│    │   容量: 几百 MB                              │
│    └─ store 'thumbnails'                         │
│        key = modelId                             │
│        value = { dataUrl: string }   (base64)    │
└──────────────────────────────────────────────────┘
```

### `[local]` 前缀

| file 字段值 | 含义 | 加载方式 |
|-------------|------|----------|
| `[local]my.splat` | 用户上传的文件 | 从 IndexedDB 读取，返回 blob URL |
| `/models/builtin.splat` | 内置模型 | 从 `public/models/` 静态加载 |
| `https://...` | 远程 URL | 直接使用 |

`resolveModelUrl()` 在 `src/utils/models.ts` 中处理这三种情况。

---

## 历史问题与修复

### 问题 1：按钮 cursor 不变化、点击无响应

**现象**：鼠标悬停在"+ 添加场景"上，光标不变成手型，点击无任何反应。

**排查过程**：
1. 怀疑 AnimatePresence 包裹干扰 → 移除 App.tsx 中的 AnimatePresence（无效）
2. 怀疑自定义 CSS 类 `.btn-primary` 在 Tailwind v4 中未正确编译 → 换成 Tailwind 原子类 + 内联 `style={{ cursor: 'pointer' }}`（无效）
3. 怀疑 Framer Motion `motion.div` 动画干扰 → 换成普通 `<div>`（无效）
4. 怀疑 React 合成事件问题 → 添加原生 DOM 事件监听（无效）

**最终根本原因**：ModelForm 使用 `if (!isOpen) return null` 导致 Hook 顺序不稳定。当 `isOpen` 从 false 变 true 时，组件重新挂载，`useState` 重新初始化，但如果有异步状态更新，Hook 顺序会报错。

**修复**：改为 CSS `hidden` 控制显隐，组件始终挂载。

### 问题 2：编辑时表单不预填数据

**现象**：点击"编辑"按钮，表单打开了但字段都是空的。

**原因**：CSS `hidden` 方案下组件不卸载，`useState(editingModel?.name || '')` 只在首次挂载时执行。后续打开编辑时，`editingModel` 已经变了，但 state 不会自动更新。

**修复**：添加 `useEffect([isOpen, editingModel])`，每次打开弹窗时手动同步字段。

### 问题 3：新建时表单残留上次数据

**原因**：同上，关闭弹窗只是 CSS `hidden`，state 保留了上次输入的内容。

**修复**：同一个 `useEffect`，新建模式下重置所有字段为空。

### 问题 4：HotspotEditor 同类的 Hook 顺序问题

HotspotEditor 和 CameraPathEditor 同样使用了 `if (!isOpen) return null`，存在相同的风险。

**修复**：三个编辑器组件全部改为 CSS `hidden` + `useEffect` 同步方案。

---

## 表单字段清单

| 字段 | 组件 | id/name | 存储 state | 必填 |
|------|------|---------|-----------|------|
| 模型文件 | `FileDropZone` | `splat-file-upload` | `splatFile` (File) | 是* |
| 场景名称 | `<input>` | `scene-name` | `name` (string) | 是 |
| 文件路径 | `<input>` | `scene-filepath` | `file` (string) | 是* |
| 封面图片 | `<input type="file">` | `cover-input` | `coverPreview` (base64) | 否 |

*注：`splatFile` 和 `file` 至少有一个即可。

---

## 相关类型

```tsx
// src/types/index.ts
interface ModelMeta {
  id: string
  name: string;         nameEn: string
  description: string;  descriptionEn: string
  file: string          // '[local]xxx.splat' | '/models/xxx.splat' | 'https://...'
  thumbnail: string     // '[local]' | '/path/to/img.jpg' | ''
  tags: string[]
  pointCount: string;   size: string
  featured: boolean
  hotspots: Hotspot[]
  cameraPaths: CameraPath[]
}
```
