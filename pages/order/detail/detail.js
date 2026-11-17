const api = require('../../../utils/api');
const util = require('../../../utils/util');
const pay = require('../../../utils/pay');

Page({
  data: {
    id: '',
    order: null,
    statusInfo: {},
    address: null,
    items: [],
    productYuan: '0.00',
    freightYuan: '0.00',
    discountYuan: '0.00',
    payYuan: '0.00'
  },

  onLoad: function (options) {
    this.setData({ id: options.id });
  },

  onShow: function () {
    this.loadOrder();
  },

  loadOrder: function () {
    const that = this;
    wx.showLoading({ title: '加载中' });
    api
      .getOrderDetail(this.data.id)
      .then(function (o) {
        wx.hideLoading();
        let address = null;
        if (o.addressSnapshotJson) {
          try {
            address = typeof o.addressSnapshotJson === 'string' ? JSON.parse(o.addressSnapshotJson) : o.addressSnapshotJson;
          } catch (e) {
            address = null;
          }
        }
        that.setData({
          order: o,
          statusInfo: util.orderStatusInfo(o.orderStatus),
          address: address,
          items: (o.items || []).map(function (it) {
            return {
              id: it.id,
              productId: it.productId,
              name: it.productName || it.skuName,
              specText: util.specText(it.specValuesJson),
              imageUrl: util.imageUrl('', it.imageOssId),
              quantity: it.quantity,
              priceYuan: util.fen2yuan(it.skuSalePrice),
              subtotalYuan: util.fen2yuan(it.subtotalAmount)
            };
          }),
          productYuan: util.fen2yuan(o.productAmount),
          freightYuan: util.fen2yuan(o.freightAmount),
          discountYuan: util.fen2yuan(o.discountAmount),
          payYuan: util.fen2yuan(o.payAmount)
        });
      })
      .catch(function () {
        wx.hideLoading();
      });
  },

  copyOrderNo: function () {
    wx.setClipboardData({ data: this.data.order.orderNo });
  },

  goGoods: function (e) {
    const pid = e.currentTarget.dataset.pid;
    if (pid) wx.navigateTo({ url: '/pages/product/detail/detail?id=' + pid });
  },

  onPayTap: function () {
    const that = this;
    const order = this.data.order;
    if (!order || !order.id) {
      wx.showToast({ title: '订单信息缺失', icon: 'none' });
      return;
    }
    if (!pay.hasPhone()) {
      wx.showModal({
        title: '需要绑定手机号',
        content: '支付前请先授权绑定微信手机号',
        confirmText: '去绑定',
        showCancel: false,
        success: function () {
          wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }
    // 先选支付方式（微信支付 / 云闪付）
    pay
      .choosePayMethod()
      .then(function (method) {
        wx.showLoading({ title: method === 'unionpay' ? '云闪付下单' : '拉起支付', mask: true });
        return pay.pay({
          payType: method,
          contactName: (that.data.address && that.data.address.contactName) || '',
          contactPhone: (that.data.address && that.data.address.contactPhone) || ''
        });
      })
      .then(function (res) {
        wx.hideLoading();
        if (res && res.unionPay) {
          wx.showToast({ title: '已返回，正在刷新订单状态', icon: 'none' });
          setTimeout(function () {
            that.loadOrder();
          }, 800);
          return;
        }
        wx.showToast({ title: '支付成功', icon: 'success' });
        that.loadOrder();
      })
      .catch(function (e) {
        wx.hideLoading();
        if (e && e.cancelled) return;
        pay.handlePayError(e);
      });
  }
});
