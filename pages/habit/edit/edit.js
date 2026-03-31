// pages/habit/edit/edit.js
const storage = require('../../../utils/storage');
const util = require('../../../utils/util');

Page({
  data: {
    habit: {
      name: '',
      icon: '📋',
      color: '#4A90D9',
      reminder: '',
      frequency: 'daily'
    },
    icons: ['📋', '🏃', '📚', '💪', '🎯', '✍️', '🧘', '🥗', '💤', '🎨', '🎵', '💻', '🌅', '🧹', '📝', '🌱'],
    colors: [
      { value: '#4A90D9', name: '蓝色' },
      { value: '#52c41a', name: '绿色' },
      { value: '#ff6b00', name: '橙色' },
      { value: '#722ed1', name: '紫色' },
      { value: '#eb2f96', name: '粉色' },
      { value: '#faad14', name: '金色' },
      { value: '#13c2c2', name: '青色' },
      { value: '#333333', name: '黑色' }
    ],
    frequencies: [
      { value: 'daily', label: '每天' },
      { value: 'weekday', label: '工作日' },
      { value: 'weekend', label: '周末' },
      { value: 'custom', label: '自定义' }
    ],
    isEdit: false,
    habitId: null,
    loading: false
  },

  onLoad(options) {
    if (options.id) {
      this.loadHabit(options.id);
      wx.setNavigationBarTitle({ title: '编辑习惯' });
    }
  },

  async loadHabit(id) {
    this.setData({ loading: true });
    
    try {
      const habit = await storage.getHabitById(id);
      if (habit) {
        this.setData({
          habit,
          isEdit: true,
          habitId: id,
          loading: false
        });
      } else {
        this.setData({ loading: false });
        util.showError('习惯不存在');
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (error) {
      console.error('加载习惯失败:', error);
      this.setData({ loading: false });
      util.showError('加载失败');
    }
  },

  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({
      'habit.icon': icon
    });
  },

  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      'habit.color': color
    });
  },

  onTimeChange(e) {
    this.setData({
      'habit.reminder': e.detail.value
    });
  },

  selectFrequency(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      'habit.frequency': value
    });
  },

  onNameInput(e) {
    this.setData({
      'habit.name': e.detail.value
    });
  },

  async submitForm(e) {
    const name = this.data.habit.name;
    
    if (!name || !name.trim()) {
      util.showError('请输入习惯名称');
      return;
    }

    this.setData({ loading: true });
    
    const habitData = {
      ...this.data.habit,
      name: name.trim()
    };

    try {
      if (this.data.isEdit) {
        await storage.updateHabit(this.data.habitId, habitData);
        util.showSuccess('修改成功');
      } else {
        await storage.createHabit(habitData);
        util.showSuccess('创建成功');
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('保存失败:', error);
      this.setData({ loading: false });
      util.showError('保存失败');
    }
  },

  async deleteHabit() {
    const confirm = await util.showConfirm('确定要删除这个习惯吗？所有打卡记录将被清除。');
    
    if (confirm) {
      this.setData({ loading: true });
      
      try {
        await storage.deleteHabit(this.data.habitId);
        util.showSuccess('已删除');
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } catch (error) {
        console.error('删除失败:', error);
        this.setData({ loading: false });
        util.showError('删除失败');
      }
    }
  }
});
