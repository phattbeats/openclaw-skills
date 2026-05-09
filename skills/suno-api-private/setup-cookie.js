#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔧 Suno Cookie 和 JWT Token 配置助手\n');
console.log('请按照以下步骤操作：\n');
console.log('1. 打开浏览器访问: https://suno.com/create');
console.log('2. 登录你的账号');
console.log('3. 按 F12 打开开发者工具');
console.log('4. 切换到 Network 标签');
console.log('5. 在页面上点击输入框（触发 API 请求）');
console.log('6. 在 Network 里找到任意一个 studio-api.prod.suno.com 的请求');
console.log('7. 点击请求 → Headers → Request Headers\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('--------------------------------------------\n');

  const token = await question('请粘贴 Authorization header 的值（Bearer 后面的部分）:\n> ');

  if (!token || token.trim().length < 100) {
    console.log('\n❌ Token 无效（太短），请确保复制了完整的 JWT token');
    process.exit(1);
  }

  console.log('\n✅ JWT Token 已接收 (前50字符):', token.trim().substring(0, 50) + '...\n');

  const cookies = await question('请粘贴整个 Cookie header 的值:\n> ');

  if (!cookies || !cookies.includes('__client')) {
    console.log('\n❌ Cookies 无效，请确保包含 __client 等字段');
    process.exit(1);
  }

  console.log('\n✅ Cookies 已接收\n');

  // 解析 cookies
  const cookieParts = cookies.split(';').map(c => c.trim());

  // 确保 __session 使用 JWT token
  const filteredCookies = cookieParts.filter(c => !c.startsWith('__session='));
  filteredCookies.unshift(`__session=${token.trim()}`);

  const finalCookie = filteredCookies.join('; ');

  // 写入 .env
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const cookieRegex = /SUNO_COOKIE=.*/;
  if (cookieRegex.test(envContent)) {
    envContent = envContent.replace(cookieRegex, `SUNO_COOKIE=${finalCookie}`);
  } else {
    envContent = `SUNO_COOKIE=${finalCookie}\n` + envContent;
  }

  fs.writeFileSync(envPath, envContent);

  console.log('✅ 完成！已写入 .env 文件');
  console.log('🎉 现在可以运行: npm run dev\n');

  rl.close();
}

main().catch(error => {
  console.error('\n❌ 错误:', error.message);
  rl.close();
  process.exit(1);
});
