const logger = require('./logger')
// 预先定义常量和函数引用
// 中国 IP 段（来源：data/ChineseIPGenerate.csv）
const chinaIPRangesRaw = [
  // 开始IP, 结束IP, IP个数, 位置
  ['1.0.1.0', '1.0.3.255', 768, '福州'],
  ['1.0.8.0', '1.0.15.255', 2048, '广州'],
  ['1.0.32.0', '1.0.63.255', 8192, '广州'],
  ['1.1.0.0', '1.1.0.255', 256, '福州'],
  ['1.1.2.0', '1.1.63.255', 15872, '广州'],
  ['1.2.0.0', '1.2.2.255', 768, '北京'],
  ['1.2.4.0', '1.2.127.255', 31744, '广州'],
  ['1.3.0.0', '1.3.255.255', 65536, '广州'],
  ['1.4.1.0', '1.4.127.255', 32512, '广州'],
  ['1.8.0.0', '1.8.255.255', 65536, '北京'],
  ['1.10.0.0', '1.10.9.255', 2560, '福州'],
  ['1.10.11.0', '1.10.127.255', 29952, '广州'],
  ['1.12.0.0', '1.15.255.255', 262144, '上海'],
  ['1.18.128.0', '1.18.128.255', 256, '北京'],
  ['1.24.0.0', '1.31.255.255', 524288, '赤峰'],
  ['1.45.0.0', '1.45.255.255', 65536, '北京'],
  ['1.48.0.0', '1.51.255.255', 262144, '济南'],
  ['1.56.0.0', '1.63.255.255', 524288, '伊春'],
  ['1.68.0.0', '1.71.255.255', 262144, '忻州'],
  ['1.80.0.0', '1.95.255.255', 1048576, '北京'],
  ['1.116.0.0', '1.117.255.255', 131072, '上海'],
  ['1.119.0.0', '1.119.255.255', 65536, '北京'],
  ['1.180.0.0', '1.185.255.255', 393216, '桂林'],
  ['1.188.0.0', '1.199.255.255', 786432, '洛阳'],
  ['1.202.0.0', '1.207.255.255', 393216, '铜仁'],
]

// 将原始字符串段转换为数值段并计算总数（在模块初始化时完成一次）
function ipToInt(ip) {
  const parts = ip.split('.').map(Number)
  const a = (parts[0] << 24) >>> 0
  const b = parts[1] << 16
  const c = parts[2] << 8
  const d = parts[3]
  return a + b + c + d
}

function intToIp(int) {
  return [
    (int >>> 24) & 0xff,
    (int >>> 16) & 0xff,
    (int >>> 8) & 0xff,
    int & 0xff,
  ].join('.')
}

const chinaIPRanges = (function buildRanges() {
  const arr = []
  let total = 0
  for (let i = 0; i < chinaIPRangesRaw.length; i++) {
    const r = chinaIPRangesRaw[i]
    const start = ipToInt(r[0])
    const end = ipToInt(r[1])
    const count = r[2] || end - start + 1
    arr.push({ start, end, count, location: r[3] || '' })
    total += count
  }
  // attach total for convenience
  arr.totalCount = total
  return arr
})()
const floor = Math.floor
const random = Math.random
const keys = Object.keys

// 预编译encodeURIComponent以减少查找开销
const encode = encodeURIComponent

module.exports = {
  toBoolean(val) {
    if (typeof val === 'boolean') return val
    if (val === '') return val
    return val === 'true' || val == '1'
  },

  cookieToJson(cookie) {
    if (!cookie) return {}
    let cookieArr = cookie.split(';')
    let obj = {}

    // 优化：使用for循环替代forEach，性能更好
    for (let i = 0, len = cookieArr.length; i < len; i++) {
      let item = cookieArr[i]
      let arr = item.split('=')
      // 优化：使用严格等于
      if (arr.length === 2) {
        obj[arr[0].trim()] = arr[1].trim()
      }
    }
    return obj
  },

  cookieObjToString(cookie) {
    // 优化：使用预绑定的keys函数和for循环
    const cookieKeys = keys(cookie)
    const result = []

    // 优化：使用for循环和预分配数组
    for (let i = 0, len = cookieKeys.length; i < len; i++) {
      const key = cookieKeys[i]
      result[i] = `${encode(key)}=${encode(cookie[key])}`
    }

    return result.join('; ')
  },

  getRandom(num) {
    // 优化：简化随机数生成逻辑
    // 原逻辑看起来有问题，这里保持原意但优化性能
    var randomValue = random()
    var floorValue = floor(randomValue * 9 + 1)
    var powValue = Math.pow(10, num - 1)
    var randomNum = floor((randomValue + floorValue) * powValue)
    return randomNum
  },

  generateRandomChineseIP() {
    // 从预定义的中国 IP 段中按权重随机选择一个段，然后在该段内生成随机 IP
    const total = chinaIPRanges.totalCount || 0
    if (!total) {
      // 兜底：回退到旧逻辑（随机 116.x 前缀）
      const fallback = `116.${getRandomInt(25, 94)}.${generateIPSegment()}.${generateIPSegment()}`
      logger.info('Generated Random Chinese IP (fallback):', fallback)
      return fallback
    }

    // 选择一个全局随机偏移（[0, total)）
    let offset = Math.floor(random() * total)
    let chosen = null
    for (let i = 0; i < chinaIPRanges.length; i++) {
      const seg = chinaIPRanges[i]
      if (offset < seg.count) {
        chosen = seg
        break
      }
      offset -= seg.count
    }

    // 如果没有选中（理论上不应该发生），回退到最后一个段
    if (!chosen) chosen = chinaIPRanges[chinaIPRanges.length - 1]

    // 在段内随机生成一个 IP（使用段真实的数值范围，而非 csv 中的 count）
    const segSize = chosen.end - chosen.start + 1
    const ipInt = chosen.start + Math.floor(random() * segSize)
    const ip = intToIp(ipInt)
    logger.info(
      'Generated Random Chinese IP:',
      ip,
      'location:',
      chosen.location,
    )
    return ip
  },
  // 生成chainId的函数
  generateChainId(cookie) {
    const version = 'v1'
    const randomNum = Math.floor(Math.random() * 1e6)
    const deviceId =
      getCookieValue(cookie, 'sDeviceId') || 'unknown-' + randomNum
    const platform = 'web'
    const action = 'login'
    const timestamp = Date.now()

    return `${version}_${deviceId}_${platform}_${action}_${timestamp}`
  },

  generateDeviceId() {
    const hexChars = '0123456789ABCDEF'
    const chars = []
    for (let i = 0; i < 52; i++) {
      const randomIndex = Math.floor(Math.random() * hexChars.length)
      chars.push(hexChars[randomIndex])
    }
    return chars.join('')
  },
}

// 优化：预先绑定函数
function getRandomInt(min, max) {
  // 优化：简化计算
  return floor(random() * (max - min + 1)) + min
}

// 优化：预先绑定generateIPSegment函数引用
function generateIPSegment() {
  // 优化：内联常量
  return getRandomInt(1, 255)
}

// 进一步优化版本（如果需要更高性能）：
/*
const cookieToJsonOptimized = (function() {
  // 预编译trim函数
  const trim = String.prototype.trim
  
  return function(cookie) {
    if (!cookie) return {}
    
    const cookieArr = cookie.split(';')
    const obj = {}
    
    for (let i = 0, len = cookieArr.length; i < len; i++) {
      const item = cookieArr[i]
      const eqIndex = item.indexOf('=')
      
      if (eqIndex > 0 && eqIndex < item.length - 1) {
        const key = trim.call(item.substring(0, eqIndex))
        const value = trim.call(item.substring(eqIndex + 1))
        obj[key] = value
      }
    }
    return obj
  }
})()
*/

// 用于从cookie字符串中获取指定值的辅助函数
function getCookieValue(cookieStr, name) {
  if (!cookieStr) return ''

  const cookies = '; ' + cookieStr
  const parts = cookies.split('; ' + name + '=')
  if (parts.length === 2) return parts.pop().split(';').shift()
  return ''
}
