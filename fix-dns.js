#!/usr/bin/env node

/**
 * Cloudflare DNS 快速修复脚本
 * 修复 duyou.me → duyou-me.pages.dev 的DNS映射
 */

const https = require('https');
const readline = require('readline');

/**
 * HTTP请求包装
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * 从用户输入获取信息
 */
function getUserInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 获取Zone ID (域名在Cloudflare中的标识)
 */
async function getZoneId(apiToken) {
  console.log('\n📍 获取 Zone ID...');

  const options = {
    hostname: 'api.cloudflare.com',
    path: '/client/v4/zones?name=duyou.me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.status !== 200) {
      console.log(`❌ API错误: ${response.status}`);
      console.log(`   响应: ${JSON.stringify(response.body)}`);
      return null;
    }

    const zones = response.body.result;
    if (!zones || zones.length === 0) {
      console.log('❌ 未找到 duyou.me 区域');
      return null;
    }

    const zoneId = zones[0].id;
    console.log(`✅ Zone ID: ${zoneId}`);
    return zoneId;
  } catch (err) {
    console.log(`❌ 请求失败: ${err.message}`);
    return null;
  }
}

/**
 * 获取DNS记录
 */
async function getDNSRecords(apiToken, zoneId) {
  console.log('\n📋 查询现有DNS记录...');

  const options = {
    hostname: 'api.cloudflare.com',
    path: `/client/v4/zones/${zoneId}/dns_records?name=duyou.me&type=A`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.status !== 200) {
      console.log(`❌ API错误: ${response.status}`);
      return null;
    }

    const records = response.body.result;
    if (!records || records.length === 0) {
      console.log('⚠️  未找到A记录');
      return null;
    }

    console.log(`✅ 找到 ${records.length} 条记录:`);
    records.forEach((record, idx) => {
      console.log(`   ${idx + 1}. 类型: ${record.type}`);
      console.log(`      名称: ${record.name}`);
      console.log(`      内容: ${record.content}`);
      console.log(`      ID: ${record.id}`);
      console.log(`      代理: ${record.proxied ? '✅ 已启用' : '❌ 未启用'}`);
    });

    return records;
  } catch (err) {
    console.log(`❌ 请求失败: ${err.message}`);
    return null;
  }
}

/**
 * 更新DNS记录为CNAME或ALIAS
 */
async function updateDNSRecord(apiToken, zoneId, recordId) {
  console.log('\n🔧 更新DNS记录...');

  // Cloudflare Pages - duyou-me.pages.dev 的IP
  const options = {
    hostname: 'api.cloudflare.com',
    path: `/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  };

  const data = {
    type: 'CNAME',
    name: 'duyou.me',
    content: 'duyou-me.pages.dev',
    ttl: 1,  // Auto
    proxied: true  // 启用Cloudflare代理
  };

  try {
    console.log(`  将修改为:`);
    console.log(`    类型: CNAME`);
    console.log(`    名称: duyou.me`);
    console.log(`    指向: duyou-me.pages.dev`);
    console.log(`    代理: ✅ 启用`);

    const response = await makeRequest(options, data);

    if (response.status === 200 && response.body.success) {
      console.log(`✅ DNS记录已更新!`);
      const record = response.body.result;
      console.log(`\n   修改后的记录:`);
      console.log(`   名称: ${record.name}`);
      console.log(`   内容: ${record.content}`);
      console.log(`   代理: ${record.proxied ? '✅ 启用' : '❌ 禁用'}`);
      return true;
    } else {
      console.log(`❌ 更新失败: ${response.status}`);
      console.log(`   错误: ${JSON.stringify(response.body)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ 请求失败: ${err.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 Cloudflare DNS 快速修复脚本');
  console.log('='.repeat(80));

  console.log('\n📊 当前状态:');
  console.log('  duyou.me → 198.20.1.215 (❌ 返回522错误)');
  console.log('  duyou-me.pages.dev → 198.20.1.217 (✅ 正常)');

  console.log('\n💡 解决方案: 修改 duyou.me 的 DNS 指向 duyou-me.pages.dev');

  console.log('\n📖 获取 API Token:');
  console.log('  1. 访问 https://dash.cloudflare.com/profile/api-tokens');
  console.log('  2. 创建 Token 或使用现有的 "Edit zone DNS" Token');
  console.log('  3. 需要权限: Zone DNS Edit');

  // 选择修复方式
  console.log('\n' + '='.repeat(80));
  const method = await getUserInput('\n选择方式 [1=自动修复/2=手动步骤]: ');

  if (method === '1') {
    // 自动修复
    const apiToken = await getUserInput('\n请输入 Cloudflare API Token: ');

    if (!apiToken || apiToken.length < 10) {
      console.log('❌ Token格式不正确');
      process.exit(1);
    }

    // 获取Zone ID
    const zoneId = await getZoneId(apiToken);
    if (!zoneId) process.exit(1);

    // 获取DNS记录
    const records = await getDNSRecords(apiToken, zoneId);
    if (!records || records.length === 0) process.exit(1);

    // 更新第一条记录
    const recordId = records[0].id;
    const success = await updateDNSRecord(apiToken, zoneId, recordId);

    if (success) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ DNS 修复完成!');
      console.log('='.repeat(80));
      console.log('\n⏳ 等待生效 (通常 1-5 分钟)...');
      console.log('\n验证命令:');
      console.log('  dig duyou.me +short');
      console.log('  # 应该显示: duyou-me.pages.dev');
      console.log('\n  node check-domain-mapping.js');
      console.log('  # 应该显示: duyou.me 状态码 200 (不是 522)');
    }
  } else {
    // 手动步骤
    console.log('\n' + '='.repeat(80));
    console.log('📝 手动修复步骤');
    console.log('='.repeat(80));

    console.log(`
1️⃣  登录 Cloudflare Dashboard
    https://dash.cloudflare.com

2️⃣  选择 duyou.me 域名

3️⃣  进入 DNS 设置 (左侧菜单 → DNS > Records)

4️⃣  找到名称为 "duyou.me" 的A记录 (198.20.1.215)
    点击编辑

5️⃣  修改为:
    
    类型:        CNAME (从 A 改为 CNAME)
    名称:        duyou.me (或 @)
    内容:        duyou-me.pages.dev
    TTL:         Auto (自动)
    代理状态:    Proxied (orange cloud - 橙色)

6️⃣  点击 Save 保存

7️⃣  等待 DNS 生效 (1-15 分钟)

8️⃣  验证:
    \`\`\`bash
    dig duyou.me +short
    # 应该显示: duyou-me.pages.dev
    
    node check-domain-mapping.js
    # 应该显示: duyou.me 正常 (200)
    \`\`\`

⚠️  如果遇到 "CNAME 不允许在根域" 的错误:
    - Cloudflare 会自动启用 CNAME FLATTENING
    - 或改用 Cloudflare Pages 的设置
    - 进入 Pages > duyou-me-pages > 自定义域 > 添加 duyou.me
    `);

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n💬 遇到问题?');
  console.log('  - 检查 API Token 权限 (Zone DNS Edit)');
  console.log('  - 确认 duyou.me 由你的 Cloudflare 账户管理');
  console.log('  - 查看 Cloudflare 状态页面: https://www.cloudflarestatus.com');

  console.log('\n' + '='.repeat(80) + '\n');
}

// 运行
main().catch(err => {
  console.error('❌ 脚本执行错误:', err);
  process.exit(1);
});
