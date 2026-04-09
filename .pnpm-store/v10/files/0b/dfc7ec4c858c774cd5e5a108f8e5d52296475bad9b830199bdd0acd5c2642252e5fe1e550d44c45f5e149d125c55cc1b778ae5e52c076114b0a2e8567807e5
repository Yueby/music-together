// logger.js - 日志记录函数

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// 日志级别映射
const logLevels = {
  INFO: { color: colors.green, prefix: '[INFO]' },
  ERROR: { color: colors.red, prefix: '[ERROR]' },
  WARN: { color: colors.yellow, prefix: '[WARN]' },
  DEBUG: { color: colors.blue, prefix: '[DEBUG]' }
};

/**
 * 通用日志记录函数
 * @param {string} level - 日志级别 (INFO, ERROR, WARN, DEBUG)
 * @param {string} message - 日志消息
 */
function log(level, message) {
  const logLevel = logLevels[level.toUpperCase()];
  if (!logLevel) {
    console.log(message);
    return;
  }
  
  const timestamp = new Date().toISOString();
  const coloredPrefix = `${logLevel.color}${logLevel.prefix}${colors.reset}`;
  console.log(`${coloredPrefix} [${timestamp}] ${message}`);
}

/**
 * 信息日志
 * @param {string} message - 日志消息
 */
function info(message) {
  log('INFO', message);
}

/**
 * 错误日志
 * @param {string} message - 日志消息
 */
function error(message) {
  log('ERROR', message);
}

/**
 * 警告日志
 * @param {string} message - 日志消息
 */
function warn(message) {
  log('WARN', message);
}

/**
 * 调试日志
 * @param {string} message - 日志消息
 */
function debug(message) {
  log('DEBUG', message);
}

module.exports = {
  log,
  info,
  error,
  warn,
  debug
};