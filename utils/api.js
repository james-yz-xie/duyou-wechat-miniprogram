/**
 * API 服务封装
 * 封装与后端的通信
 */

// API 基础地址（部署后替换为实际地址）
// 腾讯云微信云托管部署后的地址
const BASE_URL = 'https://springboot-po0n-240642-4-1417697344.sh.run.tcloudbase.com/api';

// 是否使用本地存储（离线模式）
let offlineMode = false;

/**
 * 设置 API 基础地址
 */
function setBaseUrl(url) {
  // 如果是相对路径，说明是云托管环境
  if (!url.startsWith('http')) {
    BASE_URL = '/api';
  } else {
    BASE_URL = url + '/api';
  }
}

/**
 * 获取存储的 openid
 */
function getOpenid() {
  return wx.getStorageSync('openid') || '';
}

/**
 * 获取存储的 userId
 */
function getUserId() {
  return wx.getStorageSync('userId') || '';
}

/**
 * 通用请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const openid = getOpenid();
    const userId = getUserId();
    
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'X-WX-OPENID': openid,
        'X-USER-ID': userId,
        ...options.header
      },
      success(res) {
        if (res.statusCode === 200) {
          if (res.data.code === 0 || res.data.code === 200) {
            resolve(res.data.data);
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        } else if (res.statusCode === 401) {
          // 未登录，需要重新登录
          handleLogin();
          reject(new Error('请先登录'));
        } else {
          reject(new Error('网络错误'));
        }
      },
      fail(err) {
        console.error('API 请求失败:', err);
        offlineMode = true;
        reject(err);
      }
    });
  });
}

/**
 * 处理登录
 */
function handleLogin() {
  // 跳转到登录页面或重新登录
  wx.removeStorageSync('openid');
  wx.removeStorageSync('userId');
}

/**
 * 用户登录（通过 code）
 */
async function loginWithCode(code) {
  try {
    const result = await request({
      url: `${BASE_URL}/user/login`,
      method: 'POST',
      data: { code, nickname: '', avatar: '' }
    });
    
    if (result && result.id) {
      wx.setStorageSync('userId', result.id);
      wx.setStorageSync('openid', result.openid);
    }
    
    return result;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
}

/**
 * 用户登录
 * @param {string} openid 微信 openid
 */
async function login(openid) {
  try {
    const result = await request({
      url: `${BASE_URL}/user/login`,
      method: 'POST',
      data: { code: openid }
    });
    
    wx.setStorageSync('userId', result.id);
    wx.setStorageSync('openid', result.openid);
    
    return result;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
}

/**
 * 获取习惯列表
 */
async function getHabits() {
  const userId = getUserId();
  if (!userId) {
    return [];
  }
  
  try {
    return await request({
      url: `${BASE_URL}/habits?userId=${userId}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取习惯列表失败:', error);
    return [];
  }
}

/**
 * 获取单个习惯
 */
async function getHabitById(id) {
  try {
    return await request({
      url: `${BASE_URL}/habits/${id}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取习惯详情失败:', error);
    return null;
  }
}

/**
 * 创建习惯
 */
async function createHabit(habitData) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      url: `${BASE_URL}/habits?userId=${userId}`,
      method: 'POST',
      data: habitData
    });
  } catch (error) {
    console.error('创建习惯失败:', error);
    throw error;
  }
}

/**
 * 更新习惯
 */
async function updateHabit(id, habitData) {
  try {
    return await request({
      url: `${BASE_URL}/habits/${id}`,
      method: 'PUT',
      data: habitData
    });
  } catch (error) {
    console.error('更新习惯失败:', error);
    throw error;
  }
}

/**
 * 删除习惯
 */
async function deleteHabit(id) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      url: `${BASE_URL}/habits/${id}?userId=${userId}`,
      method: 'DELETE'
    });
  } catch (error) {
    console.error('删除习惯失败:', error);
    throw error;
  }
}

/**
 * 打卡
 */
async function checkIn(habitId) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      url: `${BASE_URL}/checkin?userId=${userId}`,
      method: 'POST',
      data: { habitId }
    });
  } catch (error) {
    console.error('打卡失败:', error);
    throw error;
  }
}

/**
 * 取消打卡
 */
async function uncheckIn(habitId, dateStr) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    let url = `${BASE_URL}/checkin?userId=${userId}&habitId=${habitId}`;
    if (dateStr) {
      url += `&dateStr=${dateStr}`;
    }
    
    return await request({
      url,
      method: 'DELETE'
    });
  } catch (error) {
    console.error('取消打卡失败:', error);
    throw error;
  }
}

/**
 * 获取今日状态
 */
async function getTodayStatus() {
  const userId = getUserId();
  if (!userId) {
    return [];
  }
  
  try {
    return await request({
      url: `${BASE_URL}/checkin/today?userId=${userId}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取今日状态失败:', error);
    return [];
  }
}

/**
 * 获取统计数据
 */
async function getStatistics() {
  const userId = getUserId();
  if (!userId) {
    return null;
  }
  
  try {
    return await request({
      url: `${BASE_URL}/checkin/stats?userId=${userId}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return null;
  }
}

/**
 * 获取习惯的打卡记录
 */
async function getHabitCheckIns(habitId, year, month) {
  try {
    return await request({
      url: `${BASE_URL}/checkin/habit/${habitId}?year=${year}&month=${month}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取打卡记录失败:', error);
    return [];
  }
}

/**
 * 检查是否离线模式
 */
function isOfflineMode() {
  return offlineMode;
}

/**
 * 设置离线模式
 */
function setOfflineMode(mode) {
  offlineMode = mode;
}

module.exports = {
  setBaseUrl,
  login,
  loginWithCode,
  getHabits,
  getHabitById,
  createHabit,
  updateHabit,
  deleteHabit,
  checkIn,
  uncheckIn,
  getTodayStatus,
  getStatistics,
  getHabitCheckIns,
  isOfflineMode,
  setOfflineMode,
  getOpenid,
  getUserId
};
