document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const capturePageButton = document.getElementById('capture-page');
  const captureSelectionButton = document.getElementById('capture-selection');
  const openSettingsButton = document.getElementById('open-settings');
  const statusMessage = document.getElementById('status-message');

  // 检查Notion API设置是否已配置
  chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId'], function(items) {
    if (!items.notionApiKey || !items.notionDatabaseId) {
      statusMessage.textContent = 'Please configure Notion API key and database ID in settings first';
      capturePageButton.disabled = true;
      captureSelectionButton.disabled = true;
    } else {
      statusMessage.textContent = 'Ready';
    }
  });

  // 创建分类选择弹窗的HTML元素
  function createCategorySelector(categories, callback) {
    // 清除之前的任何分类选择器
    const existingSelector = document.querySelector('.category-selector');
    if (existingSelector) {
      existingSelector.remove();
    }
    
    // 创建容器
    const container = document.createElement('div');
    container.className = 'category-selector';
    container.style.cssText = `
      margin-top: 15px;
      border-top: 1px solid #e0e0e0;
      padding-top: 15px;
      color: #333333;
    `;
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '选择分类';
    title.style.cssText = `
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #333333;
    `;
    container.appendChild(title);
    
    // 创建分类列表
    const list = document.createElement('div');
    list.style.cssText = `
      max-height: 150px;
      overflow-y: auto;
      margin-bottom: 10px;
      color: #333333;
    `;
    
    // 添加分类选项
    categories.forEach(category => {
      const option = document.createElement('div');
      option.textContent = category;
      option.style.cssText = `
        padding: 5px;
        cursor: pointer;
        border-radius: 3px;
        color: #333333;
      `;
      option.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#f0f0f0';
      });
      option.addEventListener('mouseout', function() {
        this.style.backgroundColor = 'transparent';
      });
      option.addEventListener('click', function() {
        callback(category);
        container.remove();
      });
      list.appendChild(option);
    });
    container.appendChild(list);
    
    // 创建不使用分类的按钮
    const skipButton = document.createElement('button');
    skipButton.textContent = '不使用分类';
    skipButton.style.cssText = `
      background-color: #f0f0f0;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      color: #333333;
    `;
    skipButton.addEventListener('click', function() {
      callback('');
      container.remove();
    });
    container.appendChild(skipButton);
    
    return container;
  }

  // 处理保存操作的函数
  function handleSave(action) {
    // 检查是否有分类设置
    chrome.storage.sync.get(['categories', 'categoryUsageTime'], function(items) {
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
          
          // 显示分类选择器
          const selector = createCategorySelector(sortedCategories, function(selectedCategory) {
            // 如果选择了分类，更新最后使用时间
            if (selectedCategory) {
              const newCategoryUsageTime = { ...categoryUsageTime };
              newCategoryUsageTime[selectedCategory] = Date.now();
              chrome.storage.sync.set({ categoryUsageTime: newCategoryUsageTime });
            }
            
            // 在选择分类后发送保存请求
            saveContent(action, selectedCategory);
          });
          
          document.querySelector('.container').appendChild(selector);
          return;
        }
      }
      
      // 如果没有分类设置或分类为空，直接保存
      saveContent(action, null);
    });
  }

  // 保存内容的函数
  function saveContent(action, category) {
    let actionText = action === 'capturePage' ? 'page' : 'selection';
    statusMessage.textContent = `Saving ${actionText}...`;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      // 创建消息对象
      const message = {
        action: action
      };
      
      // 如果有选择的分类，则添加到消息中
      if (category) {
        message.category = category;
      }
      
      chrome.tabs.sendMessage(
        tabs[0].id,
        message,
        function(response) {
          if (response && response.success) {
            statusMessage.textContent = `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} saved to Notion`;
          } else {
            statusMessage.textContent = 'Save failed: ' + (response ? response.error : 'Unknown error');
          }
          console.log(`${action} response:`, response);
        }
      );
    });
  }
  // // 保存整个页面
  // capturePageButton.addEventListener('click', function() {
  //   handleSave('capturePage');
  // });

  // // 保存选中内容
  // captureSelectionButton.addEventListener('click', function() {
  //   handleSave('captureSelection');
  // });

  // 打开设置页面
  openSettingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  if (chrome.runtime.lastError) {
    console.error('Chrome runtime error:', chrome.runtime.lastError.message);
  }
}); 