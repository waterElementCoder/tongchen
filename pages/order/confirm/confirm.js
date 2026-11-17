const api = require('../../../utils/api');
const util = require('../../../utils/util');
const pay = require('../../../utils/pay');
const config = require('../../../config/config');

Page({
  data: {
    mode: 'cart',
    lines: [],
    address: null,
    remark: '',
    // 预览金额（单位分）
    productAmount: 0,
    freightAmount: 0,
    discountAmount: 0,
    payAmount: 0,
    productYuan: '0.00',
    freightYuan: '0.00',
    discountYuan: '0.00',
    payYuan: '0.00',
    previewed: false,
    submitting: false
  },

  onLoad: function (options) {
    const mode = options.mode || 'cart';
    const lines =
      mode === 'buyNow'
        ? [wx.getStorageSync('buyNowLine')].filter(Boolean)
        : wx.getStorageSync('checkoutLines') || [];
    this.setData({
      mode: mode,
      lines: lines.map(function (l) {
        return Object.assign({}, l, { priceYuan: util.fen2yuan(l.salePrice || 0), subtotalYuan: util.fen2yuan((l.salePrice || 0) * l.quantity) });
      })
    });
    this.loadAddress();
  },

  loadAddress: function () {
    const that = this;
    api
      .getAddressList()
      .then(function (list) {
        list = list || [];
        let addr = list.find(function (a) { return a.isDefault === '1' || a.isDefault === 1; });
        if (!addr && list.length > 0) addr = list[0];
        that.setData({ address: addr });
        that.preview();
      })
      .catch(function () {
        that.preview();
      });
  },

  // 金额预览
  preview: function () {
    const that = this;
    const items = this.data.lines.map(function (l) {
      return { skuId: l.skuId, quantity: l.quantity };
    });
    if (items.length === 0) return;
    const data = { items: items };
    if (this.data.address) data.addressId = this.data.address.id;
    api
      .previewOrder(data)
      .then(function (order) {
        that.applyAmounts(order);
      })
      .catch(function () {});
  },

  applyAmounts: function (order) {
    if (!order) return;
    this.setData({
      previewed: true,
      productAmount: order.productAmount || 0,
      freightAmount: order.freightAmount || 0,
      discountAmount: order.discountAmount || 0,
      payAmount: order.payAmount || 0,
      productYuan: util.fen2yuan(order.productAmount),
      freightYuan: util.fen2yuan(order.freightAmount),
      discountYuan: util.fen2yuan(order.discountAmount),
      payYuan: util.fen2yuan(order.payAmount)
    });
  },

  onRemarkInput: function (e) {
    this.setData({ remark: e.detail.value });
  },

  goChooseAddress: function () {
    wx.navigateTo({ url: '/pages/address/list/list?mode=select' });
  },

  goAddAddress: function () {
    wx.navigateTo({ url: '/pages/address/edit/edit' });
  },

  // 提交订单：联调阶段不再调用 POST /mall/app/order 创建订单，
  // 直接用写死的商城订单号（config.payMallOrderId）发起支付
  onSubmit: function () {
    const that = this;
    if (this.data.submitting) return;
    if (!this.data.address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }
    const items = this.data.lines.map(function (l) {
      return { skuId: l.skuId, quantity: l.quantity };
    });
    if (items.length === 0) {
      wx.showToast({ title: '结算商品为空', icon: 'none' });
      return;
    }
    // 未绑定手机号时先引导绑定，避免无法支付
    if (!pay.hasPhone()) {
      wx.showModal({
        title: '需要绑定手机号',
        content: '下单前请先授权绑定微信手机号',
        confirmText: '去绑定',
        showCancel: false,
        success: function () {
          wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }
    this.setData({ submitting: true });
    // 先选支付方式（微信支付 / 云闪付），再拉起对应收银台
    pay
      .choosePayMethod()
      .then(function (method) {
        that.startPay(that.data.address, method);
      })
      .catch(function (e) {
        that.setData({ submitting: false });
        if (!(e && e.cancelled)) pay.handlePayError(e);
      });
  },

  // 发起支付：绑定写死的商城订单并拉起收银台
  startPay: function (address, payType) {
    const that = this;
    // 联调写死的商城订单号，用于支付结果页跳转
    const orderId = config.payMallOrderId;
    const goResult = function (paid, pending) {
      wx.redirectTo({
        url:
          '/pages/order/result/result?paid=' +
          (paid ? '1' : '0') +
          (pending ? '&pending=1' : '') +
          '&orderId=' +
          (orderId || '')
      });
    };
    wx.showLoading({ title: payType === 'unionpay' ? '云闪付下单' : '拉起支付', mask: true });
    pay
      .pay({
        payType: payType,
        contactName: (address && address.contactName) || '',
        contactPhone: (address && address.contactPhone) || ''
      })
      .then(function (res) {
        wx.hideLoading();
        that.setData({ submitting: false });
        // 支付成功后清理来源数据
        if (that.data.mode === 'buyNow') {
          wx.removeStorageSync('buyNowLine');
        } else {
          wx.removeStorageSync('checkoutLines');
        }
        getApp().refreshCartBadge();
        // 云闪付：已从云闪付小程序返回，实际结果以订单状态为准
        if (res && res.unionPay) {
          goResult(false, true);
          return;
        }
        goResult(true);
      })
      .catch(function (e) {
        wx.hideLoading();
        that.setData({ submitting: false });
        pay.handlePayError(e);
        // 稍作停留让提示可见，再进入待支付结果页
        setTimeout(function () {
          goResult(false);
        }, 600);
      });
  }
});
