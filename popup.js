document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const capturePageButton = document.getElementById('capture-page');
  const captureSelectionButton = document.getElementById('capture-selection');
  const openSettingsButton = document.getElementById('open-settings');
  const statusMessage = document.getElementById('status-message');

  // 保存整个页面
  capturePageButton.addEventListener('click', function() {
    statusMessage.textContent = '正在保存页面...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {action: 'capturePage'},
        function(response) {
          if (response && response.success) {
            statusMessage.textContent = '页面已保存到Notion';
          } else {
            statusMessage.textContent = '保存失败: ' + (response ? response.error : '未知错误');
          }
          console.log('capturePage response:', response);
        }
      );
    });
  });

  // 保存选中内容
  captureSelectionButton.addEventListener('click', function() {
    statusMessage.textContent = '正在保存选中内容...';
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {action: 'captureSelection'},
        function(response) {
          console.log('captureSelection response:', response);
          if (response && response.success) {
            statusMessage.textContent = '选中内容已保存到Notion';
          } else {
            statusMessage.textContent = '保存失败: ' + (response ? response.error : '未知错误');
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
    console.error('Chrome运行时错误:', chrome.runtime.lastError.message);
  }
}); 