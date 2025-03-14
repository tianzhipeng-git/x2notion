// 监听来自弹出窗口的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'capturePage') {
    // 获取整个页面内容
    const pageData = {
      title: document.title,
      url: window.location.href,
      content: document.body.innerText,
      html: document.documentElement.outerHTML
    };
    
    // 发送数据到后台脚本
    chrome.runtime.sendMessage(
      {
        action: 'sendToNotion',
        data: pageData,
        type: 'page'
      },
      function(response) {
        sendResponse(response);
      }
    );
    
    return true; // 保持消息通道开放，等待异步响应
  }
  
  else if (request.action === 'captureSelection') {
    // 获取用户选中的内容
    const selection = window.getSelection();
    const selectionText = selection.toString();
    
    if (!selectionText) {
      sendResponse({success: false, error: 'No content selected'});
      return;
    }
    
    // 创建一个临时元素来获取HTML
    const container = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    
    const selectionData = {
      title: document.title,
      url: window.location.href,
      content: selectionText,
      html: container.innerHTML
    };
    
    // 发送数据到后台脚本
    chrome.runtime.sendMessage(
      {
        action: 'sendToNotion',
        data: selectionData,
        type: 'selection'
      },
      function(response) {
        sendResponse(response);
      }
    );
    
    return true; // 保持消息通道开放，等待异步响应
  }
  
  else if (request.action === 'captureTweet') {
    // 获取推文内容
    const tweetElement = request.tweetElement;
    const tweetData = {
      title: 'Tweet - ' + document.title,
      url: window.location.href,
      content: tweetElement.textContent,
      html: tweetElement.outerHTML
    };
    
    // 发送数据到后台脚本
    chrome.runtime.sendMessage(
      {
        action: 'sendToNotion',
        data: tweetData,
        type: 'tweet'
      },
      function(response) {
        sendResponse(response);
      }
    );
    
    return true; // 保持消息通道开放，等待异步响应
  }
});

// 检查是否在Twitter页面
function isTwitterPage() {
  return window.location.hostname === 'twitter.com' || 
         window.location.hostname === 'x.com' || 
         window.location.hostname === 'www.twitter.com' || 
         window.location.hostname === 'www.x.com';
}

// 创建保存到Notion按钮
function createSaveToNotionButton() {
  const button = document.createElement('button');
  button.className = 'save-to-notion-btn';
  button.setAttribute('data-x2notion', 'true');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path>
    </svg>
    <span>X2Notion</span>
  `;
  button.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    background-color: transparent;
    border: none;
    color: rgb(83, 100, 113);
    font-size: 13px;
    padding: 0;
    cursor: pointer;
    margin-left: 16px;
  `;
  button.addEventListener('mouseover', function() {
    this.style.color = '#1DA1F2';
  });
  button.addEventListener('mouseout', function() {
    this.style.color = 'rgb(83, 100, 113)';
  });
  
  return button;
}

// 从推文中提取图片并转换为Base64
async function extractImagesFromTweet(tweetElement) {
  const imageElements = [];
  const imageData = [];
  
  // 查找所有图片元素
  const imgElements = tweetElement.querySelectorAll('img');
  const imgSrcMap = new Map(); // 用于存储已处理的图片URL
  
  imgElements.forEach(img => {
    const src = img.getAttribute('src');
    // 过滤掉头像和表情符号等小图片，只保留内容图片
    if (src && (src.includes('pbs.twimg.com/media/') || src.includes('pbs.twimg.com/card_img/'))) {
      // 获取原始图片URL（去除尺寸参数）
      const baseUrl = src.split('?')[0];
      
      // 检查是否已经添加过该图片的大图版本
      if (!imgSrcMap.has(baseUrl)) {
        // 获取高质量大图URL
        const highQualitySrc = src.includes('?') ? 
          `${baseUrl}?format=jpg&name=large` : 
          `${src}?format=jpg&name=large`;
        
        imageElements.push({type: 'img', element: img, src: highQualitySrc});
        imgSrcMap.set(baseUrl, true);
      }
    }
  });
  
  // 查找背景图片
  const elementsWithBgImage = tweetElement.querySelectorAll('[style*="background-image"]');
  elementsWithBgImage.forEach(element => {
    const style = element.getAttribute('style');
    if (style && style.includes('background-image')) {
      const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
      if (match && match[1] && (match[1].includes('pbs.twimg.com/media/') || match[1].includes('pbs.twimg.com/card_img/'))) {
        // 获取原始图片URL（去除尺寸参数）
        const baseUrl = match[1].split('?')[0];
        
        // 检查是否已经添加过该图片的大图版本
        if (!imgSrcMap.has(baseUrl)) {
          // 获取高质量大图URL
          const highQualitySrc = match[1].includes('?') ? 
            `${baseUrl}?format=jpg&name=large` : 
            `${match[1]}?format=jpg&name=large`;
          
          imageElements.push({type: 'bg', element: element, src: highQualitySrc});
          imgSrcMap.set(baseUrl, true);
        }
      }
    }
  });
  
  // 将图片元素转换为Base64数据
  for (let i = 0; i < imageElements.length; i++) {
    const element = imageElements[i];
    try {
      // 使用Promise来确保图片加载完成
      const dataURL = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 尝试解决跨域问题
        
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置canvas大小
            if (element.type === 'img') {
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
            } else {
              canvas.width = element.element.offsetWidth || 300;
              canvas.height = element.element.offsetHeight || 200;
            }
            
            // 将图片绘制到canvas上
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // 将canvas转换为Base64数据
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataURL);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = function() {
          reject(new Error('Image loading failed'));
        };
        
        img.src = element.src;
      });
      
      imageData.push({
        index: i,
        dataURL: dataURL,
        originalSrc: element.src
      });
    } catch (error) {
      console.error(`Converting image ${i + 1} failed:`, error);
      // 如果转换失败，我们仍然添加原始URL
      imageData.push({
        index: i,
        dataURL: null,
        originalSrc: element.src
      });
    }
  }
  
  return imageData;
}

function extractQuotedUrl(tweetElement) {
  // 查找引用外部的链接
  result = []
  const quotedLinks = tweetElement.querySelectorAll('a[href*="http"]');
  for (const link of quotedLinks) {
    // 排除当前推文的链接、图片链接和其他非引用链接
    console.log(link.href)
    if (link.getAttribute('role') === 'link' &&
        !link.closest('[data-testid="tweet-text-show-more-link"]') && 
        !link.closest('[data-testid="User-Name"]') &&
        !link.href.includes('pbs.twimg.com/media/') && 
        !link.href.includes('/analytics') && 
        !(link.href.includes('/status/') && link.href.includes('/photo/')) &&
        !link.href.includes('pbs.twimg.com/card_img/')) {
      result.push(link.href);
    }
  }

  // 去重处理
  return [...new Set(result)];
}

// 从推文中提取视频缩略图
async function extractVideoThumbnail(tweetElement) {
  // 查找视频元素
  const videoElements = tweetElement.querySelectorAll('video');
  if (videoElements.length === 0) {
    // 如果没有找到视频元素，尝试查找视频容器
    const videoContainers = tweetElement.querySelectorAll('[data-testid="videoPlayer"], [data-testid="videoComponent"]');
    if (videoContainers.length === 0) {
      return null; // 没有找到视频
    }
  }
  
  // 尝试查找视频的预览图（通常是poster属性或背景图）
  let thumbnailSrc = null;
  
  // 1. 检查视频元素的poster属性
  for (const video of videoElements) {
    const poster = video.getAttribute('poster');
    if (poster) {
      thumbnailSrc = poster;
      break;
    }
  }
  
  // 2. 如果没有找到poster，查找视频容器中的背景图片
  if (!thumbnailSrc) {
    const videoContainers = tweetElement.querySelectorAll('[data-testid="videoPlayer"], [data-testid="videoComponent"]');
    for (const container of videoContainers) {
      // 查找容器内的所有元素，寻找背景图
      const elementsWithBg = container.querySelectorAll('*');
      for (const element of elementsWithBg) {
        const style = element.getAttribute('style');
        if (style && style.includes('background-image')) {
          const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
          if (match && match[1]) {
            thumbnailSrc = match[1];
            break;
          }
        }
      }
      
      if (thumbnailSrc) break;
      
      // 查找容器内的图片元素（有些视频播放器使用img作为缩略图）
      const imgElements = container.querySelectorAll('img');
      for (const img of imgElements) {
        const src = img.getAttribute('src');
        if (src) {
          thumbnailSrc = src;
          break;
        }
      }
      
      if (thumbnailSrc) break;
    }
  }
  
  // 3. 如果仍然没有找到缩略图，尝试查找视频播放按钮附近的图片
  if (!thumbnailSrc) {
    const playButtons = tweetElement.querySelectorAll('[aria-label*="Play"], [aria-label*="play"], [role="button"][aria-label*="video"]');
    for (const button of playButtons) {
      // 查找按钮的父元素
      let parent = button.parentElement;
      for (let i = 0; i < 3 && parent; i++) { // 向上查找3层
        // 查找背景图
        const style = parent.getAttribute('style');
        if (style && style.includes('background-image')) {
          const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
          if (match && match[1]) {
            thumbnailSrc = match[1];
            break;
          }
        }
        
        // 查找图片元素
        const imgElements = parent.querySelectorAll('img');
        for (const img of imgElements) {
          const src = img.getAttribute('src');
          if (src) {
            thumbnailSrc = src;
            break;
          }
        }
        
        if (thumbnailSrc) break;
        parent = parent.parentElement;
      }
      
      if (thumbnailSrc) break;
    }
  }
  
  // 如果没有找到缩略图，返回null
  if (!thumbnailSrc) {
    return null;
  }
  
  // 处理缩略图URL，获取高质量版本
  let highQualitySrc = thumbnailSrc;
  if (thumbnailSrc.includes('pbs.twimg.com')) {
    const baseUrl = thumbnailSrc.split('?')[0];
    highQualitySrc = thumbnailSrc.includes('?') ? 
      `${baseUrl}?format=jpg&name=large` : 
      `${thumbnailSrc}?format=jpg&name=large`;
  }
  
  // 将缩略图转换为Base64
  try {
    const dataURL = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 尝试解决跨域问题
      
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 设置canvas大小
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          
          // 将图片绘制到canvas上
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // 将canvas转换为Base64数据
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = function() {
        reject(new Error('Video thumbnail loading failed'));
      };
      
      img.src = highQualitySrc;
    });
    
    return [{
      dataURL: dataURL,
      originalSrc: highQualitySrc
    }];
  } catch (error) {
    console.error('Converting video thumbnail failed:', error);
    // 如果转换失败，返回原始URL
    return {
      dataURL: null,
      originalSrc: highQualitySrc
    };
  }
}

// 处理保存推文到Notion的点击事件
async function handleTweetSaveToNotionClick(event, tweetElement) {
  event.preventDefault();
  event.stopPropagation();
  
  // 显示加载状态
  const button = event.currentTarget;
  const originalText = button.innerHTML;
  button.innerHTML = 'Saving...';
  button.disabled = true;
  
  try {
    // 提取推文中的图片并转换为Base64
    const imageData = await extractImagesFromTweet(tweetElement);
    const videoThumbnail = await extractVideoThumbnail(tweetElement);
    
    // 发送消息到内容脚本自身
    chrome.runtime.sendMessage(
      {
        action: 'sendToNotion',
        data: {
          title: tweetElement.querySelector('[data-testid="tweetText"]')?.innerText.substring(0, 25),
          sender: (tweetElement.querySelector('[data-testid="User-Name"]')?.innerText.split('@')[0] || '').substring(0, 15),
          url: tweetElement.querySelector('a[href*="/status/"]')?.href || window.location.href,
          post_date: tweetElement.querySelector('time')?.getAttribute('datetime'),
          save_date: new Date().toISOString(),
          content: tweetElement.querySelector('[data-testid="tweetText"]')?.innerText || 'No text content',
          html: tweetElement.outerHTML,
          imageData: imageData, // 直接传递Base64图片数据
          // 提取推文中的引用链接
          quoted_url: extractQuotedUrl(tweetElement),
          quoted_text: tweetElement.querySelectorAll('[data-testid="tweetText"]')[1]?.innerText || undefined,
          video_thumbnail: videoThumbnail
        },
        type: 'tweet'
      },
      function(response) {
        // 恢复按钮状态
        setTimeout(() => {
          button.innerHTML = originalText;
          button.disabled = false;
          
          // 显示结果
          if (response && response.success) {
            button.innerHTML = 'Saved ✓';
            setTimeout(() => {
              button.innerHTML = originalText;
            }, 2000);
          } else {
            button.innerHTML = 'Failed ✗';
            setTimeout(() => {
              button.innerHTML = originalText;
            }, 2000);
          }
        }, 1000);
      }
    );
  } catch (error) {
    console.error('Processing images failed:', error);
    button.innerHTML = 'Failed ✗';
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
    }, 2000);
  }
}

// 向推文添加保存按钮
function addSaveButtonToTweets() {
  if (!isTwitterPage()) return;
  
  // 查找所有推文
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  
  tweets.forEach(tweet => {
    // 检查是否已经处理过
    if (tweet.hasAttribute('data-x2notion-processed')) {
      return;
    }
    
    // 标记为已处理
    tweet.setAttribute('data-x2notion-processed', 'true');
    
    // 查找操作栏
    const actionBar = tweet.querySelector('[role="group"]');
    if (!actionBar) return;
    
    // 检查是否已经添加了按钮
    const existingButton = actionBar.querySelector('[data-x2notion="true"]');
    if (existingButton) return;
    
    // 创建按钮
    const saveButton = createSaveToNotionButton();
    
    // 添加点击事件
    saveButton.addEventListener('click', (event) => handleTweetSaveToNotionClick(event, tweet));
    
    // 添加按钮到操作栏
    actionBar.appendChild(saveButton);
  });
}

// 防抖函数，避免频繁调用
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// 监听DOM变化，处理动态加载的推文
function observeTwitterTimeline() {
  if (!isTwitterPage()) return;
  
  // 使用防抖处理，避免频繁调用
  const debouncedAddButtons = debounce(addSaveButtonToTweets, 300);
  
  // 创建一个观察器实例
  const observer = new MutationObserver((mutations) => {
    let shouldAddButtons = false;
    
    // 检查是否有新的推文添加
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否添加了推文或者推文的容器
            if (node.querySelector('article[data-testid="tweet"]') || 
                (node.tagName === 'ARTICLE' && node.getAttribute('data-testid') === 'tweet')) {
              shouldAddButtons = true;
              break;
            }
          }
        }
      }
      
      if (shouldAddButtons) break;
    }
    
    // 只有在检测到新推文时才添加按钮
    if (shouldAddButtons) {
      debouncedAddButtons();
    }
  });
  
  // 配置观察选项
  const config = { childList: true, subtree: true };
  
  // 开始观察
  observer.observe(document.body, config);
  
  // 初始处理
  addSaveButtonToTweets();
  
  // 定期检查，以防某些推文被漏掉
  setInterval(addSaveButtonToTweets, 3000);
}

// 页面加载完成后初始化
window.addEventListener('load', observeTwitterTimeline);

// 也在DOMContentLoaded时尝试初始化，以防load事件已经错过
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeTwitterTimeline);
} else {
  observeTwitterTimeline();
} 