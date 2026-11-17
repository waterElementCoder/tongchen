const auth = require('../../utils/auth');

Page({
  data: {
    logged: false,
    userInfo: null,
    nickname: '',
    phone: '',
    favCount: 0,
    // 订单入口
    orderTabs: [
      { key: 'pay', name: '待支付', icon: '💳' },
      { key: 'ship', name: '待发货', icon: '📦' },
      { key: 'receive', name: '待收货', icon: '🚚' },
      { key: 'done', name: '已完成', icon: '✅' }
    ]
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.refreshUser();
  },

  refreshUser: function () {
    const logged = auth.isLoggedIn();
    const user = auth.getUser() || {};
    this.setData({
      logged: logged,
      userInfo: user,
      nickname: user.nickname || user.nickName || '',
      phone: user.phone || '',
      favCount: (wx.getStorageSync('favProducts') || []).length
    });
  },

  onUserRowTap: function () {
    if (!this.data.logged) this.goLogin();
  },

  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  // 授权绑定手机号
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
      .then(function (res) {
        wx.hideLoading();
        wx.showToast({ title: '绑定成功', icon: 'success' });
        that.refreshUser();
      })
      .catch(function (err) {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || '绑定失败', icon: 'none' });
      });
  },

  onLogout: function () {
    const that = this;
    wx.showModal({
      title: '退出登录',
      content: '退出后购物车与订单需要重新登录才能查看',
      success: function (res) {
        if (!res.confirm) return;
        const app = getApp();
        if (app && typeof app.logout === 'function') {
          app.logout();
        } else {
          auth.logout();
        }
        that.refreshUser();
        wx.showToast({ title: '已退出', icon: 'none' });
      }
    });
  },

  goOrders: function (e) {
    const key = e.currentTarget.dataset.key || 'all';
    wx.navigateTo({ url: '/pages/order/list/list?status=' + key });
  },

  goAllOrders: function () {
    wx.navigateTo({ url: '/pages/order/list/list?status=all' });
  },

  goAddress: function () {
    wx.navigateTo({ url: '/pages/address/list/list' });
  },

  goFavorites: function () {
    wx.showToast({ title: '收藏列表建设中', icon: 'none' });
  },

  goSweet: function () {
    wx.navigateTo({ url: '/pages/sweet/sweet' });
  },

  goAbout: function () {
    wx.showModal({
      title: '日喜优选',
      content: '一站式「日常补给 + 喜庆采购」双场景购物平台',
      showCancel: false
    });
  }
});
