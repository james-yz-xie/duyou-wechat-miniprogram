#!/usr/bin/env node

/**
 * Cloudflare DNS 检查和修复工具
 * 检查duyou.me的DNS配置，识别问题，提供修复方案
 */

const { execSync } = require('child_process');
const https = require('https');

/**
 * 执行shell命令并返回结果
 */
function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' });
  } catch (err) {
    return null;
  }
}

/**
 * 获取DNS记录 (使用 nslookup)
 */
function getDNSRecords(domain) {
  console.log(`\n📋 检查DNS记录: ${domain}`);
  console.log('-'.repeat(60));

  const results = {
    A: null,
    AAAA: null,
    CNAME: null,
    MX: null,
    NS: null,
    TXT: null
  };

  // 使用 nslookup 查询
  for (const type of Object.keys(results)) {
    const cmd = `nslookup -type=${type} ${domain} 2>/dev/null`;
    const output = runCommand(cmd);
    
    if (output) {
      // 解析输出
      const lines = output.split('\n').filter(l => l.trim());
      const relevant = lines.filter(l => 
        !l.includes('Server:') && 
        !l.includes('Address:') &&
        l.includes(domain) || l.includes('canonical')
      );
      
      if (relevant.length > 0) {
        results[type] = relevant.join('\n    ');
      }
    }
  }

  // 输出结果
  for (const [type, value] of Object.entries(results)) {
    if (value) {
      console.log(`\n  ${type}:`);
      console.log(`    ${value}`);
    }
  }

  return results;
}

/**
 * 获取 DNS 权威服务器
 */
function getNameServers(domain) {
  console.log(`\n🔑 权威名称服务器: ${domain}`);
  console.log('-'.repeat(60));

  const cmd = `dig +short ns ${domain} 2>/dev/null`;
  const output = runCommand(cmd);

  if (output) {
    const servers = output.trim().split('\n').filter(s => s);
    servers.forEach(server => {
      console.log(`  ${server}`);
      
      // 检查是否是Cloudflare名称服务器
      if (server.includes('ns') && server.includes('cloudflare')) {
        console.log('    ✅ Cloudflare 管理的域名');
      }
    });
    return servers;
  }

  return [];
}

/**
 * 诊断域名问题
 */
function diagnoseDomain(domain) {
  console.log(`\n🔍 诊断 ${domain}`);
  console.log('='.repeat(60));

  const dnsRecords = getDNSRecords(domain);
  const nameServers = getNameServers(domain);

  return { dnsRecords, nameServers };
}

/**
 * 生成修复建议
 */
function generateFixSuggestions() {
  console.log('\n' + '='.repeat(60));
  console.log('💡 修复方案');
  console.log('='.repeat(60));

  console.log(`
✅ 方案A: 将 duyou.me 指向 Pages (推荐)

步骤1: 登录 Cloudflare Dashboard
  https://dash.cloudflare.com

步骤2: 选择 duyou.me 域名

步骤3: 进入 DNS 设置 (DNS > Records)

步骤4: 修改或创建记录:
  
  类型: CNAME
  名称: duyou.me (o @ 表示根域)
  内容: duyou-me.pages.dev
  TTL: Auto
  代理状态: Proxied (橙色云)
  
步骤5: 保存

⚠️  注意: Cloudflare 默认不允许在根域(@)创建CNAME
     解决办法:
       - 使用 CNAME FLATTENING (Cloudflare自动处理)
       - 或使用 ALIAS 记录 (等效于CNAME,Cloudflare特有)

================================================================================

✅ 方案B: 使用 Cloudflare Pages 提供的自定义域名指导

若在 Cloudflare Pages 中已配置 duyou.me:

步骤1: Pages 条目 > duyou-me-pages > 设置
步骤2: 自定义域 > 添加自定义域
步骤3: 输入 duyou.me
步骤4: Cloudflare 自动建议 DNS 记录
步骤5: 按提示完成 (通常自动创建)

================================================================================

✅ 方案C: 完整的 DNS 配置检查清单

当前问题分析:
1. duyou.me 返回 522 错误 → 源服务器未正确配置
2. duyou-me.pages.dev 正常运行 → Pages 部署正确

需要确认:
  ☐ duyou.me 的当前 DNS CNAME 指向哪里?
  ☐ 该目标是否在线?
  ☐ duyou.me 的源IP地址是什么?
  ☐ Cloudflare 是否处于 Full 或 Full(Strict) SSL 模式?

================================================================================

🔧 使用命令行快速修复 (仅参考)

如果使用 Cloudflare API,可以这样:

\`\`\`bash
# 需要 CLOUDFLARE_API_TOKEN 环境变量
curl -X PUT https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id} \\
  -H "Authorization: Bearer \$CLOUDFLARE_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "CNAME",
    "name": "duyou.me",
    "content": "duyou-me.pages.dev",
    "ttl": 1,
    "proxied": true
  }'
\`\`\`

================================================================================
  `);
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 Cloudflare DNS 诊断和修复工具');
  console.log('='.repeat(80));

  // 检查必要的命令
  console.log('\n⏳ 检查环境...');
  const hasDig = runCommand('which dig') !== null;
  const hasNslookup = runCommand('which nslookup') !== null;

  if (!hasDig && !hasNslookup) {
    console.log('⚠️  未找到 dig 或 nslookup 命令');
    console.log('   请先安装: brew install bind');
  } else {
    console.log('✅ DNS 工具可用');
  }

  // 诊断 duyou.me
  try {
    diagnoseDomain('duyou.me');
  } catch (err) {
    console.log(`\n❌ 诊断失败: ${err.message}`);
  }

  // 生成修复建议
  generateFixSuggestions();

  // 验证最后的状态
  console.log('\n' + '='.repeat(80));
  console.log('📍 最后验证 (修改后执行)');
  console.log('='.repeat(80));

  console.log(`
完成上述修改后,运行:

  # 检查DNS是否生效
  dig duyou.me +short

  # DNS 应该返回: duyou-me.pages.dev (或 Cloudflare IP)

  # 检查域名访问状态
  node check-domain-mapping.js

  # 应该看到:
  # duyou.me: 状态码 200 (而不是 522)
  # CF-RAY: 正常工作

================================================================================
注意: DNS 生效可能需要 5-15 分钟 (TTL 影响)
================================================================================
  `);
}

// 运行脚本
main();
