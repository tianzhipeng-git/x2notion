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
    
    // 如果请求中包含分类，则添加到数据中
    if (request.category) {
      pageData.category = request.category;
    }
    
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
    
    // 如果请求中包含分类，则添加到数据中
    if (request.category) {
      selectionData.category = request.category;
    }
    
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
      content: tweetElement.querySelector('[data-testid="tweetText"]') ? 
        Array.from(tweetElement.querySelector('[data-testid="tweetText"]').childNodes)
          .map(node => node.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .replace(/ \n /g, '\n')
          .replace(/ \n/g, '\n')
          .replace(/\n /g, '\n')
          .trim() : 'No text content',
      html: tweetElement.outerHTML
    };
    
    // 如果请求中包含分类，则添加到数据中
    if (request.category) {
      tweetData.category = request.category;
    }
    
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

// 创建分类选择弹窗
function createCategoryDialog(categories, callback) {
  // 检查是否已经有弹窗存在，如果有则先移除
  const existingDialog = document.querySelector('.x2notion-category-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }
  
  // 移除已有的遮罩层
  const existingOverlay = document.querySelector('.x2notion-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // 创建弹窗
  const dialog = document.createElement('div');
  dialog.className = 'x2notion-category-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    padding: 16px;
    z-index: 10000;
    max-width: 300px;
    width: 100%;
    color: #333333;
  `;

  // 创建标题
  const title = document.createElement('h3');
  title.textContent = '选择分类';
  title.style.cssText = `
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 16px;
    color: #333333;
  `;

  // 添加分类选择列表
  const categoryList = document.createElement('div');
  categoryList.style.cssText = `
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 16px;
    color: #333333;
  `;

  // 添加分类选项
  categories.forEach(category => {
    const categoryOption = document.createElement('div');
    categoryOption.style.cssText = `
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      color: #333333;
    `;
    categoryOption.textContent = category;
    categoryOption.addEventListener('mouseover', function() {
      this.style.backgroundColor = '#f0f0f0';
    });
    categoryOption.addEventListener('mouseout', function() {
      this.style.backgroundColor = 'transparent';
    });
    categoryOption.addEventListener('click', function() {
      // 移除弹窗和遮罩层
      dialog.remove();
      overlay.remove();
      callback(category);
    });
    categoryList.appendChild(categoryOption);
  });

  // 添加取消按钮
  const cancelButton = document.createElement('button');
  cancelButton.textContent = '取消';
  cancelButton.style.cssText = `
    background-color: #f0f0f0;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 8px;
    color: #333333;
  `;
  cancelButton.addEventListener('click', function() {
    // 移除弹窗和遮罩层
    dialog.remove();
    overlay.remove();
    callback(null);
  });

  // 添加不选择分类按钮
  const skipButton = document.createElement('button');
  skipButton.textContent = '不使用分类';
  skipButton.style.cssText = `
    background-color: #e0e0e0;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    color: #333333;
  `;
  skipButton.addEventListener('click', function() {
    // 移除弹窗和遮罩层
    dialog.remove();
    overlay.remove();
    callback('');
  });

  // 添加按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
  `;
  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(skipButton);

  // 组装弹窗
  dialog.appendChild(title);
  dialog.appendChild(categoryList);
  dialog.appendChild(buttonContainer);

  // 添加背景蒙层
  const overlay = document.createElement('div');
  overlay.className = 'x2notion-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  `;
  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) {
      // 移除弹窗和遮罩层
      overlay.remove();
      dialog.remove();
      callback(null);
    }
  });

  // 添加到页面
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
}

// 修改处理推文保存到Notion的点击事件
async function handleTweetSaveToNotionClick(event, tweetElement) {
  event.preventDefault();
  event.stopPropagation();
  
  try {
    // 获取点击的按钮
    const button = event.currentTarget;
    
    // 更新按钮状态
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 4c-.8 0-1.5.7-1.5 1.5v5.2L7.3 7.4c-.6-.6-1.5-.6-2.1 0-.6.6-.6 1.5 0 2.1l5.6 5.6c.6.6 1.5.6 2.1 0l5.6-5.6c.6-.6.6-1.5 0-2.1-.6-.6-1.5-.6-2.1 0l-3.2 3.2V5.5c0-.8-.7-1.5-1.5-1.5z"></path>
      </svg>
      <span>Saving...</span>
    `;
    button.style.color = '#1DA1F2';
    button.disabled = true;
    
    // 提取推文元素内的图片数据
    const imageData = await extractImagesFromTweet(tweetElement);
    
    // 提取引用链接
    const quotedUrl = extractQuotedUrl(tweetElement);
    
    // 提取视频缩略图
    const videoThumbnail = await extractVideoThumbnail(tweetElement);
    
    // 获取发送者和发布日期
    const senderElement = tweetElement.querySelector('a[href*="/status/"] span');
    const sender = senderElement ? senderElement.textContent : '';
    
    // 从时间元素获取发布日期
    const timeElement = tweetElement.querySelector('time');
    const postDate = timeElement && timeElement.getAttribute('datetime') ? new Date(timeElement.getAttribute('datetime')).toISOString() : '';
    
    // 获取引用的推文内容
    const quotedContent = tweetElement.querySelector('[aria-labelledby]') || tweetElement.querySelector('[data-testid="card.wrapper"]');
    const quotedText = quotedContent ? quotedContent.textContent : '';
    
    // 将推文数据发送到后台脚本
    const tweetData = {
      title: tweetElement.querySelector('[data-testid="tweetText"]')?.innerText.substring(0, 25) || 'Tweet',
      url: tweetElement.querySelector('a[href*="/status/"]')?.href || window.location.href,
      content: tweetElement.querySelector('[data-testid="tweetText"]') ? 
        Array.from(tweetElement.querySelector('[data-testid="tweetText"]').childNodes)
          .map(node => node.textContent || '')
          .join(' '): 'No text content',
      html: tweetElement.outerHTML,
      imageData: imageData,
      quoted_url: quotedUrl,
      quoted_text: quotedText,
      video_thumbnail: videoThumbnail,
      sender: (tweetElement.querySelector('[data-testid="User-Name"]')?.innerText.split('@')[0] || '').substring(0, 15),
      post_date: postDate,
      save_date: new Date().toISOString()
    };
    console.log(tweetData)
    
    // 检查是否有分类配置
    chrome.storage.sync.get(['categories', 'categoryUsageTime'], async function(items) {
      let selectedCategory = null;
      
      if (items.categories && items.categories.trim()) {
        // 处理分类列表，去除空行和前后空格
        const categoryList = items.categories
          .split('\n')
          .map(cat => cat.trim())
          .filter(cat => cat.length > 0);
        
        if (categoryList.length > 0) {
          // 获取分类使用时间记录
          const categoryUsageTime = items.categoryUsageTime || {};
          
          // 按照最后使用时间对分类排序
          const sortedCategories = [...categoryList].sort((a, b) => {
            const timeA = categoryUsageTime[a] || 0;
            const timeB = categoryUsageTime[b] || 0;
            return timeB - timeA; // 降序排序，最近使用的在前面
          });
          
          // 显示分类选择弹窗
          selectedCategory = await new Promise(resolve => {
            createCategoryDialog(sortedCategories, category => {
              resolve(category);
            });
          });
          
          // 如果用户取消了选择，中止保存
          if (selectedCategory === null) {
            // 恢复按钮状态
            button.innerHTML = `
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path>
              </svg>
              <span>X2Notion</span>
            `;
            button.style.color = 'rgb(83, 100, 113)';
            button.disabled = false;
            return;
          }
          
          // 如果选择了分类，更新最后使用时间
          if (selectedCategory) {
            const newCategoryUsageTime = { ...categoryUsageTime };
            newCategoryUsageTime[selectedCategory] = Date.now();
            chrome.storage.sync.set({ categoryUsageTime: newCategoryUsageTime });
          }
        }
      }
      
      // 添加选中的分类到推文数据
      if (selectedCategory) {
        tweetData.category = selectedCategory;
      }
      
      // 发送数据到后台脚本
      chrome.runtime.sendMessage(
        {
          action: 'sendToNotion',
          data: tweetData,
          type: 'tweet'
        },
        function(response) {
          // 更新按钮状态
          if (response && response.success) {
            button.innerHTML = `
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M9 20c-.264 0-.52-.104-.707-.293l-4.785-4.785c-.39-.39-.39-1.023 0-1.414s1.023-.39 1.414 0l3.946 3.945L18.075 4.41c.32-.45.94-.558 1.395-.24.45.318.56.942.24 1.394L9.817 19.577c-.17.24-.438.395-.732.42-.028.002-.057.003-.085.003z"></path>
              </svg>
              <span>Saved</span>
            `;
            button.style.color = '#4CAF50';
            button.disabled = false;
          } else {
            button.innerHTML = `
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path>
              </svg>
              <span>Failed</span>
            `;
            button.style.color = '#FF5252';
            button.disabled = false;
            
            console.error('Failed to save tweet:', response ? response.error : 'Unknown error');
          }
        }
      );
    });
  } catch (error) {
    console.error('Error handling tweet save:', error);
    
    // 更新按钮状态为失败
    const button = event.currentTarget;
    button.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path>
      </svg>
      <span>Failed</span>
    `;
    button.style.color = '#FF5252';
    button.disabled = false;
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