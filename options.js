document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const notionApiKeyInput = document.getElementById('notion-api-key');
  const notionDatabaseIdInput = document.getElementById('notion-database-id');
  const saveButton = document.getElementById('save-button');
  const statusMessage = document.getElementById('status-message');
  const imgbbApiKeyInput = document.getElementById('imgbb-api-key');
  const imgurClientIdInput = document.getElementById('imgur-client-id');
  const imageServiceRadios = document.querySelectorAll('input[name="image-service"]');
  const imgbbSection = document.getElementById('imgbb-section');
  const imgurSection = document.getElementById('imgur-section');
  
  // 从存储中加载设置
  chrome.storage.sync.get(
    [
      'notionApiKey', 
      'notionDatabaseId', 
      'imgbbApiKey', 
      'imgurClientId',
      'imageService'
    ], 
    function(items) {
      if (items.notionApiKey) {
        notionApiKeyInput.value = items.notionApiKey;
      }
      
      if (items.notionDatabaseId) {
        notionDatabaseIdInput.value = items.notionDatabaseId;
      }
      
      if (items.imgbbApiKey) {
        imgbbApiKeyInput.value = items.imgbbApiKey;
      }
      
      if (items.imgurClientId) {
        imgurClientIdInput.value = items.imgurClientId;
      }
      
      // 设置图片服务选择
      if (items.imageService) {
        const radio = document.querySelector(`input[name="image-service"][value="${items.imageService}"]`);
        if (radio) {
          radio.checked = true;
          updateServiceSections(items.imageService);
        }
      } else {
        // 如果没有保存过设置，默认使用freeimage
        updateServiceSections('freeimage');
      }
    }
  );
  
  // 处理图片服务选择变化
  imageServiceRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        updateServiceSections(this.value);
      }
    });
  });
  
  // 更新服务相关部分的显示
  function updateServiceSections(service) {
    // 隐藏所有服务相关部分
    imgbbSection.style.display = 'none';
    imgurSection.style.display = 'none';
    
    // 显示选中的服务相关部分
    if (service === 'imgbb') {
      imgbbSection.style.display = 'block';
    } else if (service === 'imgur') {
      imgurSection.style.display = 'block';
    }
    // FreeImage不需要API密钥，所以不显示额外部分
  }
  
  // 保存设置
  saveButton.addEventListener('click', function() {
    const notionApiKey = notionApiKeyInput.value.trim();
    const notionDatabaseId = notionDatabaseIdInput.value.trim();
    const imgbbApiKey = imgbbApiKeyInput.value.trim();
    const imgurClientId = imgurClientIdInput.value.trim();
    const imageService = document.querySelector('input[name="image-service"]:checked').value;
    
    // 验证输入
    if (!notionApiKey) {
      showStatus('请输入Notion API密钥', 'error');
      return;
    }
    
    if (!notionDatabaseId) {
      showStatus('请输入Notion数据库ID', 'error');
      return;
    }
    
    // 根据选择的服务验证相应的API密钥
    if (imageService === 'imgbb' && !imgbbApiKey) {
      showStatus('请输入ImgBB API密钥', 'error');
      return;
    }
    
    if (imageService === 'imgur' && !imgurClientId) {
      showStatus('请输入Imgur Client ID', 'error');
      return;
    }
    
    // 保存到存储
    chrome.storage.sync.set(
      {
        notionApiKey: notionApiKey,
        notionDatabaseId: notionDatabaseId,
        imgbbApiKey: imgbbApiKey,
        imgurClientId: imgurClientId,
        imageService: imageService
      },
      function() {
        showStatus('设置已保存', 'success');
      }
    );
  });
  
  // 显示状态消息
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    
    // 3秒后清除消息
    setTimeout(function() {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }
}); 