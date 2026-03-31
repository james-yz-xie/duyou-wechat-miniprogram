// pages/habit/habit.js
const storage = require('../../utils/storage');

Page({
  data: {
    habits: [],
    filteredHabits: [],
    filter: 'all',
    loading: false
  },

  onLoad() {
    this.loadHabits();
  },

  onShow() {
    this.loadHabits();
  },

  async loadHabits() {
    this.setData({ loading: true });
    
    try {
      const habits = await storage.getHabits();
      this.setData({ habits, loading: false });
      this.applyFilter();
    } catch (error) {
      console.error('加载习惯失败:', error);
      this.setData({ loading: false });
    }
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ filter });
    this.applyFilter();
  },

  applyFilter() {
    const { habits, filter } = this.data;
    let filtered = habits;

    if (filter === 'active') {
      filtered = habits.filter(h => h.isActive);
    } else if (filter === 'archived') {
      filtered = habits.filter(h => !h.isActive);
    }

    this.setData({ filteredHabits: filtered });
  },

  viewHabit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/habit/edit/edit?id=${id}`
    });
  }
});
