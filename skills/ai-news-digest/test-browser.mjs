import { chromium } from 'playwright';

async function testBrowser() {
  console.log('🌐 启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage();
    
    // 1. 访问量子位
    console.log('📰 访问量子位...');
    await page.goto('https://www.qbitai.com/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // 2. 获取文章列表（尝试多种选择器）
    console.log('📋 获取文章列表...');
    
    // 先截图看看页面结构
    await page.screenshot({ path: '/home/bruce/.openclaw/workspace/qbitai-screenshot.png' });
    console.log('📸 已截图保存到 qbitai-screenshot.png');
    
    // 尝试获取页面所有链接
    const allLinks = await page.$$eval('a', links => 
      links.filter(l => l.textContent.trim().length > 10).slice(0, 10).map(link => ({
        title: link.textContent.trim().slice(0, 50),
        href: link.href
      }))
    );
    console.log('\n页面所有链接（前10个）：');
    allLinks.forEach((a, i) => console.log(`${i + 1}. ${a.title} -> ${a.href.slice(0, 50)}`));
    
    // 使用找到的链接
    const articles = allLinks.slice(0, 5);
    
    console.log(`✅ 找到 ${articles.length} 篇文章`);
    console.log('\n文章列表：');
    articles.forEach((a, i) => console.log(`${i + 1}. ${a.title}`));
    
    // 3. 点击第一篇文章获取内容
    if (articles.length > 0) {
      console.log(`\n📝 访问第一篇文章: ${articles[0].title}`);
      await page.goto(articles[0].href, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 等待内容加载
      await page.waitForTimeout(2000);
      
      // 4. 提取文章内容
      const content = await page.evaluate(() => {
        // 尝试多种内容选择器
        const selectors = [
          '.article-content',
          '.post-content', 
          'article .content',
          '[class*="content"]',
          'main',
          'article'
        ];
        
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            // 移除不需要的元素
            const clone = el.cloneNode(true);
            clone.querySelectorAll('script, style, iframe, nav, footer, .related, .share, .comments').forEach(e => e.remove());
            const text = clone.innerText.trim();
            if (text.length > 200) {
              return text.slice(0, 800);
            }
          }
        }
        return '无法提取内容';
      });
      
      console.log('\n📄 文章内容预览（前800字）：');
      console.log(content);
      console.log('\n...(内容已截断)');
    }
    
    console.log(`✅ 找到 ${articles.length} 篇文章`);
    console.log('\n文章列表：');
    articles.forEach((a, i) => console.log(`${i + 1}. ${a.title}`));
    
    // 3. 点击第一篇文章获取内容
    if (articles.length > 0) {
      console.log(`\n📝 点击第一篇文章: ${articles[0].title}`);
      await page.goto(articles[0].href, { waitUntil: 'networkidle', timeout: 30000 });
      
      // 4. 提取文章内容
      const content = await page.$eval('.article-content, .post-content, article', el => {
        // 移除脚本和样式
        const clone = el.cloneNode(true);
        clone.querySelectorAll('script, style, iframe, nav, footer').forEach(e => e.remove());
        return clone.innerText.trim().slice(0, 1000);
      }).catch(() => '无法提取内容');
      
      console.log('\n📄 文章内容预览（前500字）：');
      console.log(content.slice(0, 500) + '...');
    }
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    console.log('🔒 关闭浏览器...');
    await browser.close();
  }
}

testBrowser();
