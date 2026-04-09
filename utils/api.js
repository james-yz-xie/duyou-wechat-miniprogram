/**
 * API 服务封装
 * 使用 wx.cloud.callContainer 调用云托管服务
 */

// 云开发配置
let CLOUD_ENV = '';
let SERVICE_NAME = '';

/**
 * 初始化云开发配置
 */
function initCloudConfig(env, serviceName) {
  CLOUD_ENV = env;
  SERVICE_NAME = serviceName;
  console.log('云开发配置初始化:', { env, serviceName });
}

// 是否使用本地存储（离线模式）
let offlineMode = false;

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
 * 云调用请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const openid = getOpenid();
    const userId = getUserId();
    
    console.log('request options:', JSON.stringify(options));
    console.log('request data:', JSON.stringify(options.data));
    
    wx.cloud.callContainer({
      config: {
        env: CLOUD_ENV
      },
      path: options.path,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'X-WX-SERVICE': SERVICE_NAME,
        'Content-Type': 'application/json',
        'X-WX-OPENID': openid,
        'X-USER-ID': userId,
        ...options.header
      },
      success(res) {
        console.log('API响应:', {
          path: options.path,
          statusCode: res.statusCode,
          data: res.data
        });
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
          reject(new Error(`网络错误: ${res.statusCode}`));
        }
      },
      fail(err) {
        console.error('云调用请求失败:', err);
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
      path: '/api/user/login',
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
      path: '/api/user/login',
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
      path: `/api/habits?userId=${userId}`,
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
      path: `/api/habits/${id}`,
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
  
  console.log('创建习惯请求:', { userId, habitData });
  
  try {
    return await request({
      path: `/api/habits?userId=${userId}`,
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
      path: `/api/habits/${id}`,
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
      path: `/api/habits/${id}?userId=${userId}`,
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
      path: `/api/checkin?userId=${userId}`,
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
    let path = `/api/checkin?userId=${userId}&habitId=${habitId}`;
    if (dateStr) {
      path += `&dateStr=${dateStr}`;
    }
    
    return await request({
      path,
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
      path: `/api/checkin/today?userId=${userId}`,
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
      path: `/api/checkin/stats?userId=${userId}`,
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
      path: `/api/checkin/habit/${habitId}?year=${year}&month=${month}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取打卡记录失败:', error);
    return [];
  }
}

/**
 * 更新用户信息
 */
async function updateUserInfo(userInfo) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      path: `/api/user/update?userId=${userId}`,
      method: 'POST',
      data: userInfo
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    throw error;
  }
}

/**
 * 删除用户（注销）
 */
async function deleteUser() {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      path: `/api/user/delete?userId=${userId}`,
      method: 'POST'
    });
  } catch (error) {
    console.error('注销失败:', error);
    throw error;
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

/**
 * 订阅消息模板ID
 */
const SUBSCRIBE_TEMPLATE_ID = 'R_Hj409ZFmfAArq2XV64wiYOgGfEEZF54UjSmApeNyc';

/**
 * 订阅提醒
 * @param {boolean} subscribe true-订阅, false-取消订阅
 */
async function subscribeReminder(subscribe) {
  const userId = getUserId();
  if (!userId) {
    throw new Error('请先登录');
  }
  
  try {
    return await request({
      path: `/api/subscribe?userId=${userId}`,
      method: 'POST',
      data: { 
        subscribe,
        templateId: SUBSCRIBE_TEMPLATE_ID 
      }
    });
  } catch (error) {
    console.error('订阅操作失败:', error);
    throw error;
  }
}

/**
 * 获取订阅状态
 */
async function getSubscribeStatus() {
  const userId = getUserId();
  if (!userId) {
    return { subscribed: false };
  }
  
  try {
    return await request({
      path: `/api/subscribe/status?userId=${userId}`,
      method: 'GET'
    });
  } catch (error) {
    console.error('获取订阅状态失败:', error);
    return { subscribed: false };
  }
}

/**
 * 手动触发提醒（测试用）
 */
async function triggerReminder() {
  try {
    return await request({
      path: '/api/subscribe/trigger',
      method: 'POST'
    });
  } catch (error) {
    console.error('触发提醒失败:', error);
    throw error;
  }
}

module.exports = {
  initCloudConfig,
  login,
  loginWithCode,
  updateUserInfo,
  deleteUser,
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
  getUserId,
  SUBSCRIBE_TEMPLATE_ID,
  subscribeReminder,
  getSubscribeStatus,
  triggerReminder
};