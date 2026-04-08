# 域名映射修复指南

## 🔴 当前问题诊断

### 发现的问题

| 域名 | IP地址 | 状态码 | 问题 |
|------|--------|--------|------|
| **duyou.me** | 198.20.1.215 | 522 | 源服务器连接超时 |
| **duyou-me.pages.dev** | 198.20.1.217 | 200 | ✅ 正常工作 |

### 根本原因

`duyou.me` 的 A 记录指向了错误的IP地址 (198.20.1.215)，该地址无法正确响应。

## ✅ 修复方案

### 快速修复 (推荐自动脚本)

```bash
# 方案1: 使用自动修复脚本
node fix-dns.js

# 选择 [1=自动修复]
# 输入你的 Cloudflare API Token
# 脚本会自动修改DNS记录
```

### 手动修复步骤

**步骤 1-3: 登录和导航**

1. 访问 https://dash.cloudflare.com
2. 点击左上角菜单，选择 **duyou.me** 域名
3. 左侧菜单 → **DNS** → **Records**

**步骤 4-5: 编辑DNS记录**

4. 找到现有的记录:
   - 名称: **duyou.me** (或 @)
   - 类型: **A**
   - 内容: **198.20.1.215**
   
   点击编辑按钮

5. 修改为:
   ```
   Type:        CNAME (必须改为CNAME)
   Name:        duyou.me (保持不变)
   Content:     duyou-me.pages.dev (修改)
   TTL:         Auto (保持Auto)
   Proxied:     ON (打开 - 橙色云图标)
   ```

**步骤 6-8: 保存并验证**

6. 点击 **Save** 按钮
7. 等待 DNS 生效 (通常 1-5 分钟，最多 15 分钟)
8. 验证修复:

   ```bash
   # 方式A: 查看DNS是否生效
   dig duyou.me +short
   # 应该显示: duyou-me.pages.dev (或Cloudflare IP)
   
   # 方式B: 检查HTTP状态
   node check-domain-mapping.js
   # 应该显示:
   # duyou.me: 状态码 200 (不是 522)
   # CF-RAY: ✅ 有效
   ```

## ⚠️ 常见问题

### 问题1: "CNAME不允许在根域"

**解决**:
- Cloudflare 会自动启用 **CNAME FLATTENING**
- 或者改用 **ALIAS** 记录 (Cloudflare特有功能)
- 也可以在 Pages 设置中创建自定义域

### 问题2: DNS依然显示旧地址

**解决**:
```bash
# 清除本地DNS缓存 (Mac)
sudo dscacheutil -flushcache

# 或使用8.8.8.8查询 (绕过本地缓存)
dig @8.8.8.8 duyou.me +short
```

### 问题3: 修复后仍返回522

**可能原因**:
- DNS还未完全生效 (等待5-15分钟)
- Cloudflare SSL模式设置不当
- Pages部署有问题

**诊断步骤**:
```bash
# 1. 确认DNS已经生效
nslookup duyou.me

# 输出应该显示: duyou-me.pages.dev

# 2. 确认Pages正常
curl -v https://duyou-me.pages.dev
# 应该返回 200

# 3. 检查Cloudflare SSL设置
# Dashboard > SSL/TLS > 应该是 "Full" 或 "Full (Strict)"

# 4. 清除Cloudflare缓存
# Dashboard > Caching > Purge Cache > Purge Everything
```

### 问题4: 得到403或404错误

**可能原因**:
- Pages部署已删除或未部署
- Pages源代码有问题

**解决**:
```bash
# 检查Pages部署状态
# Dashboard > Pages > duyou-me-pages > 检查部署历史

# 重新部署
# 推送到GitHub → Pages自动部署
```

## 🔧 API Token 获取方式

### 创建新 Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 **"Create Token"**
3. 选择模板: **"Edit zone DNS"**
4. 权限:
   - Zone → DNS → Edit (必需)
5. 区域资源:
   - Include → Specific zone → duyou.me
6. 点击 **Continue to summary** → **Create Token**
7. 复制 Token 值

### 使用现有 Global API Token

1. https://dash.cloudflare.com/profile/api-tokens
2. 向下滚动找到 **"Global API Key"**（如果有）
3. 核实权限是否包含 DNS 编辑

## 📊 验证工具

项目中已创建了验证脚本:

```bash
# 1. 检查域名映射状态 (快速检查)
node check-domain-mapping.js

# 预期输出:
# duyou.me: 状态码 200 (应该不是 522)
# duyou-me.pages.dev: 状态码 200
# 两个域名的CF-RAY都存在

# 2. DNS诊断 + 修复建议
node diagnose-cloudflare.js

# 3. DNS快速修复 (自动或手动)
node fix-dns.js
```

## 📅 预期时间表

| 操作 | 时间 |
|------|------|
| 修改DNS记录 | 即时 |
| DNS全球生效 | 1-15 分钟 |
| 缓存刷新 | 5 分钟内 |
| 验证完成 | 20 分钟 |

## 🚀 修复完成后的验证

修复完成后，应该看到:

```bash
# dig 查询
$ dig duyou.me +short
duyou-me.pages.dev.

# HTTP状态
$ node check-domain-mapping.js
duyou.me: 状态码 200 ✅
duyou-me.pages.dev: 状态码 200 ✅

# 浏览器访问
https://duyou.me  → 应该正常加载 (不是 522 或502)
```

## 📝 完整命令参考

```bash
# 一键诊断
node diagnose-cloudflare.js

# 查看当前DNS
dig duyou.me +short
dig duyou.me +short CNAME
dig duyou.me +short A

# 对比两个域名
node check-domain-mapping.js

# 自动修复 (需要API Token)
node fix-dns.js

# 强制刷新本地DNS缓存 (仅Mac)
sudo dscacheutil -flushcache

# 用Google DNS查询 (绕过本地缓存)
dig @8.8.8.8 duyou.me +short
```

## 💡 最佳实践建议

1. **立即修复**: 使用 `fix-dns.js` 自动修复最快
2. **验证DNS**: 修改后等待5分钟再验证
3. **多源验证**: 用不同DNS服务器验证 (8.8.8.8, 1.1.1.1)
4. **定期检查**: 每个月运行一次 `check-domain-mapping.js`
5. **备份Token**: 安妥保管API Token，不要提交到Git

## ❓ 需要帮助

如果修复后仍有问题，收集以下信息:

1. `node check-domain-mapping.js` 的完整输出
2. `dig duyou.me +trace` 的输出 (查看DNS路径)
3. Cloudflare Dashboard > duyou.me > DNS 的截图
4. 错误页面的完整HTTP头 (使用 curl -v)

---

**最后更新**: 2026年4月3日  
**创建者**: GitHub Copilot
