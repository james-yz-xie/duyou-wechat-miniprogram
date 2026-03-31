/**
 * 数据存储服务
 * 封装习惯和打卡数据的操作
 * 支持后端 API 和本地离线存储
 */

const api = require('./api');

// 存储键名
const STORAGE_KEYS = {
  HABITS: 'habits',
  CHECK_INS: 'checkIns',
  USER_ID: 'userId',
  OPENID: 'openid'
};

// 是否使用后端 API
let useApi = true;

/**
 * 设置是否使用 API
 */
function setUseApi(use) {
  useApi = use;
}

/**
 * 生成唯一 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
function getTodayStr() {
  return formatDate(new Date());
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ========== 用户相关 ==========

/**
 * 用户登录
 */
async function login(openid) {
  try {
    const result = await api.login(openid);
    return result;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
}

/**
 * 获取用户 ID
 */
function getUserId() {
  return wx.getStorageSync(STORAGE_KEYS.USER_ID) || '';
}

// ========== 习惯相关 ==========

/**
 * 获取所有习惯
 */
async function getHabits() {
  if (useApi) {
    try {
      const habits = await api.getHabits();
      // 缓存到本地
      wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      return habits;
    } catch (error) {
      console.error('从 API 获取习惯失败，使用本地缓存:', error);
      return wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
    }
  }
  return wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
}

/**
 * 获取单个习惯
 */
async function getHabitById(id) {
  if (useApi) {
    try {
      return await api.getHabitById(id);
    } catch (error) {
      console.error('获取习惯失败:', error);
      const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
      return habits.find(h => h.id == id);
    }
  }
  const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
  return habits.find(h => h.id === id);
}

/**
 * 创建习惯
 */
async function createHabit(habitData) {
  const habit = {
    id: generateId(),
    name: habitData.name,
    icon: habitData.icon || '📋',
    color: habitData.color || '#4A90D9',
    reminder: habitData.reminder || '',
    frequency: habitData.frequency || 'daily',
    streak: 0,
    maxStreak: 0,
    totalCheckIns: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  if (useApi) {
    try {
      const newHabit = await api.createHabit(habitData);
      // 更新本地缓存
      const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
      habits.push(newHabit);
      wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      return newHabit;
    } catch (error) {
      console.error('创建习惯失败:', error);
      throw error;
    }
  } else {
    const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
    habits.push(habit);
    wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
    return habit;
  }
}

/**
 * 更新习惯
 */
async function updateHabit(id, updates) {
  if (useApi) {
    try {
      const updated = await api.updateHabit(id, updates);
      // 更新本地缓存
      const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
      const index = habits.findIndex(h => h.id == id);
      if (index !== -1) {
        habits[index] = { ...habits[index], ...updates };
        wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      }
      return updated;
    } catch (error) {
      console.error('更新习惯失败:', error);
      throw error;
    }
  } else {
    const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
    const index = habits.findIndex(h => h.id === id);
    if (index !== -1) {
      habits[index] = { ...habits[index], ...updates, updatedAt: new Date().toISOString() };
      wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      return habits[index];
    }
    return null;
  }
}

/**
 * 删除习惯
 */
async function deleteHabit(id) {
  if (useApi) {
    try {
      await api.deleteHabit(id);
      // 更新本地缓存
      const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
      const filtered = habits.filter(h => h.id != id);
      wx.setStorageSync(STORAGE_KEYS.HABITS, filtered);
      
      // 同时删除打卡记录
      const checkIns = getAllCheckIns();
      delete checkIns[id];
      wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
      
      return true;
    } catch (error) {
      console.error('删除习惯失败:', error);
      throw error;
    }
  } else {
    const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
    const filtered = habits.filter(h => h.id !== id);
    wx.setStorageSync(STORAGE_KEYS.HABITS, filtered);
    
    const checkIns = getAllCheckIns();
    delete checkIns[id];
    wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
    
    return true;
  }
}

// ========== 打卡相关 ==========

/**
 * 获取所有打卡记录（本地）
 */
function getAllCheckIns() {
  return wx.getStorageSync(STORAGE_KEYS.CHECK_INS) || {};
}

/**
 * 检查某天是否已打卡
 */
async function isCheckedIn(habitId, dateStr) {
  if (useApi) {
    try {
      const status = await api.getTodayStatus();
      const habit = status.find(s => s.id == habitId);
      if (dateStr === getTodayStr()) {
        return habit ? habit.checkedInToday : false;
      }
      // 非 today 的情况，需要从打卡记录查询
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(5, 7));
      const checkIns = await api.getHabitCheckIns(habitId, year, month);
      return checkIns.some(c => c.checkDate === dateStr);
    } catch (error) {
      console.error('检查打卡状态失败:', error);
      const checkIns = getAllCheckIns();
      return checkIns[habitId] && checkIns[habitId][dateStr] === true;
    }
  }
  const checkIns = getAllCheckIns();
  return checkIns[habitId] && checkIns[habitId][dateStr] === true;
}

/**
 * 打卡
 */
async function checkIn(habitId) {
  const todayStr = getTodayStr();
  
  // 先检查是否已打卡
  if (await isCheckedIn(habitId, todayStr)) {
    return { success: false, message: '今日已打卡' };
  }
  
  if (useApi) {
    try {
      const result = await api.checkIn(habitId);
      
      // 更新本地缓存
      const checkIns = getAllCheckIns();
      if (!checkIns[habitId]) {
        checkIns[habitId] = {};
      }
      checkIns[habitId][todayStr] = true;
      wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
      
      // 更新习惯统计
      const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
      const index = habits.findIndex(h => h.id == habitId);
      if (index !== -1) {
        habits[index].streak = result.streak;
        habits[index].totalCheckIns += 1;
        habits[index].maxStreak = Math.max(habits[index].maxStreak, result.streak);
        wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      }
      
      return { success: true, streak: result.streak };
    } catch (error) {
      console.error('打卡失败:', error);
      throw error;
    }
  } else {
    const checkIns = getAllCheckIns();
    if (!checkIns[habitId]) {
      checkIns[habitId] = {};
    }
    checkIns[habitId][todayStr] = true;
    wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
    
    // 更新习惯统计
    const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
    const index = habits.findIndex(h => h.id === habitId);
    if (index !== -1) {
      const newStreak = calculateStreak(habitId);
      habits[index].streak = newStreak;
      habits[index].totalCheckIns += 1;
      habits[index].maxStreak = Math.max(habits[index].maxStreak || 0, newStreak);
      wx.setStorageSync(STORAGE_KEYS.HABITS, habits);
      
      return { success: true, streak: newStreak };
    }
    
    return { success: true, streak: 0 };
  }
}

/**
 * 取消打卡
 */
async function uncheckIn(habitId, dateStr) {
  if (useApi) {
    try {
      await api.uncheckIn(habitId, dateStr);
      
      // 更新本地缓存
      const checkIns = getAllCheckIns();
      if (checkIns[habitId] && checkIns[habitId][dateStr]) {
        delete checkIns[habitId][dateStr];
        wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
      }
      
      return true;
    } catch (error) {
      console.error('取消打卡失败:', error);
      throw error;
    }
  } else {
    const checkIns = getAllCheckIns();
    if (checkIns[habitId] && checkIns[habitId][dateStr]) {
      delete checkIns[habitId][dateStr];
      wx.setStorageSync(STORAGE_KEYS.CHECK_INS, checkIns);
      return true;
    }
    return false;
  }
}

/**
 * 获取今日所有习惯的打卡状态
 */
async function getTodayStatus() {
  if (useApi) {
    try {
      const status = await api.getTodayStatus();
      // 转换为兼容格式
      const habits = await getHabits();
      return habits.map(habit => {
        const statusItem = status.find(s => s.id == habit.id);
        return {
          ...habit,
          checkedInToday: statusItem ? statusItem.checkedInToday : false,
          streak: statusItem ? statusItem.streak : habit.streak
        };
      });
    } catch (error) {
      console.error('获取今日状态失败:', error);
      return getLocalTodayStatus();
    }
  }
  return getLocalTodayStatus();
}

/**
 * 本地获取今日状态
 */
function getLocalTodayStatus() {
  const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
  const todayStr = getTodayStr();
  const checkIns = getAllCheckIns();
  
  return habits.map(habit => ({
    ...habit,
    checkedInToday: checkIns[habit.id] && checkIns[habit.id][todayStr] === true
  }));
}

/**
 * 获取统计数据
 */
async function getStatistics() {
  if (useApi) {
    try {
      const stats = await api.getStatistics();
      // stats 可能为 null，需要检查
      if (!stats) {
        return getLocalStatistics();
      }
      return {
        totalHabits: stats.totalHabits || 0,
        totalCheckIns: stats.totalCheckIns || 0,
        todayCheckedCount: stats.todayCheckedCount || 0,
        todayTotalCount: stats.todayTotalCount || 0,
        avgStreak: stats.avgStreak || 0,
        maxStreak: stats.maxStreak || 0
      };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      return getLocalStatistics();
    }
  }
  return getLocalStatistics();
}

/**
 * 本地获取统计数据
 */
function getLocalStatistics() {
  const habits = wx.getStorageSync(STORAGE_KEYS.HABITS) || [];
  
  if (habits.length === 0) {
    return {
      totalHabits: 0,
      totalCheckIns: 0,
      todayCheckedCount: 0,
      todayTotalCount: 0,
      avgStreak: 0,
      maxStreak: 0
    };
  }
  
  const todayStr = getTodayStr();
  const checkIns = getAllCheckIns();
  let totalCheckIns = 0;
  let todayCheckedCount = 0;
  let maxStreak = 0;
  let totalStreak = 0;
  
  habits.forEach(h => {
    totalCheckIns += h.totalCheckIns || 0;
    if (checkIns[h.id] && checkIns[h.id][todayStr]) {
      todayCheckedCount++;
    }
    maxStreak = Math.max(maxStreak, h.maxStreak || 0);
    totalStreak += h.streak || 0;
  });
  
  return {
    totalHabits: habits.length,
    totalCheckIns,
    todayCheckedCount,
    todayTotalCount: habits.length,
    avgStreak: Math.round(totalStreak / habits.length),
    maxStreak
  };
}

/**
 * 计算连续打卡天数（本地）
 */
function calculateStreak(habitId) {
  const checkIns = getAllCheckIns();
  const habitCheckIns = checkIns[habitId] || {};
  const dates = Object.keys(habitCheckIns).filter(d => habitCheckIns[d]).sort().reverse();
  
  if (dates.length === 0) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let streak = 0;
  let currentDate = today;
  
  const todayStr = formatDate(currentDate);
  const yesterdayStr = formatDate(new Date(currentDate.getTime() - 86400000));
  
  if (dates.includes(todayStr)) {
    streak = 1;
    currentDate = new Date(currentDate.getTime() - 86400000);
  } else if (dates.includes(yesterdayStr)) {
    streak = 1;
    currentDate = new Date(currentDate.getTime() - 86400000 * 2);
  } else {
    return 0;
  }
  
  while (true) {
    const dateStr = formatDate(currentDate);
    if (dates.includes(dateStr)) {
      streak++;
      currentDate = new Date(currentDate.getTime() - 86400000);
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * 获取某月打卡数据（用于日历/热力图）
 */
async function getMonthCheckIns(habitId, year, month) {
  if (useApi) {
    try {
      const checkIns = await api.getHabitCheckIns(habitId, year, month);
      const result = {};
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        result[dateStr] = checkIns.some(c => c.checkDate === dateStr);
      }
      
      return result;
    } catch (error) {
      console.error('获取月打卡数据失败:', error);
      return getLocalMonthCheckIns(habitId, year, month);
    }
  }
  return getLocalMonthCheckIns(habitId, year, month);
}

/**
 * 本地获取某月打卡数据
 */
function getLocalMonthCheckIns(habitId, year, month) {
  const checkIns = getAllCheckIns();
  const habitCheckIns = checkIns[habitId] || {};
  const result = {};
  
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    result[dateStr] = habitCheckIns[dateStr] === true;
  }
  
  return result;
}

module.exports = {
  // 配置
  setUseApi,
  
  // 用户
  login,
  getUserId,
  
  // 习惯操作
  getHabits,
  getHabitById,
  createHabit,
  updateHabit,
  deleteHabit,
  
  // 打卡操作
  checkIn,
  uncheckIn,
  isCheckedIn,
  getTodayStatus,
  getHabitCheckIns: getMonthCheckIns,
  
  // 状态与统计
  getStatistics,
  calculateStreak,
  
  // 工具函数
  getTodayStr,
  formatDate,
  generateId,
  getAllCheckIns
};
