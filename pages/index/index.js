// pages/index/index.js
const storage = require('../../utils/storage');
const util = require('../../utils/util');

Page({
  data: {
    habits: [],
    stats: {
      todayCheckedCount: 0,
      todayTotalCount: 0,
      totalCheckIns: 0,
      maxStreak: 0
    },
    todayDate: '',
    loading: false,
    remindTime: '',
    hasUnchecked: false
  },

  onLoad() {
    this.formatTodayDate();
  },

  async onShow() {
    await this.loadData({ showPageLoading: true });
    this.checkRemind();
  },

  formatTodayDate() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const weekDay = util.getWeekDay(today);
    this.setData({
      todayDate: `${month}月${day}日 ${weekDay}`
    });
  },

  async loadData(options = {}) {
    const { showPageLoading = false } = options;

    this.setData({ loading: true });
    wx.showNavigationBarLoading();

    if (showPageLoading) {
      util.showLoading('刷新中...');
    }

    try {
      const app = getApp();
      if (app && typeof app.waitForReady === 'function') {
        await app.waitForReady();
      }

      const [habits, stats] = await Promise.all([
        storage.getTodayStatus(),
        storage.getStatistics()
      ]);
      
      this.setData({
        habits,
        stats: stats || {
          todayCheckedCount: 0,
          todayTotalCount: 0,
          totalCheckIns: 0,
          maxStreak: 0
        }
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      this.setData({ loading: false });
      wx.hideNavigationBarLoading();
      if (showPageLoading) {
        util.hideLoading();
      }
    }
  },

  async toggleCheckIn(e) {
    const id = e.currentTarget.dataset.id;
    const habit = this.data.habits.find(h => h.id == id);
    
    if (!habit) return;
    
    if (habit.checkedInToday) {
      // 已打卡，询问是否取消
      const confirm = await util.showConfirm('确定要取消今日打卡吗？');
      if (confirm) {
        try {
          await storage.uncheckIn(id, storage.getTodayStr());
          util.showError('已取消打卡');
          await this.loadData();
        } catch (error) {
          util.showError('取消失败');
        }
      }
    } else {
      // 未打卡，执行打卡
      try {
        const result = await storage.checkIn(id);
        if (result.success) {
          util.showSuccess(`打卡成功！连续 ${result.streak} 天`);
          await this.loadData();
        } else {
          util.showError(result.message || '打卡失败');
        }
      } catch (error) {
        util.showError('打卡失败');
      }
    }
  },

  async onPullDownRefresh() {
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  // ========== 提醒功能 ==========

  /**
   * 检查是否到达提醒时段
   */
  checkRemind() {
    // 检查是否处于提醒时段
    if (!this.isRemindTime()) return;

    const remindTime = this.getRemindTimeLabel();
    const cacheKey = `remind_${remindTime}`;
    const cached = wx.getStorageSync(cacheKey);

    // 同一时段只弹窗一次
    if (cached === true) return;

    this.checkUnCheckedHabits().then(hasUnchecked => {
      if (hasUnchecked) {
        // 标记已弹窗
        wx.setStorageSync(cacheKey, true);
      }
    });
  },

  /**
   * 检查是否在提醒时段（8:00、12:00、20:00，前后 5 分钟）
   */
  isRemindTime() {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    // 检查是否接近目标时间
    const isNearTarget = [8, 12, 20].some(h => {
      const diff = Math.abs(hour - h);
      if (diff === 0) return minutes < 5;      // 同小时，分钟 <5
      if (diff === 1) return minutes >= 55;    // 相差 1 小时，分钟>55
      return false;
    });

    if (!isNearTarget) return false;

    // 检查上次弹窗是否超过 10 分钟
    const nowStr = `${hour}:${String(minutes).padStart(2, '0')}`;
    const lastTime = wx.getStorageSync('remind_last_time');

    if (lastTime && lastTime === nowStr) {
      return false;
    }

    return true;
  },

  /**
   * 获取当前提醒时段标签
   */
  getRemindTimeLabel() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 7 && hour < 9) return '8';
    if (hour >= 11 && hour < 13) return '12';
    if (hour >= 19 && hour < 21) return '20';
    return '';
  },

  /**
   * 检查未打卡习惯并弹窗提醒
   */
  async checkUnCheckedHabits() {
    try {
      const habits = await storage.getTodayStatus();
      const unchecked = habits.filter(h => !h.checkedInToday);

      if (unchecked.length > 0) {
        // 记录本次提醒时间
        const nowStr = new Date().toTimeString().slice(0, 5);
        wx.setStorageSync('remind_last_time', nowStr);

        wx.showModal({
          title: '提醒',
          content: `以下习惯还未打卡：\n${unchecked.map(h => `${h.icon} ${h.name}`).join('\n')}`,
          showCancel: true,
          confirmText: '去打卡',
          cancelText: '稍后再说',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/index/index' });
            }
          }
        });

        return true;
      }
    } catch (error) {
      console.error('检查未打卡习惯失败:', error);
    }

    return false;
  }
});
