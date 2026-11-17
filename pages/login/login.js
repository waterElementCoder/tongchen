const config = require('../../config/config');
const auth = require('../../utils/auth');

Page({
  data: {
    agreed: false,
    loading: false,
    // login: 微信一键登录  |  phone: 授权手机号
    step: 'login',
    // 未配置登录接口时进入开发模式：手动粘贴后端签发的 token
    devMode: !config.loginUrl,
    devToken: '',
    nickname: ''
  },

  onLoad: function () {
    // 已登录：有手机号直接放行，缺手机号则直接进入绑定步骤
    if (!auth.getToken()) return;
    const user = auth.getUser() || {};
    if (!user.phone) {
      this.setData({
        step: 'phone',
        agreed: true,
        nickname: user.nickname || user.nickName || ''
      });
      return;
    }
    this.finish();
  },

  onAgreeChange: function (e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },

  onTokenInput: function (e) {
    this.setData({ devToken: e.detail.value });
  },

  // ---------- 步骤一：微信登录 ----------

  onLogin: function () {
    const that = this;
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });

    if (this.data.devMode) {
      const token = this.data.devToken.trim();
      if (!token) {
        wx.showToast({ title: '请粘贴后端签发的 token', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      auth.setToken(token);
      that.afterLogin();
      return;
    }

    auth
      .login()
      .then(function () {
        that.afterLogin();
      })
      .catch(function (err) {
        that.setData({ loading: false });
        wx.showToast({ title: (err && err.message) || '登录失败', icon: 'none' });
      });
  },

  // 登录成功后：没绑定手机号就进入绑定步骤
  afterLogin: function () {
    const user = auth.getUser() || {};
    const phone = user.phone || '';
    this.setData({ loading: false });
    if (!phone && !this.data.devMode) {
      this.setData({
        step: 'phone',
        nickname: user.nickname || user.nickName || ''
      });
      return;
    }
    this.finish();
  },

  // ---------- 步骤二：绑定手机号 ----------

  onGetPhoneNumber: function (e) {
    const that = this;
    const detail = e.detail || {};
    if (detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }
    if (!detail.code) {
      wx.showToast({ title: '获取手机号凭证失败，请重试', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '绑定中...', mask: true });
    auth
      .bindPhone(detail.code)
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '手机号绑定成功', icon: 'success' });
        that.finish();
      })
      .catch(function (err) {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || '绑定失败', icon: 'none' });
      });
  },

  onSkipPhone: function () {
    this.finish();
  },

  // ---------- 完成 ----------

  finish: function () {
    this.setData({ loading: false });
    const app = getApp();
    if (app && typeof app.refreshCartBadge === 'function') {
      app.refreshCartBadge();
    }
    setTimeout(function () {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    }, 500);
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
