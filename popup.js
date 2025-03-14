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

  // 保存整个页面
  capturePageButton.addEventListener('click', function() {
    statusMessage.textContent = 'Saving page...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {action: 'capturePage'},
        function(response) {
          if (response && response.success) {
            statusMessage.textContent = 'Page saved to Notion';
          } else {
            statusMessage.textContent = 'Save failed: ' + (response ? response.error : 'Unknown error');
          }
          console.log('capturePage response:', response);
        }
      );
    });
  });

  // 保存选中内容
  captureSelectionButton.addEventListener('click', function() {
    statusMessage.textContent = 'Saving selection...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {action: 'captureSelection'},
        function(response) {
          console.log('captureSelection response:', response);
          if (response && response.success) {
            statusMessage.textContent = 'Selection saved to Notion';
          } else {
            statusMessage.textContent = 'Save failed: ' + (response ? response.error : 'Unknown error');
          }
        }
      );
    });
  });

  // 打开设置页面
  openSettingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  if (chrome.runtime.lastError) {
    console.error('Chrome runtime error:', chrome.runtime.lastError.message);
  }
}); 