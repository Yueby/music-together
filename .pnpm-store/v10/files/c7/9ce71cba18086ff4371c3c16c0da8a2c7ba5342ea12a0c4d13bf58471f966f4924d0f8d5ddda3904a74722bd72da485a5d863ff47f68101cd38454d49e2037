// gdmusic.js - 音源模块
const axios = require('axios');
const logger = require('../src/logger');

/**
 * 通过gdmusic音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */
async function gdmusic(id) {
  try {
    const response = await axios.get(`https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${id}&br=999`);
    
    // gdmusic返回JSON格式，需要提取url字段
    if (response.data && typeof response.data === 'object' && response.data.url) {
      return response.data.url;
    }
    
    return null;
  } catch (error) {
    logger.error(`gdmusic error: ${error.message}`);
    return null;
  }
}

module.exports = gdmusic;