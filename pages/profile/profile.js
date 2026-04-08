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
    hasRemind: false,
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
    const hasUserInfo = !!(userInfo.nickname);
    const app = getApp();
    const userId = app.globalData.userId || wx.getStorageSync('userId') || '';
    // 加载提醒状态
    const hasRemind = wx.getStorageSync('hasRemind') || false;
    this.setData({
      userInfo,
      hasUserInfo,
      hasRemind,
      userId: userId ? String(userId) : ''
    });
  },

  // 切换提醒开关
  async toggleRemind() {
    const { hasRemind } = this.data;

    if (hasRemind) {
      // 关闭提醒
      wx.showModal({
        title: '关闭提醒',
        content: '关闭后，将不再提醒未打卡习惯。',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('hasRemind');
            this.setData({ hasRemind: false });
            util.showSuccess('已关闭提醒');
          }
        }
      });
    } else {
      // 开启提醒 - 请求订阅消息授权
      try {
        util.showLoading('请求授权. . .');

        await wx.requestSubscribeMessage({
          tmplIds: [
            'YOUR_TEMPLATE_ID_1' // TODO: 替换为你的订阅消息模板 ID
          ],
          success: (res) => {
            util.hideLoading();

            if (res['YOUR_TEMPLATE_ID_1'] === 'ok') {
              wx.setStorageSync('hasRemind', true);
              this.setData({ hasRemind: true });
              util.showSuccess('开启成功！每天 8/12/20 点提醒你打卡');
            } else {
              util.showError('订阅失败，请重试');
            }
          },
          fail: (err) => {
            util.hideLoading();
            console.error('订阅失败:', err);
            util.showError('操作失败');
          }
        });
      } catch (error) {
        util.hideLoading();
        console.error('开启提醒失败:', error);
        util.showError('开启失败');
      }
    }
  },

  // 微信登录（自动生成昵称和头像）
  async doLogin() {
    try {
      util.showLoading('登录中...');
      
      const loginResult = await wx.login();
      if (!loginResult.code) {
        util.hideLoading();
        util.showError('登录失败');
        return;
      }
      
      // 自动生成随机昵称和emoji头像
      const adjectives = ['快乐的', '坚持的', '努力的', '勇敢的', '可爱的', '聪明的', '勤奋的', '认真的'];
      const nouns = ['小虎', '小熊', '小猫', '小狗', '小兔', '小猪', '小鹰', '小狮'];
      const emojis = ['🐶', '🐱', '🐼', '🦊', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🐰', '🐻', '🐨'];
      
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNum = Math.floor(Math.random() * 100);
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      // emoji存到avatar字段，后端支持
      const userInfo = {
        nickname: `${randomAdjective}${randomNoun}${randomNum}`,
        avatar: randomEmoji
      };
      
      // 先登录获取userId
      const result = await api.loginWithCode(loginResult.code);
      
      if (result && result.id) {
        // 同步昵称和头像到后端
        try {
          await api.updateUserInfo(userInfo);
        } catch (error) {
          console.log('同步用户信息失败:', error);
        }
        
        // 保存用户信息到本地
        wx.setStorageSync('userInfo', userInfo);
        wx.setStorageSync('userId', result.id);
        
        const app = getApp();
        app.globalData.userId = result.id;
        app.globalData.userInfo = { ...userInfo, id: result.id };
        
        this.setData({ 
          userId: String(result.id),
          userInfo,
          hasUserInfo: true
        });
        
        util.hideLoading();
        util.showSuccess('登录成功');
      } else {
        util.hideLoading();
        util.showError('登录失败');
      }
    } catch (error) {
      util.hideLoading();
      console.error('登录失败:', error);
      util.showError('登录失败');
    }
  },

  // 同步用户信息到后端
  async syncUserInfo(userInfo) {
    try {
      const app = getApp();
      const userId = app.globalData.userId;
      
      if (userId && !String(userId).startsWith('local_')) {
        // 只有真实用户才同步到后端
        await api.updateUserInfo({
          nickname: userInfo.nickname,
          avatar: userInfo.avatar
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
    console.log('clearData 被调用');
    
    wx.showModal({
      title: '提示',
      content: '确定要清除所有数据吗？此操作不可恢复。',
      success: async (res) => {
        console.log('弹窗结果:', res.confirm);
        
        if (res.confirm) {
          util.showLoading('清除中...');
          
          // 保存用户登录信息
          const app = getApp();
          const savedUserId = app.globalData.userId;
          const savedUserInfo = wx.getStorageSync('userInfo');
          
          // 先清除服务器端数据（逐个删除习惯）
          if (savedUserId && !String(savedUserId).startsWith('local_')) {
            try {
              const habits = await api.getHabits();
              for (const habit of habits) {
                await api.deleteHabit(habit.id);
              }
              console.log('服务器端习惯数据已清除');
            } catch (error) {
              console.error('清除服务器数据失败:', error);
            }
          }
          
          // 清除本地数据
          wx.clearStorageSync();
          wx.setStorageSync('isFirstLaunch', true);
          wx.setStorageSync('habits', []);
          wx.setStorageSync('checkIns', {});
          
          // 恢复用户登录信息
          if (savedUserId) {
            wx.setStorageSync('userId', savedUserId);
          }
          if (savedUserInfo) {
            wx.setStorageSync('userInfo', savedUserInfo);
          }
          
          util.hideLoading();
          
          // 重置页面状态
          this.setData({ 
            userInfo: savedUserInfo || { nickname: '', avatar: '' },
            hasUserInfo: !!savedUserInfo
          });
          
          util.showSuccess('数据已清除');
          await this.loadStats();
        }
      }
    });
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
      content: '如有问题或建议，欢迎反馈！\n联系人：谢先生\n微信号：xielingjiang001\n手机号：18018506676',
      showCancel: false
    });
  },

  async onPullDownRefresh() {
    await this.loadStats();
    wx.stopPullDownRefresh();
  },

async deleteAccount() {
    const confirm = await util.showConfirm('确定要注销账号吗？\n\n注销后将清除所有数据，且无法恢复。');
    
    if (confirm) {
      try {
        // 尝试删除服务器端用户数据
        const userId = getApp().globalData.userId;
        if (userId && !String(userId).startsWith('local_')) {
          try {
            await api.deleteUser();
          } catch (error) {
            console.log('删除服务器用户失败:', error);
          }
        }
        
        // 清除本地数据
        wx.clearStorageSync();
        
        // 清除全局数据
        const app = getApp();
        app.globalData.userId = null;
        app.globalData.userInfo = null;
        
        // 重置页面状态
        this.setData({ 
          userInfo: { nickname: '', avatar: '' },
          hasUserInfo: false,
          userId: '',
          stats: {
            totalCheckIns: 0,
            totalHabits: 0,
            maxStreak: 0
          }
        });
        
        util.showSuccess('账号已注销');
      } catch (error) {
        console.error('注销失败:', error);
        util.showError('注销失败');
      }
    }
  }
});
