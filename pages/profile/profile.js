// pages/profile/profile.js
const storage = require('../../utils/storage');
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    userInfo: {
      nickname: '',
      avatar: ''
    },
    userId: '',
    hasUserInfo: false,
    stats: {
      totalCheckIns: 0,
      totalHabits: 0,
      maxStreak: 0
    },
    loading: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  // 加载本地存储的用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const hasUserInfo = !!(userInfo.nickname || userInfo.avatar);
    const app = getApp();
    this.setData({ 
      userInfo,
      hasUserInfo,
      userId: app.globalData.userId || wx.getStorageSync('localUserId') || ''
    });
  },

  // 微信授权获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于展示用户昵称和头像',
      success: (res) => {
        const userInfo = {
          nickname: res.userInfo.nickName,
          avatar: res.userInfo.avatarUrl
        };
        
        // 保存到本地
        wx.setStorageSync('userInfo', userInfo);
        
        this.setData({ 
          userInfo,
          hasUserInfo: true 
        });

        // 同步到后端
        this.syncUserInfo(userInfo);
        
        util.showSuccess('授权成功');
      },
      fail: () => {
        util.showError('授权失败');
      }
    });
  },

  // 使用演示账号
  useDemoAccount() {
    const userInfo = {
      nickname: '演示用户',
      avatar: ''
    };
    
    wx.setStorageSync('userInfo', userInfo);
    
    this.setData({ 
      userInfo,
      hasUserInfo: true 
    });
    
    util.showSuccess('已使用演示账号');
  },

  // 同步用户信息到后端
  async syncUserInfo(userInfo) {
    try {
      const app = getApp();
      const userId = app.globalData.userId;
      
      if (userId && !userId.startsWith('local_')) {
        // 只有真实用户才同步到后端
        await api.request({
          url: `https://springboot-po0n-240642-4-1417697344.sh.run.tcloudbase.com/api/user/update?userId=${userId}`,
          method: 'POST',
          data: {
            nickname: userInfo.nickname,
            avatar: userInfo.avatar
          }
        });
      }
    } catch (error) {
      console.error('同步用户信息失败:', error);
    }
  },

  async loadStats() {
    this.setData({ loading: true });
    
    try {
      const stats = await storage.getStatistics();
      this.setData({ stats, loading: false });
    } catch (error) {
      console.error('加载统计失败:', error);
      this.setData({ loading: false });
    }
  },

  async exportData() {
    this.setData({ loading: true });
    
    try {
      const habits = await storage.getHabits();
      const checkIns = storage.getAllCheckIns();
      
      const data = {
        habits,
        checkIns,
        exportTime: new Date().toISOString()
      };
      
      wx.setClipboardData({
        data: JSON.stringify(data),
        success: () => {
          util.showSuccess('数据已复制到剪贴板');
        }
      });
    } catch (error) {
      console.error('导出失败:', error);
      util.showError('导出失败');
    }
    
    this.setData({ loading: false });
  },

  async clearData() {
    const confirm = await util.showConfirm('确定要清除所有数据吗？此操作不可恢复。');
    
    if (confirm) {
      wx.clearStorageSync();
      wx.setStorageSync('isFirstLaunch', true);
      wx.setStorageSync('habits', []);
      wx.setStorageSync('checkIns', {});
      
      // 重置用户信息状态
      this.setData({ 
        userInfo: { nickname: '', avatar: '' },
        hasUserInfo: false 
      });
      
      util.showSuccess('数据已清除');
      await this.loadStats();
    }
  },

  showAbout() {
    wx.showModal({
      title: '关于督友',
      content: '督友 - 有人盯，才坚持\n\n一款专注于习惯养成与自律监督的小程序。\n\n版本：v1.0.0',
      showCancel: false
    });
  },

  showFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '如有问题或建议，欢迎反馈！\n\n微信：duyou_feedback',
      showCancel: false
    });
  },

  async onPullDownRefresh() {
    await this.loadStats();
    wx.stopPullDownRefresh();
  }
});
