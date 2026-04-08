# 督友小程序 - 设计架构分析文档

**版本**: v1.0
**日期**: 2026年4月2日
**分析者**: GitHub Copilot

---

## 目录

1. [执行摘要](#执行摘要)
2. [系统架构概览](#系统架构概览)
3. [网络交互设计](#网络交互设计)
4. [数据存储设计](#数据存储设计)
5. [页面架构分析](#页面架构分析)
6. [数据流分析](#数据流分析)
7. [技术栈评估](#技术栈评估)
8. [架构优势](#架构优势)
9. [潜在风险与改进](#潜在风险与改进)

---

## 执行摘要

**项目名称**: 督友(DuYou) - 微信小程序  
**项目类型**: 习惯追踪应用  
**架构模式**: 分层架构 + 双模式(在线/离线)运行  
**核心特色**: API优先 + 本地缓存智能降级

### 关键指标

| 指标 | 评估 |
|------|------|
| 架构复杂度 | 中等 (5个页面，3个业务域) |
| 耦合度 | 低 (分层清晰) |
| 扩展性 | 好 (易于添加新页面和API) |
| 用户体验 | 优秀 (离线可用，自动降级) |
| 代码健壮性 | 良好 (有缓存机制) |

---

## 系统架构概览

### 三层架构模型

```
┌─────────────────────────────────────────────────────────┐
│                  表现层 (UI Layer)                      │
│  Page Component × 5                                     │
│  - index (首页/今日)                                   │
│  - habit (习惯列表)                                    │
│  - habit/edit (编辑)                                   │
│  - stats (统计)                                        │
│  - profile (个人)                                      │
└────────────────────┬────────────────────────────────────┘
                     │ this.data / setData
                     ↓
┌─────────────────────────────────────────────────────────┐
│              业务层 (Business Layer)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Storage Module (utils/storage.js)                │  │
│  │ ├─ 双模式控制 (API优先 vs 本地优先)              │  │
│  │ ├─ 本地缓存管理 (wx.getStorageSync)              │  │
│  │ ├─ 数据验证转换                                 │  │
│  │ └─ 业务逻辑 (streak计算, 统计聚合)              │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ API Module (utils/api.js)                        │  │
│  │ ├─ wx.cloud.callContainer 包装                   │  │
│  │ ├─ 认证头注入 (X-WX-OPENID, X-USER-ID)          │  │
│  │ ├─ 错误处理 (状态码判断)                         │  │
│  │ └─ 请求超时处理                                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────┬─────────────────┘
             │                          │
             ▼                          ▼
        本地存储                    网络请求
    (wx.storage 10MB)        (wx.cloud.callContainer)
        └──→ ┌─────────────────────┐
             │  Cloud API Gateway  │
             │ prod-1gjkl9vyaa17d3a2
             └──→ Spring Boot
                 springboot-po0n
                 └──→ MySQL
```

### 架构决策理由

| 决策 | 理由 |
|------|------|
| **分层架构** | 降低耦合，页面只需调用storage，不需知道API细节 |
| **双模式运行** | 网络不稳定时无缝切换，提升用户体验 |
| **缓存优先** | 减少API调用，加快响应速度 |
| **Cloud API** | 降低后端运维成本，微信原生集成认证 |
| **本地缓存同步** | 每次API成功都更新本地，保证数据一致性 |

---

## 网络交互设计

### 3.1 通信协议

**底层协议**: WeChat Container API  
**请求方式**: `wx.cloud.callContainer()`  
**传输方式**: HTTPS (微信云托管自动加密)  
**请求头**: 含微信身份信息和用户标识  

### 3.2 完整API清单

#### 用户模块

```javascript
// 登录流程
POST /api/user/login
  Body: { code: string }
  Response: { userId: string, openid: string }
  副作用: 保存userId到本地, 生成认证令牌

GET /api/user/profile
  Response: { id, openid, nickname, avatar, createdAt }
```

#### 习惯模块

```javascript
// CRUD 操作
GET /api/habits
  Query: { userId, status?: 'all'|'active'|'archived' }
  Response: Habit[]

POST /api/habits
  Body: { name, icon, color, reminder, frequency }
  Response: Habit (含生成的id)

PUT /api/habits/{id}
  Body: { name, icon, color, reminder, frequency }
  Response: Habit (更新后)

DELETE /api/habits/{id}
  Response: { success: boolean }

// 数据模型
Habit {
  id: string             // UUID
  userId: string
  name: string           // 习惯名称 (1-50字)
  icon: string           // emoji (单个字符)
  color: string          // hex color (#RRGGBB)
  reminder: boolean      // 是否提醒
  frequency: string      // 'daily'|'weekday'|'weekend'|'custom'
  streak: number         // 当前连续天数
  maxStreak: number      // 历史最大连续
  totalCheckIns: number  // 总打卡次数
  isActive: boolean      // 逻辑删除标记
  createdAt: ISO8601
  updatedAt: ISO8601
}
```

#### 打卡模块

```javascript
POST /api/checkin
  Body: { habitId, checkDate?: 'YYYY-MM-DD' }
  Response: { success, streak }
  副作用: 增加streak, 更新maxStreak

DELETE /api/checkin
  Body: { habitId, checkDate }
  Response: { success, newStreak }
  副作用: 可能重置streak

GET /api/checkin/today
  Query: { userId }
  Response: {
    habits: Habit[],
    checkedIds: string[]  // 今天已打卡的habitId
  }

GET /api/checkin/habit/{habitId}
  Response: {
    '2024-01-01': true,
    '2024-01-02': false,
    ...
  }

// 数据模型
CheckIn {
  id: string
  habitId: string
  userId: string
  checkDate: string      // 'YYYY-MM-DD'
  createdAt: ISO8601
}
```

#### 统计模块

```javascript
GET /api/statistics
  Response: {
    totalCheckIns: number
    avgStreak: number
    todayProgress: number   // 今天已完成数
    todayTotal: number      // 今天目标数
    bestStreak: number      // 历史最佳
    habits: HabitStat[]
  }

HabitStat {
  habitId: string
  name: string
  checkInCount: number
  currentStreak: number
  latestCheckDate: string
}
```

### 3.3 请求/响应周期

```
小程序页面
  │
  ├─ 1. 调用 storage.getHabits()
  │      ├─ 立即返回本地缓存 (wx.getStorageSync)
  │      └─ 更新 Page.data, 触发 setData → UI重绘
  │
  ├─ 2. 后台异步: api.getHabits()
  │      ├─ wx.cloud.callContainer 建立连接
  │      ├─ 服务端处理 (数据库查询)
  │      ├─ 返回新数据
  │      └─ 更新本地缓存 (updateCache)
  │
  └─ 3. 网络失败?
         ├─ 是 → 记录错误, 不影响UI (已用缓存)
         └─ 否 → 用新数据更新本地并可选刷新UI
```

### 3.4 错误处理逻辑

```javascript
// 典型的错误处理流程
try {
  response = await api.request(...)
  
  // 状态码判断
  if (response.code === 0 || response.code === 200) {
    // ✅ 成功
    updateLocalCache(response.data)
    return response.data
  }
  
  if (response.code === 401) {
    // 🔴 需要重新认证
    goto('/pages/profile/profile')  // 跳转登录
    throw AuthError
  }
  
  // ⚠️ 其他错误 (服务异常/数据验证失败)
  throw APIError(response.message || '未知错误')
  
} catch (err) {
  console.warn('API failed, using cache', err)
  // 降级策略
  useApi = false
  return getLocalCache()
}
```

### 3.5 认证流程

```
┌─ 启动小程序 ─┐
│              │
├─ wx.login() 获取code (5分钟有效期)
│              │
├─ api.loginWithCode(code)
│  └─ 后端调用微信接口: code → openid (安全)
│              │
├─ 返回 userId
│              │
├─ wx.setStorageSync('userId', userId)
│  wx.setStorageSync('openid', openid)
│              │
├─ 后续API请求自动带 X-USER-ID header
│              │
└─ 应用就绪, useApi = true
```

---

## 数据存储设计

### 4.1 存储层次结构

```
┌────────────────────────────────────────────────┐
│         Page Component Local State             │
│  this.data = {                                 │
│    habits: [],      // 页面级缓存              │
│    loading: false,  // UI状态                  │
│    error: null      // 错误消息                │
│  }                                             │
│  setData() → re-render UI                      │
└─────────────────────┬──────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│    App Global Data (app.globalData)            │
│  userId: string                                │
│  openid: string                                │
│  userInfo: { nickname, avatar }               │
│  cacheTime: { habits, stats, ... }            │
└─────────────────────┬──────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│     本地存储 (wx.storage - 10MB)                │
│  storage = {                                   │
│    'habits': [...],        // Array<Habit>    │
│    'checkIns': {...},      // Map<date>       │
│    'userId': 'xxx',                           │
│    'openid': 'yyy',                           │
│    'userInfo': {...},                         │
│    'isFirstLaunch': false                    │
│  }                                            │
└─────────────────────┬──────────────────────────┘
                      │ (Network available)
                      ▼
┌────────────────────────────────────────────────┐
│    Cloud Database (MySQL)                      │
│  ├─ users (id, openid, nickname, ...)        │
│  ├─ habits (id, user_id, name, icon, ...)    │
│  ├─ check_ins (id, habit_id, check_date, ...) │
│  └─ indices & relationships                  │
└────────────────────────────────────────────────┘
```

### 4.2 核心数据结构详解

#### Habit (习惯对象)

```javascript
const habitExample = {
  id: "habit_abc123def456",
  userId: "user_xyz789",
  name: "早起",
  icon: "🌅",
  color: "#FF6B6B",
  reminder: true,
  frequency: "daily",           // 'daily'|'weekday'|'weekend'|'custom'
  streak: 5,                    // 当前连续天数
  maxStreak: 15,                // 历史最大连续
  totalCheckIns: 42,            // 总打卡次数
  isActive: true,               // 未被删除
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-20T08:45:00Z"
}
```

**Streak 计算逻辑**:
- 从今天或昨天开始向后统计连续的打卡天数
- 中断任意一天则重置为0
- maxStreak记录历史最高值

#### CheckIns (打卡记录)

```javascript
// 嵌套结构: habitId → date → boolean
const checkInsExample = {
  "habit_abc123": {
    "2024-01-15": true,
    "2024-01-16": false,
    "2024-01-17": true,
    "2024-01-18": true,
    "2024-01-19": true
    // 当前streak = 3 (最后3天连续)
  },
  "habit_xyz789": {
    "2024-01-17": true,
    "2024-01-18": false,
    "2024-01-19": true
    // 当前streak = 1
  }
}
```

**为什么这样设计**:
- 快速查询: O(1) 查找某个习惯的某天打卡状态
- 紧凑存储: 非常适合压缩, 减少存储空间
- 易于遍历: 计算streak时遍历date数组

#### Statistics (统计数据)

```javascript
const statsExample = {
  totalCheckIns: 120,           // 所有习惯的打卡总数
  avgStreak: 8,                 // 所有活跃习惯的平均streak
  todayProgress: 3,             // 今天已完成的习惯数
  todayTotal: 5,                // 今天应完成的习惯数 (活跃+符合频率)
  bestStreak: 30,               // 全局最佳连续记录
  habits: [                      // 习惯级统计
    {
      habitId: "habit_abc123",
      name: "早起",
      checkInCount: 42,
      currentStreak: 5,
      lastCheckDate: "2024-01-19"
    }
  ]
}
```

### 4.3 缓存策略

```
┌─────────────────────────────────────────────┐
│         缓存读写策略                         │
├─────────────────────────────────────────────┤
│                                             │
│  读操作 (getHabits):                        │
│  1. 检查useApi flag                        │
│  2. 是 → try API, catch → 使用本地        │
│  3. 否 → 直接使用本地缓存                  │
│                                             │
│  写操作 (createHabit):                      │
│  1. 立即写入本地 (同步)                    │
│  2. 立即返回给UI (乐观更新)                │
│  3. 后台调用API同步 (异步)                 │
│  4. API失败 → 记录, 等待重试              │
│                                             │
│  同步策略:                                  │
│  - API成功 → updateLocalCache()            │
│  - API失败 → 保持本地数据不变              │
│  - 启动时 → 检查本地vs服务端的差异         │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.4 存储容量分析

```
假设用户有 50个习惯, 使用1年:

habits数组: 50 × 300bytes ≈ 15KB
checkIns嵌套对象: 
  - 50个习惯 
  - 365天数据
  - 每个entry: boolean ≈ 1 byte
  - 总计: ~18KB

userInfo, userId等: ~1KB

总计: ~34KB (远小于10MB限制)

即使100个习惯×2年: ~136KB 仍然很小
```

**结论**: wx.storage容量充足, 无需压缩或分片存储

---

## 页面架构分析

### 5.1 页面结构树

```
app.js (应用层)
  ├─ 初始化云环境
  ├─ 尝试登录 (tryLogin)
  ├─ 注册生命周期钩子
  └─ globalData: { userId, openid, ... }

pages/
  │
  ├─ index/ (今日仪表板)
  │  ├─ onLoad: 加载今日习惯
  │  ├─ onShow: 检查提醒
  │  ├─ onPullDownRefresh: 手刷新
  │  ├─ checkIn(habitId): 打卡结果
  │  └─ template:
  │     └─ 习惯列表 (已打卡/未打卡 UI)
  │
  ├─ habit/ (习惯列表管理)
  │  ├─ onLoad: 加载所有习惯
  │  ├─ filter: all/active/archived
  │  ├─ actions: create/edit/delete
  │  └─ edit/  (子页面)
  │     ├─ 创建或编辑习惯
  │     ├─ 图标选择器 (16个emoji)
  │     ├─ 颜色选择器 (8种颜色)
  │     └─ 频率设置
  │
  ├─ stats/ (统计分析)
  │  ├─ 月度日历视图
  │  ├─ 月份导航
  │  ├─ 每日打卡热力图
  │  └─ 汇总统计数据
  │
  └─ profile/ (个人中心)
     ├─ 用户信息显示
     ├─ 统计摘要卡片
     ├─ 提醒订阅开关
     └─ 登出功能

styles/
  └─ common.wxss (全局样式)

utils/
  ├─ api.js (网络层)
  ├─ storage.js (存储层)
  └─ util.js (工具函数)
```

### 5.2 页面之间的数据流

```
首页 (index)
  │获取
  ├─→ 今日习惯列表
  ├─→ 今日提醒状态
  └─→ 今日成就进度
     │打卡/撤销
     └─→ storage.checkIn / uncheckIn
           └─→ 更新本地 + 后台API同步

习惯列表 (habit)
  │获取
  ├─→ 所有习惯+过滤
  └─→ 创建/编辑/删除导航
     │操作
     └─→ 编辑页面 (edit)
           ├─ 创建新习惯
           ├─ 修改现有习惯
           └─ 删除习惯
              └─→ storage.updateHabit
                  └─→ 更新本地 + API同步

统计页面 (stats)
  │获取
  ├─→ 月度打卡数据
  ├─→ 聚合统计
  └─→ 趋势图表
     └─→ storage.getStatistics

个人页 (profile)
  │获取
  ├─→ 用户信息
  ├─→ 统计摘要
  └─→ 设置项
```

### 5.3 用户交互流程

#### 打卡流程

```
用户点击"完成" → index.checkIn(habitId)
  │
  ├─ 1. 立即更新UI (setData)
  ├─ 2. storage.checkIn(habitId)
  │    ├─ checkIns[habitId][today] = true
  │    ├─ wx.setStorageSync('checkIns', checkIns)
  │    └─ 更新streak和maxStreak
  │
  ├─ 3. 显示成功提示 (wx.showToast)
  │
  ├─ 4. 后台触发 api.checkIn()
  │    ├─ 发起网络请求
  │    ├─ 成功 → 更新本地缓存(已最新)
  │    └─ 失败 → 记录日志(本地数据仍有效)
  │
  └─ 5. 刷新统计数据
```

#### 创建习惯流程

```
用户点击"新建" → 导航到 edit 页面
  │
  ├─ 用户填写信息:
  │  ├─ 习惯名称
  │  ├─ 选择图标 (emoji弹窗)
  │  ├─ 选择颜色 (调色板)
  │  └─ 设置频率
  │
  ├─ 用户点击"保存" → createHabit()
  │  ├─ 1. 验证名称 (非空, 长度)
  │  ├─ 2. storage.createHabit(habitData)
  │  │    ├─ 生成 id = uuid()
  │  │    ├─ 初始化: streak=0, maxStreak=0, totalCheckIns=0
  │  │    ├─ wx.setStorageSync('habits', [...])
  │  │    └─ 更新 checkIns 嵌套对象
  │  │
  │  ├─ 3. 立即返回页面 (乐观更新)
  │  │
  │  └─ 4. 后台 api.createHabit()
  │       ├─ 发送到服务端
  │       ├─ 服务端插入数据库
  │       └─ 返回id (如果本地生成的id不同则更新)
  │
  └─ 返回habit列表, 新习惯已显示
```

---

## 数据流分析

### 6.1 应用初始化流程

```
App.onLaunch()
  │
  ├─ 1. wx.cloud.init({env: 'prod-1gjkl9vyaa17d3a2'})
  │      └─ 初始化微信云开发环境
  │
  ├─ 2. 检查首次启动
  │    ├─ 是: 初始化空数据结构
  │    │      ├─ habits = []
  │    │      ├─ checkIns = {}
  │    │      └─ wx.setStorageSync('habits', [])
  │    │
  │    └─ 否: 从本地读取已有数据
  │
  ├─ 3. tryLogin()
  │    ├─ wx.login() → code
  │    ├─ api.loginWithCode(code)
  │    ├─ 保存 userId, openid
  │    ├─ 成功 → setUseApi(true)
  │    └─ 失败 → setUseApi(false) + 提示用户
  │
  ├─ 4. 注册页面事件
  │    └─ onShow, onHide, onRouteEnd
  │
  └─ 5. 应用就绪
       └─ 页面可以调用 storage.*
```

### 6.2 网络请求与缓存同步流程

```
┌─────────────────────────────────────────────────────┐
│          典型的数据读取流程                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  页面.onShow() → storage.getHabits()               │
│  │                                                 │
│  ├─ 1. 同步读取本地缓存                            │
│  │    let cached = wx.getStorageSync('habits')    │
│  │    Page.setData({habits: cached})              │
│  │    ✅ UI立即更新 (毫秒级)                       │
│  │                                                 │
│  ├─ 2. 异步触发API请求                            │
│  │    if (useApi) {                               │
│  │      api.getHabits()                           │
│  │    }                                            │
│  │                                                 │
│  ├─ 3. 网络响应                                    │
│  │    ├─ 成功: updateLocalCache(newData)          │
│  │    │       Page.setData(newData) // 可选       │
│  │    │                                            │
│  │    └─ 失败: console.log('offline')             │
│  │            // 本地缓存已经显示, 不需要处理     │
│  │                                                 │
│  └─ 4. 事件结束, 用户看到最新数据(本地或网络)    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 6.3 离线到在线的自动恢复

```
用户操作 (网络不可用)
  │
  ├─ storage 操作成功 (本地缓存更新)
  ├─ UI立即响应 (用户感知不到离线)
  ├─ useApi = false (标记为离线)
  │
  ├─ [用户继续操作...]
  │
  ├─ [网络恢复]
  │
  ├─ 下次调用 storage.xxx()
  │  └─ if (useApi === false) {
  │      try api request
  │      if success → useApi = true ✅
  │    }
  │
  └─ 从此恢复在线模式
```

---

## 技术栈评估

### 7.1 前端技术选型

| 技术 | 选择 | 评分 | 说明 |
|------|------|------|------|
| 基础框架 | WeChat Mini Program原生 | ⭐⭐⭐⭐⭐ | 无需额外依赖, 性能最优 |
| 编程语言 | JavaScript ES6+ | ⭐⭐⭐⭐ | 足够应对此规模, 无类型检查略弱 |
| 样式方案 | 原生WXSS | ⭐⭐⭐ | 功能简单但受限, 无需现代CSS |
| 状态管理 | Page.data + globalData | ⭐⭐⭐ | 中小型应用足够, 无需Redux |
| 存储方案 | wx.storage (同步API) | ⭐⭐⭐⭐ | 简单高效, 10MB容量充足 |

### 7.2 后端技术选型

| 技术 | 选择 | 评分 | 说明 |
|------|------|------|------|
| 云环境 | 微信云开发 | ⭐⭐⭐⭐⭐ | 原生集成, 自动认证和授权 |
| 容器化 | 云托管Container | ⭐⭐⭐⭐ | 自动扩展, 降低运维成本 |
| 框架 | Spring Boot | ⭐⭐⭐⭐ | 生态完善, 易于维护 |
| 数据库 | MySQL | ⭐⭐⭐⭐ | 关系型数据适合, 云托管自动备份 |
| 认证 | 微信OAuth | ⭐⭐⭐⭐⭐ | 用户使用微信直接登录, 安全可靠 |

### 7.3 通信方案

| 方案 | 选择 | 评分 | 说明 |
|------|------|------|------|
| 接口格式 | RESTful + JSON | ⭐⭐⭐⭐ | 标准化, 易于维护 |
| 调用方式 | wx.cloud.callContainer | ⭐⭐⭐⭐⭐ | 微信原生, 自动HTTPS + 认证 |
| 响应格式 | 统一的 {code, message, data} | ⭐⭐⭐⭐ | 清晰的契约, 易于错误处理 |
| 错误处理 | 分层错误码 | ⭐⭐⭐ | 可进一步细化(网络 vs 业务) |

---

## 架构优势

### 8.1 用户体验优势

✅ **离线可用**
- 网络中断仍可打卡、查看数据
- 自动降级到本地缓存
- 网络恢复时无缝同步

✅ **响应速度快**
- 所有操作先读本地缓存
- UI毫秒级更新
- 网络请求不阻塞交互

✅ **自动恢复**
- 网络状态自动检测
- 无需用户手动刷新
- 智能切换在线/离线模式

### 8.2 开发维护优势

✅ **代码组织清晰**
- 页面层只关心UI和交互
- 存储层处理数据缓存和同步逻辑
- API层处理网络通信

✅ **容易调试**
- 错误处理分层
- 有明确的降级策略
- 可以精确定位问题

✅ **扩展性好**
- 添加新API只需在api.js和storage.js中增加
- 新页面可复用现有模块
- 修改数据结构对其他层影响小

### 8.3 成本优势

✅ **微信云原生**
- 无需额外服务器采购
- 自动扩展容量
- 包含认证和消息服务

✅ **简洁的技术栈**
- 无需复杂的状态管理库
- 无需编译工具链 (原生WXML)
- 开发者学习成本低

✅ **高可用性**
- 微信云托管自动备份
- 支持多可用区部署
- 自动故障转移

---

## 潜在风险与改进

### 9.1 现有风险分析

| 风险项 | 可能性 | 影响 | 缓解方案 |
|--------|--------|------|---------|
| **缓存一致性** | 中 | 中 | 启动时与服务端比对, 或设置缓存过期时间 |
| **大数据量性能** | 低 | 中 | 分页加载, 压缩oldData (100+习惯) |
| **并发操作冲突** | 低 | 高 | 加乐观锁或版本号, 或限制并发 |
| **本地数据损坏** | 极低 | 高 | 数据验证, 错误恢复逻辑 |
| **敏感信息泄露** | 低 | 高 | 敏感数据不本地存储, 认证令牌加密 |

### 9.2 推荐改进方案

#### 短期改进 (1-3个月)

```javascript
// 1. 添加缓存过期机制
const CACHE_TTLS = {
  habits: 5 * 60 * 1000,        // 5分钟
  statistics: 10 * 60 * 1000,   // 10分钟
  userInfo: 1 * 60 * 60 * 1000  // 1小时
}

function isCacheExpired(key) {
  const timestamp = wx.getStorageSync(`${key}_timestamp`)
  return Date.now() - timestamp > CACHE_TTLS[key]
}

// 2. 添加数据验证
function validateHabit(habit) {
  if (!habit.name || habit.name.length > 50) return false
  if (!['daily', 'weekday', 'weekend'].includes(habit.frequency)) return false
  if (!habit.icon.match(/^\p{Emoji_Presentation}$/u)) return false
  return true
}

// 3. 请求去重与防抖
const requestCache = {}
function debounceRequest(key, fn, delay = 300) {
  if (requestCache[key]) return requestCache[key]
  const promise = new Promise((resolve) => {
    setTimeout(() => {
      fn().then(resolve)
    }, delay)
  })
  requestCache[key] = promise
  setTimeout(() => delete requestCache[key], delay * 2)
  return promise
}

// 4. 升级错误处理
class NetworkError extends Error {
  constructor(msg) { super(msg); this.type = 'network' }
}
class ValidationError extends Error {
  constructor(msg) { super(msg); this.type = 'validation' }
}
class AuthError extends Error {
  constructor(msg) { super(msg); this.type = 'auth' }
}
```

#### 中期改进 (3-6个月)

```javascript
// 1. 离线操作队列
class SyncQueue {
  constructor() {
    this.queue = wx.getStorageSync('syncQueue') || []
  }
  
  addOperation(operation) {
    this.queue.push({
      id: uuid(),
      type: operation.type,
      data: operation.data,
      timestamp: Date.now(),
      retries: 0
    })
    this.save()
  }
  
  async processPending() {
    if (!useApi) return
    
    for (const op of this.queue) {
      try {
        await this.executeOperation(op)
        this.queue = this.queue.filter(o => o.id !== op.id)
        this.save()
      } catch (err) {
        op.retries++
        if (op.retries > 3) {
          this.queue = this.queue.filter(o => o.id !== op.id)
        }
        this.save()
        break  // 后续操作稍后重试
      }
    }
  }
  
  save() {
    wx.setStorageSync('syncQueue', this.queue)
  }
}

// 2. 数据冲突解决
function mergeHabitData(local, remote) {
  // 以更新时间为准
  if (new Date(remote.updatedAt) > new Date(local.updatedAt)) {
    return remote
  }
  
  // 检查关键字段冲突
  if (local.streak !== remote.streak) {
    console.warn('Streak conflict:', local.streak, 'vs', remote.streak)
    return {...local, streak: Math.max(local.streak, remote.streak)}
  }
  
  return local
}

// 3. 本地数据备份
function backupData() {
  const backup = {
    habits: wx.getStorageSync('habits'),
    checkIns: wx.getStorageSync('checkIns'),
    timestamp: Date.now()
  }
  wx.setStorageSync('dataBackup', backup)
}

function restoreFromBackup() {
  const backup = wx.getStorageSync('dataBackup')
  if (backup && Date.now() - backup.timestamp < 7 * 24 * 60 * 60 * 1000) {
    wx.setStorageSync('habits', backup.habits)
    wx.setStorageSync('checkIns', backup.checkIns)
    return true
  }
  return false
}
```

#### 长期改进 (6-12个月)

```javascript
// 1. 迁移到 TypeScript
// habits.ts
interface Habit {
  id: string
  name: string
  icon: string
  streak: number
  // ...
}

// 2. 添加单元测试框架
// test/storage.test.js
describe('Storage Module', () => {
  describe('checkIn', () => {
    it('should increment streak when checking in consecutively', () => {
      // ...
    })
  })
})

// 3. 构建性能监控
class PerformanceMonitor {
  recordAPICall(endpoint, duration, success) {
    // 上报到数据分析平台
  }
  
  recordPageLoad(pageName, duration) {
    // ...
  }
}

// 4. 功能扩展点预留
// - 社交功能 (分享, 对比)
// - 数据导出 (Excel, PDF)
// - 多设备同步
// - AI建议
```

### 9.3 安全性建议

```javascript
// 1. 输入验证
function sanitizeHabitName(name) {
  // 移除XSS风险字符
  return name.replace(/[<>\"']/g, '')
}

// 2. 敏感数据处理
// ❌ 不要存储:
//   - 密码
//   - 支付信息
//   - 完整的openid (用户id替代)

// ✅ 应该存储:
//   - userId (非敏感的用户标识)
//   - openid (但不在请求体中暴露)

// 3. API请求签名 (可选增强)
function signRequest(data, timestamp) {
  const signStr = data + timestamp + SECRET_KEY
  return sha256(signStr)
}

// 4. 客户端流量控制
class RateLimiter {
  constructor(max = 10, window = 60000) {
    this.max = max
    this.window = window
    this.requests = []
  }
  
  isAllowed() {
    const now = Date.now()
    this.requests = this.requests.filter(t => now - t < this.window)
    if (this.requests.length < this.max) {
      this.requests.push(now)
      return true
    }
    return false
  }
}
```

---

## 总体评估

### 架构评分

| 维度 | 得分 | 评阶 |
|------|------|------|
| 可用性 (Availability) | 9/10 | 优秀 |
| 可维护性 (Maintainability) | 8/10 | 很好 |
| 可扩展性 (Scalability) | 8/10 | 很好 |
| 性能 (Performance) | 9/10 | 优秀 |
| 安全性 (Security) | 8/10 | 很好 |
| 用户体验 (UX) | 9/10 | 优秀 |
| **综合评分** | **8.5/10** | **优秀** |

### 总体建议

✅ **现状评价**:
- 架构设计合理, 分层清晰
- 离线支持做得很好
- 代码组织易于维护

⚠️ **需要关注**:
- 缓存一致性需要更强的保证
- 大数据量场景需要优化
- 离线操作队列可以更完善
- 错误处理可以更细化

🚀 **下一步**:
1. 实施缓存过期机制
2. 添加数据验证层
3. 构建离线操作队列
4. 增加单元测试覆盖
5. 迁移到TypeScript (长期)

---

**文档完成时间**: 2026年4月2日  
**分析工具**: GitHub Copilot  
**版本**: 1.0
