Page({
  data: {
    paid: false,
    // 云闪付：已从云闪付小程序返回，实际结果以订单状态为准
    pending: false,
    orderId: '',
    orderNo: ''
  },

  onLoad: function (options) {
    this.setData({
      paid: options.paid === '1',
      pending: options.pending === '1',
      orderId: options.orderId || '',
      orderNo: options.orderNo || ''
    });
  },

  goOrderDetail: function () {
    if (!this.data.orderId) {
      wx.switchTab({ url: '/pages/mine/mine' });
      return;
    }
    wx.redirectTo({
      url: '/pages/order/detail/detail?id=' + this.data.orderId
    });
  },

  goOrderList: function () {
    wx.redirectTo({ url: '/pages/order/list/list' });
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
