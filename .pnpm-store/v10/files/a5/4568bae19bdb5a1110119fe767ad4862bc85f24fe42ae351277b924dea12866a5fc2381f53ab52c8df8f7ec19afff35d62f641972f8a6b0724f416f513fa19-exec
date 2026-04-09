#!/usr/bin/env node

const express = require('express');
const { matchID } = require('./src/match');
const logger = require('./src/logger');

// 创建Express应用
const app = express();

// 中间件
app.use(express.json());

// 静态文件服务
app.use(express.static('public'));

// 读取package.json获取版本号
const packageJson = require('./package.json');

// 内部API路由
app.get('/inner/modules', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  try {
    const modulesPath = path.join(__dirname, 'modules');
    const files = fs.readdirSync(modulesPath);
    const modules = files
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));
    
    res.json({
      code: 200,
      data: {
        modules: modules
      }
    });
  } catch (error) {
    res.json({
      code: 500,
      data: {
        modules: []
      },
      message: error.message
    });
  }
});

app.get('/inner/version', (req, res) => {
  res.json({
    code: 200,
    data: {
      version: packageJson.version
    }
  });
});

app.get('/match', async (req, res) => {
  const id = req.query.id;
  const source = req.query.source;

  if (!id) {
    return res.json({
      code: 400,
      message: 'Missing id parameter',
      data: null
    });
  }

  try {
    const result = await matchID(id, source);
    res.json(result);
  } catch (error) {
    res.json({
      code: 500,
      message: error.message,
      data: null
    });
  }
});

app.post('/match', async (req, res) => {
  const id = req.body.id || req.query.id;
  const source = req.body.source || req.query.source;

  if (!id) {
    return res.json({
      code: 400,
      message: 'Missing id parameter',
      data: null
    });
  }

  try {
    const result = await matchID(id, source);
    res.json(result);
  } catch (error) {
    res.json({
      code: 500,
      message: error.message,
      data: null
    });
  }
});

// 根路径
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 导出Express app 作为默认导出(Vercel需要)
module.exports = app;

// 导出matchID函数供直接调用
module.exports.matchID = matchID;

// 如果是直接运行此文件，则启动服务器
if (require.main === module) {
  // 解析命令行参数
  const args = process.argv.slice(2);
  
  // 如果有 --help 或 -h 参数，显示帮助信息
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
unblockmusic-utils - 解锁网易云音乐内容的API服务

用法:
  npx . [选项]

选项:
  --port, -p <端口号>  指定服务器端口 (默认: 3000)
  --help, -h          显示此帮助信息

示例:
  npx .               # 使用默认端口3000启动
  npx . --port 8080   # 使用端口8080启动
    `);
    process.exit(0);
  }
  
  // 从命令行参数或环境变量获取端口
  let PORT = process.env.PORT || 3000;
  const portArgIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
  if (portArgIndex !== -1 && args[portArgIndex + 1]) {
    const portFromArgs = parseInt(args[portArgIndex + 1]);
    if (!isNaN(portFromArgs)) {
      PORT = portFromArgs;
    }
  }

  // 启动服务器
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Visit http://localhost:${PORT} to use the API`);
    logger.info('Press Ctrl+C to stop the server');
  });

  // 处理端口冲突等错误
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const newPort = PORT + 1;
      if (newPort > 3010) { // 避免无限尝试
        logger.error(`All ports from ${PORT} to ${newPort-1} are busy`);
        process.exit(1);
      }
      logger.warn(`Port ${PORT} is busy, trying port ${newPort}...`);
      setTimeout(() => {
        app.listen(newPort, () => {
          logger.info(`Server is running on port ${newPort}`);
          logger.info(`Visit http://localhost:${newPort} to use the API`);
        });
      }, 1000);
    } else {
      logger.error(`Server error: ${err.message}`);
    }
  });
  
  // 处理 Ctrl+C 退出
  process.on('SIGINT', () => {
    logger.info('Shutting down server...');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}