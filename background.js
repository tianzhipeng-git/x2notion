// 创建Notion页面的函数
async function createNotionPage(apiKey, databaseId, data, type) {
  const url = 'https://api.notion.com/v1/pages';
  
  // 构建Notion API请求体
  console.time('createNotionPage');
  const requestBody = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: data.title
            }
          }
        ]
      },
      URL: {
        url: data.url
      },
      Type: {
        rich_text: [
          {
            text: {
              content: type === 'page' ? '完整页面' : (type === 'tweet' ? '推文' : '选中内容')
            }
          }
        ]
      },
      // 添加发送者字段（如果存在）
      Sender: {
        rich_text: [
          {
            text: {
              content: data.sender || ''
            }
          }
        ]
      },
      // 添加发布日期字段（如果存在）
      PostDate: {
        date: data.post_date ? {
          start: data.post_date
        } : null
      },
      // 添加保存日期字段
      SaveDate: {
        date: {
          start: data.save_date || new Date().toISOString()
        }
      }
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: data.content && data.content.length > 2000 ? data.content.substring(0, 1996) + '...' : data.content
              }
            }
          ]
        }
      },
      // 如果有引用链接，添加引用链接块
      ...(data.quoted_url ? [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: '引用链接: '
              },
              annotations: {
                bold: true
              }
            },
            {
              type: 'text',
              text: {
                content: data.quoted_url,
                link: {
                  url: data.quoted_url
                }
              }
            }
          ]
        }
      }] : [])
    ]
  };
  
  // 发送请求到Notion API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || '未知错误');
  }
  console.timeEnd('createNotionPage');
  
  const pageData = await response.json();
  
  // 如果有图片数据，则处理图片
  if (data.imageData && data.imageData.length > 0) {
    try {
      await processAndAppendImages(apiKey, pageData.id, data.imageData);
    } catch (error) {
      console.error('处理图片失败:', error);
      // 即使图片处理失败，我们仍然返回页面数据
    }
  }
  
  return pageData;
}

// 根据用户配置选择图片上传服务
async function uploadImageWithSelectedService(imageData) {
  // 从存储中获取图片服务配置
  const items = await new Promise(resolve => {
    chrome.storage.sync.get(['imageService', 'imgbbApiKey', 'imgurClientId'], resolve);
  });
  
  const imageService = items.imageService || 'freeimage';
  
  console.log(`使用图片服务: ${imageService}`);
  
  // 根据选择的服务调用相应的上传函数
  switch (imageService) {
    case 'imgbb':
      return await uploadImageToImgBB(imageData);
    case 'postimages':
      return await uploadImageToPostImages(imageData);
    case 'imgur':
      return await uploadImageToImgur(imageData);
    case 'freeimage':
      return await uploadImageToFreeimage(imageData);
    default:
      throw new Error(`未知的图片服务: ${imageService}`);
  }
}

// 处理图片数据，将Base64或URL转换为Blob
async function prepareImageBlob(imageData) {
  // 如果是Base64数据
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    // 将Base64转换为Blob
    const response = await fetch(imageData);
    return await response.blob();
  } 
  // 如果是URL
  else if (typeof imageData === 'string') {
    // 获取图片内容
    const imageResponse = await fetch(imageData, {
      headers: {
        'Referer': 'https://twitter.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`无法获取图片: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    // 将图片转换为Blob
    return await imageResponse.blob();
  }
  
  throw new Error('不支持的图片数据格式');
}

// 将Base64图片上传到ImgBB
async function uploadImageToImgBB(base64Data) {
  try {
    // 从存储中获取ImgBB API密钥
    const items = await new Promise(resolve => {
      chrome.storage.sync.get(['imgbbApiKey'], resolve);
    });
    
    const imgbbApiKey = items.imgbbApiKey;
    
    if (!imgbbApiKey) {
      throw new Error('未设置ImgBB API密钥，请在扩展选项中设置');
    }
    
    // 准备图片数据
    const imageBlob = await prepareImageBlob(base64Data);
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('key', imgbbApiKey);
    
    // 上传到ImgBB
    const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传到ImgBB失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success) {
      throw new Error(`ImgBB上传失败: ${uploadResult.error?.message || '未知错误'}`);
    }
    
    // 返回新的图片URL
    return uploadResult.data.url;
  } catch (error) {
    console.error('上传图片失败:', error);
    return null;
  }
}

// 将Base64图片数据上传到PostImages
async function uploadImageToPostImages(base64Data) {
  try {
    // 准备图片数据
    const imageBlob = await prepareImageBlob(base64Data);
    
    // 创建FormData对象，模拟表单提交
    const formData = new FormData();
    formData.append('upload', imageBlob, `image_${Date.now()}.jpg`);
    formData.append('token', generateRandomString(32)); // 生成随机token
    formData.append('upload_session', generateRandomString(16)); // 生成随机会话ID
    formData.append('numfiles', '1');
    formData.append('gallery', 'null');
    formData.append('adult', 'no');
    formData.append('optsize', '0');
    
    // 发送请求到PostImages
    const uploadResponse = await fetch('https://postimages.org/json/rr', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://postimages.org/'
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传到PostImages失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.url) {
      throw new Error('PostImages上传失败: 未返回有效的图片URL');
    }
    
    // 返回直接图片URL
    return uploadResult.url;
  } catch (error) {
    console.error('上传图片到PostImages失败:', error);
    
    // 如果PostImages上传失败，尝试使用备用服务
    try {
      console.log('尝试使用备用上传服务...');
      return await uploadImageToFreeimage(base64Data);
    } catch (backupError) {
      console.error('备用上传服务也失败:', backupError);
      return null;
    }
  }
}

// 将Base64图片数据上传到freeimage
async function uploadImageToFreeimage(base64Data) {
  try {
    // 准备图片数据
    const blob = await prepareImageBlob(base64Data);
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('source', blob);
    formData.append('type', 'file');
    
    // 使用免费图片托管服务freeimage.host (imgbb的替代服务)
    const uploadResponse = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传到freeimage.host失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success || !uploadResult.image) {
      throw new Error('freeimage.host上传失败: ' + (uploadResult.error || '未返回有效的图片URL'));
    }
    
    // 返回新的图片URL
    return uploadResult.image.url;
  } catch (error) {
    console.error('备用上传方法失败:', error);
    
    // 如果备用方法也失败，尝试使用另一个免费服务
    try {
      return await uploadImageToImgur(base64Data);
    } catch (imgurError) {
      console.error('Imgur上传也失败:', imgurError);
      throw error; // 抛出原始错误
    }
  }
}

// 生成随机字符串
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// 将Base64图片数据上传到Imgur
async function uploadImageToImgur(base64Data) {
  try {
    // 从存储中获取Imgur Client ID
    const items = await new Promise(resolve => {
      chrome.storage.sync.get(['imgurClientId'], resolve);
    });
    
    const imgurClientId = items.imgurClientId;
    
    if (!imgurClientId) {
      throw new Error('未设置Imgur Client ID，请在扩展选项中设置');
    }
    
    // 准备上传数据
    let imageData;
    
    // 如果是Base64数据
    if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
      // 移除"data:image/jpeg;base64,"前缀
      imageData = base64Data.split(',')[1];
    } 
    // 如果是URL
    else if (typeof base64Data === 'string') {
      const blob = await prepareImageBlob(base64Data);
      
      // 将图片转换为Base64
      const reader = new FileReader();
      imageData = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    
    // 上传到Imgur
    const uploadResponse = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${imgurClientId}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData,
        type: 'base64'
      })
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`上传到Imgur失败: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success) {
      throw new Error(`Imgur上传失败: ${uploadResult.data?.error || '未知错误'}`);
    }
    
    // 返回新的图片URL
    return uploadResult.data.link;
  } catch (error) {
    console.error('上传图片到Imgur失败:', error);
    return null;
  }
}

// 处理并添加图片到Notion页面
async function processAndAppendImages(apiKey, pageId, imageData) {
  const url = `https://api.notion.com/v1/blocks/${pageId}/children`;
  
  // 添加标题
  const blocks = [
  ];
  
  // 处理每个图片
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < imageData.length; i++) {
    const imgData = imageData[i];
    console.log(`处理图片 ${i + 1}/${imageData.length}`);
    
    try {
      // 使用选择的服务上传图片
      const dataToUpload = imgData.dataURL || imgData.originalSrc;
      const newImageUrl = await uploadImageWithSelectedService(dataToUpload);
      
      if (newImageUrl) {
        console.log(`上传图片成功: ${newImageUrl}`);
        // 如果上传成功，添加图片块
        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: {
              url: newImageUrl
            }
          }
        });
        successCount++;
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error(`处理图片 ${i + 1} 失败:`, error);
      // 如果上传失败，添加文本块
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `图片 ${i + 1}: 处理失败。`
              }
            }
          ]
        }
      });
      failCount++;
    }
  }
  
  // 添加处理结果摘要
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: `图片处理结果: 成功 ${successCount} 张，失败 ${failCount} 张`
          }
        }
      ]
    }
  });
  
  // 发送请求到Notion API
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      children: blocks
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error('添加图片失败: ' + (errorData.message || '未知错误'));
  }
  
  return await response.json();
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveSelectionToNotion',
    title: '保存选中内容到Notion',
    contexts: ['selection']
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveSelectionToNotion') {
    chrome.tabs.sendMessage(
      tab.id,
      {action: 'captureSelection'},
      function(response) {
        if (response && response.success) {
          // 显示成功通知
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'X2Notion',
            message: '选中内容已保存到Notion'
          });
        } else {
          // 显示错误通知
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'X2Notion',
            message: '保存失败: ' + (response ? response.error : '未知错误')
          });
        }
      }
    );
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'sendToNotion') {
    // 从存储中获取Notion API密钥和数据库ID
    chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId', 'imgbbApiKey'], function(items) {
      const apiKey = items.notionApiKey;
      const databaseId = items.notionDatabaseId;
      
      if (!apiKey || !databaseId) {
        sendResponse({
          success: false, 
          error: '请先在设置中配置Notion API密钥和数据库ID'
        });
        return;
      }
      
      // 准备发送到Notion的数据
      const data = request.data;
      const pageType = request.type;
      
      // 创建Notion页面
      createNotionPage(apiKey, databaseId, data, pageType)
        .then(result => {
          sendResponse({success: true});
        })
        .catch(error => {
          console.error('发送到Notion失败:', error);
          sendResponse({
            success: false, 
            error: '发送到Notion失败: ' + error.message
          });
        });
    });
    
    return true; // 保持消息通道开放，等待异步响应
  }
});