/**
 * 工具函数库
 */

/**
 * 格式化时间
 */
function formatTime(date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  return `${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}`;
}

/**
 * 格式化日期显示
 */
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = dateStr.split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  if (dateOnly === todayStr) return '今天';
  if (dateOnly === yesterdayStr) return '昨天';
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 获取星期几
 */
function getWeekDay(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

/**
 * 获取本周日期列表
 */
function getWeekDates() {
  const dates = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 显示加载
 */
function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true });
}

/**
 * 隐藏加载
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示成功提示
 */
function showSuccess(title) {
  wx.showToast({
    title,
    icon: 'success',
    duration: 2000
  });
}

/**
 * 显示错误提示
 */
function showError(title) {
  wx.showToast({
    title,
    icon: 'error',
    duration: 2000
  });
}

/**
 * 模态框确认
 */
function showConfirm(content, title = '提示') {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success(res) {
        resolve(res.confirm);
      }
    });
  });
}

module.exports = {
  formatTime,
  formatDateDisplay,
  getWeekDay,
  getWeekDates,
  deepClone,
  debounce,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm
};
