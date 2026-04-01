// app.js
const storage = require('./utils/storage');
const api = require('./utils/api');

// 云开发环境ID
const CLOUD_ENV = 'prod-1gjkl9vyaa17d3a2';

App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: CLOUD_ENV
    });
    
    // 初始化 API 模块
    api.initCloudConfig(CLOUD_ENV, 'springboot-po0n');
    
    // 初始化
    this.initApp();
  },

  async initApp() {
    // 检查是否首次使用
    const isFirstLaunch = wx.getStorageSync('isFirstLaunch');
    if (!isFirstLaunch) {
      wx.setStorageSync('isFirstLaunch', true);
      wx.setStorageSync('habits', []);
      wx.setStorageSync('checkIns', {});
      console.log('首次启动，数据已初始化');
    }

    // 尝试登录
    await this.tryLogin();
  },

  /**
   * 尝试登录
   * 使用微信登录获取 code，然后发送到后端换取 openid
   */
  async tryLogin() {
    try {
      // 检查是否已有 userId
      const existingUserId = wx.getStorageSync('userId');
      if (existingUserId) {
        console.log('用户已登录, userId:', existingUserId);
        this.globalData.userId = existingUserId;
        return;
      }

      // 调用微信登录
      const loginResult = await wx.login();
      if (!loginResult.code) {
        console.error('wx.login 失败');
        this.useLocalMode();
        return;
      }

      console.log('获取到 code:', loginResult.code);
      
      // 用 code 发送到后端登录
      await this.doLoginWithCode(loginResult.code);
    } catch (error) {
      console.error('登录失败:', error);
      this.useLocalMode();
    }
  },

  /**
   * 使用本地模式（后端不可用时）
   */
  useLocalMode() {
    console.log('切换到本地模式');
    storage.setUseApi(false);
    
    // 生成一个本地 userId
    let localUserId = wx.getStorageSync('localUserId');
    if (!localUserId) {
      localUserId = 'local_' + Date.now().toString(36);
      wx.setStorageSync('localUserId', localUserId);
    }
    this.globalData.userId = localUserId;
    console.log('使用本地 userId:', localUserId);
  },

  /**
   * 用 code 登录
   */
  async doLoginWithCode(code) {
    try {
      const result = await api.loginWithCode(code);
      if (result && result.id) {
        this.globalData.userId = result.id;
        this.globalData.userInfo = {
          id: result.id,
          openid: result.openid,
          nickname: result.nickname,
          avatar: result.avatar
        };
        console.log('登录成功, userId:', result.id);
      } else {
        console.error('登录返回数据异常:', result);
        this.useLocalMode();
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      this.useLocalMode();
    }
  },

  globalData: {
    userInfo: null,
    userId: null,
    version: '1.0.0'
  }
});
