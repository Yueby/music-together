// msls.js - 音源模块
const axios = require('axios');
const logger = require('../src/logger');

/**
 * 通过msls音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */
async function msls(id) {
  try {
    // msls返回的是重定向，我们需要获取最终URL
    const response = await axios.get(`https://api.msls1441.com/?type=url&id=${id}`, {
      maxRedirects: 0,  // 不自动跟随重定向
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    // 检查是否有重定向
    if (response.headers.location) {
      return response.headers.location;
    }
    
    // 如果没有重定向头，可能返回的是JSON格式
    if (response.data && typeof response.data === 'object') {
      if (response.data.url) {
        return response.data.url;
      }
    }
    
    return null;
  } catch (error) {
    // 尝试另一种方式，允许重定向来获取最终URL
    try {
      const response = await axios.get(`https://api.msls1441.com/?type=url&id=${id}`);
      // 如果响应是字符串形式的URL
      if (typeof response.data === 'string' && response.data.startsWith('http')) {
        return response.data;
      }
      return null;
    } catch (e) {
      logger.error(`msls error: ${e.message}`);
      return null;
    }
  }
}

module.exports = msls;