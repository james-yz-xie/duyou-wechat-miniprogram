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
    loading: false
  },

  onLoad() {
    this.formatTodayDate();
  },

  onShow() {
    this.loadData();
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

  async loadData() {
    this.setData({ loading: true });
    
    try {
      const [habits, stats] = await Promise.all([
        storage.getTodayStatus(),
        storage.getStatistics()
      ]);
      
      this.setData({
        habits,
        stats,
        loading: false
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      this.setData({ loading: false });
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
  }
});
