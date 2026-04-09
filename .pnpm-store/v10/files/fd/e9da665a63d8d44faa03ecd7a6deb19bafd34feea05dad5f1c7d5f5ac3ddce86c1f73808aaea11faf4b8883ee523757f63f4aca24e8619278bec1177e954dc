// toubiec.js - 音源模块
const axios = require('axios');
const logger = require('../src/logger');
const https = require('https');

/**
 * 通过toubiec音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */
async function toubiec(id) {
    try {
const response = await axios.post(`https://wyapi-eo.toubiec.cn/api/getSongUrl`, {
    id: id,
    level: 'lossless',
}, {
    headers: {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'connection': 'keep-alive',
        'content-type': 'application/json',
        'host': 'wyapi-eo.toubiec.cn',
        'origin': 'https://wyapi.toubiec.cn',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0'
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 10000
});

        if (response) {
            logger.info(response);
            return response.data.url;
        }

        return null;
    } catch (error) {
        logger.error(`toubiec error: ${error.message}`);
        return null;
    }
}

module.exports = toubiec;