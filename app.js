const api = require('./utils/api');
const auth = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    // 登录完成的 Promise，页面可 .then() 等待 token 就绪
    loginPromise: null
  },

  onLaunch: function () {
    // 不做强制的启动登录：浏览类接口免登录，需要登录态的接口会由 utils/request 触发静默登录
    this.globalData.loginPromise = Promise.resolve();
    if (auth.getToken()) {
      this.globalData.userInfo = auth.getUser();
      this.refreshCartBadge();
    }
  },

  /**
   * 供页面显式调用的登录方法（wx.login 静默登录）
   */
  doLogin: function () {
    const that = this;
    this.globalData.loginPromise = auth.login().then(function (data) {
      that.globalData.userInfo = auth.getUser();
      return data;
    });
    return this.globalData.loginPromise;
  },

  logout: function () {
    auth.logout();
    this.globalData.userInfo = null;
    wx.removeTabBarBadge({ index: 2 });
  },

  // 更新底部 tabBar 购物车角标
  refreshCartBadge: function () {
    if (!auth.getToken()) return;
    api
      .getCart()
      .then(function (list) {
        const count = (list || []).reduce(function (sum, it) {
          return sum + (it.quantity || 0);
        }, 0);
        if (count > 0) {
          wx.setTabBarBadge({ index: 2, text: String(count > 99 ? '99+' : count) });
        } else {
          wx.removeTabBarBadge({ index: 2 });
        }
      })
      .catch(function () {
        // 未登录或网络异常时忽略
        wx.removeTabBarBadge({ index: 2 });
      });
  }
});
