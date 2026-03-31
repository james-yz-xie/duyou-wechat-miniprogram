// pages/stats/stats.js
const api = require('../../utils/api');

Page({
  data: {
    stats: null,
    loading: true,
    currentMonth: '',
    monthDays: [],
    heatmapData: []
  },

  onLoad() {
    this.initCurrentMonth();
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  initCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    this.setData({
      currentMonth: `${year}年${month}月`
    });
    this.generateMonthDays(year, now.getMonth() + 1);
  },

  generateMonthDays(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(String(i).padStart(2, '0'));
    }
    this.setData({ monthDays: days });
  },

  async loadStats() {
    try {
      this.setData({ loading: true });
      const stats = await api.getStats();
      this.setData({
        stats,
        loading: false
      });
    } catch (error) {
      console.error('加载统计失败:', error);
      this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.loadStats().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  prevMonth() {
    // 上一个月
    const parts = this.data.currentMonth.replace('年', '-').replace('月', '').split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) - 1;
    if (month < 1) {
      month = 12;
      year--;
    }
    this.setData({
      currentMonth: `${year}年${String(month).padStart(2, '0')}月`
    });
    this.generateMonthDays(year, month);
  },

  nextMonth() {
    // 下一个月
    const parts = this.data.currentMonth.replace('年', '-').replace('月', '').split('-');
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]) + 1;
    if (month > 12) {
      month = 1;
      year++;
    }
    this.setData({
      currentMonth: `${year}年${String(month).padStart(2, '0')}月`
    });
    this.generateMonthDays(year, month);
  }
});
