#!/usr/bin/env node

/**
 * 域名映射检查工具
 * 对比 duyou.me 和 duyou-me.pages.dev 的响应头
 * 检查CF-RAY, SSL证书, 以及其他关键头信息
 */

const https = require('https');
const tls = require('tls');
const url = require('url');

const SITES = [
  { name: 'duyou.me', url: 'https://duyou.me' },
  { name: 'duyou-me.pages.dev', url: 'https://duyou-me.pages.dev' }
];

/**
 * 获取响应头和SSL证书信息
 */
async function getHeadersAndCert(site) {
  return new Promise((resolve, reject) => {
    const urlObj = url.parse(site.url);
    const hostname = urlObj.hostname;

    // 创建HTTPS请求获取响应头
    const req = https.get(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (checking domain mapping)'
      }
    }, (res) => {
      const headers = res.headers;
      
      // 获取SSL证书信息
      const cert = res.socket.getPeerCertificate();
      
      resolve({
        site: site.name,
        url: site.url,
        statusCode: res.statusCode,
        headers: headers,
        cert: cert
      });
    });

    req.on('error', reject);
    req.setTimeout(5000);
  });
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * 检查SSL证书有效期
 */
function checkSSLValidity(cert) {
  if (!cert || !cert.valid_from || !cert.valid_to) {
    return { status: '❌', message: '无法获取证书信息' };
  }

  const validFrom = new Date(cert.valid_from);
  const validTo = new Date(cert.valid_to);
  const now = new Date();
  const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

  if (now < validFrom) {
    return { status: '⚠️', message: `证书未生效 (生效于: ${formatDate(cert.valid_from)})` };
  }

  if (now > validTo) {
    return { status: '❌', message: `证书已过期 (过期于: ${formatDate(cert.valid_to)})` };
  }

  if (daysRemaining < 30) {
    return { status: '⚠️', message: `证书即将过期，剩余 ${daysRemaining} 天` };
  }

  return { status: '✅', message: `证书有效，剩余 ${daysRemaining} 天 (过期于: ${formatDate(cert.valid_to)})` };
}

/**
 * 打印结果
 */
function printResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 域名映射检查报告');
  console.log('='.repeat(80) + '\n');

  results.forEach((result, idx) => {
    console.log(`\n${idx + 1}. ${result.site.toUpperCase()}`);
    console.log('-'.repeat(80));

    // 基本信息
    console.log(`📍 URL: ${result.url}`);
    console.log(`📊 状态码: ${result.statusCode}`);

    // Cloudflare信息
    const cfRay = result.headers['cf-ray'];
    const cfServer = result.headers['cf-express-route'];
    const server = result.headers['server'];
    
    console.log('\n🌐 Cloudflare信息:');
    if (cfRay) {
      console.log(`  ✅ CF-RAY: ${cfRay}`);
    } else {
      console.log(`  ⚠️  CF-RAY: 未检测到 (可能未使用Cloudflare)`);
    }
    if (cfServer) {
      console.log(`  📦 Server: ${cfServer}`);
    }
    if (server) {
      console.log(`  🔧 Server Header: ${server}`);
    }

    // SSL证书信息
    const sslCheck = checkSSLValidity(result.cert);
    console.log('\n🔐 SSL证书:');
    console.log(`  ${sslCheck.status} ${sslCheck.message}`);
    
    if (result.cert && result.cert.subject) {
      console.log(`  📜 颁发者: ${result.cert.issuer?.O || 'N/A'}`);
      console.log(`  🏷️  主题: ${result.cert.subject?.CN || 'N/A'}`);
      console.log(`  📅 有效期: ${formatDate(result.cert.valid_from)} ~ ${formatDate(result.cert.valid_to)}`);
    }

    // 其他关键头
    console.log('\n📋 响应头摘要:');
    const importantHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'age',
      'x-powered-by',
      'cf-cache-status',
      'vary',
      'via'
    ];

    importantHeaders.forEach(headerName => {
      const value = result.headers[headerName];
      if (value) {
        console.log(`  ${headerName}: ${value}`);
      }
    });
  });

  // 对比分析
  console.log('\n' + '='.repeat(80));
  console.log('📊 对比分析');
  console.log('='.repeat(80) + '\n');

  const site1 = results[0];
  const site2 = results[1];

  const cf1 = site1.headers['cf-ray'] ? '✅ 有' : '❌ 无';
  const cf2 = site2.headers['cf-ray'] ? '✅ 有' : '❌ 无';

  console.log(`Cloudflare CF-RAY:\n  duyou.me: ${cf1}\n  duyou-me.pages.dev: ${cf2}`);

  if (site1.headers['cf-ray'] === site2.headers['cf-ray']) {
    console.log('\n⚠️  两个域名的CF-RAY相同，可能指向同一源服务器');
  } else if (site1.headers['cf-ray'] && site2.headers['cf-ray']) {
    console.log('\n✅ 两个域名都使用Cloudflare，具有不同的CF-RAY标识');
  }

  // 域名映射建议
  console.log('\n' + '-'.repeat(80));
  console.log('🔍 域名映射检查结果:');
  console.log('-'.repeat(80));

  if (site1.headers['cf-ray'] && site2.headers['cf-ray']) {
    // 检查是否相同
    if (site1.headers['cf-ray'].split('-')[1] === site2.headers['cf-ray'].split('-')[1]) {
      console.log('✅ 两个域名映射正确 - 都通过Cloudflare，指向相同的源服务器');
    } else {
      console.log('⚠️  两个域名使用Cloudflare但映射可能不同 - 请确认DNS配置');
    }
  } else if (site1.headers['cf-ray'] && !site2.headers['cf-ray']) {
    console.log('❌ duyou.me 使用Cloudflare，但duyou-me.pages.dev未使用');
    console.log('   → Pages域名应该自动通过Cloudflare，请检查Pages部署设置');
  } else if (!site1.headers['cf-ray'] && site2.headers['cf-ray']) {
    console.log('❌ duyou-me.pages.dev 使用Cloudflare，但duyou.me未使用');
    console.log('   → 请确认duyou.me的DNS设置是否正确指向Cloudflare');
  } else {
    console.log('❌ 两个域名都未检测到Cloudflare CF-RAY');
    console.log('   → 请检查DNS配置和Cloudflare设置');
  }

  // SSL证书检查
  console.log('\n' + '-'.repeat(80));
  const ssl1 = checkSSLValidity(site1.cert);
  const ssl2 = checkSSLValidity(site2.cert);

  if (ssl1.status === '✅' && ssl2.status === '✅') {
    console.log('✅ SSL证书检查通过 - 两个域名的证书都有效');
  } else {
    console.log('⚠️  SSL证书需要检查:');
    console.log(`  duyou.me: ${ssl1.status} ${ssl1.message}`);
    console.log(`  duyou-me.pages.dev: ${ssl2.status} ${ssl2.message}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * 主函数
 */
async function main() {
  console.log('⏳ 正在检查域名映射...\n');

  try {
    const results = [];

    for (const site of SITES) {
      try {
        console.log(`📡 正在检查 ${site.name}...`);
        const result = await getHeadersAndCert(site);
        results.push(result);
        console.log(`✅ ${site.name} 检查完成\n`);
      } catch (err) {
        console.error(`❌ ${site.name} 检查失败: ${err.message}\n`);
        results.push({
          site: site.name,
          url: site.url,
          error: err.message
        });
      }
    }

    printResults(results);
  } catch (err) {
    console.error('❌ 脚本执行错误:', err);
    process.exit(1);
  }
}

// 运行脚本
main();
