const api = require('../../../utils/api');
const util = require('../../../utils/util');

const TABS = [
  { key: 'all', name: '全部' },
  { key: 'pay', name: '待支付' },
  { key: 'ship', name: '待发货' },
  { key: 'receive', name: '待收货' },
  { key: 'done', name: '已完成' }
];

Page({
  data: {
    tabs: TABS,
    current: 'all',
    orders: [],
    filtered: [],
    loading: true
  },

  onLoad: function (options) {
    if (options.status) this.setData({ current: options.status });
  },

  onShow: function () {
    this.loadOrders();
  },

  loadOrders: function () {
    const that = this;
    this.setData({ loading: true });
    api
      .getOrderList()
      .then(function (list) {
        const orders = (list || []).map(function (o) {
          const status = util.orderStatusInfo(o.orderStatus);
          return {
            id: o.id,
            orderNo: o.orderNo,
            statusText: status.text,
            statusType: status.type,
            payYuan: util.fen2yuan(o.payAmount),
            productCount: (o.items || []).reduce(function (s, it) { return s + (it.quantity || 0); }, 0),
            createTime: o.createTime,
            items: (o.items || []).map(function (it) {
              return {
                id: it.id,
                skuId: it.skuId,
                productId: it.productId,
                name: it.productName || it.skuName,
                specText: util.specText(it.specValuesJson),
                imageUrl: util.imageUrl('', it.imageOssId),
                quantity: it.quantity,
                priceYuan: util.fen2yuan(it.skuSalePrice)
              };
            })
          };
        });
        that.setData({ orders: orders, loading: false });
        that.filter();
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  filter: function () {
    const cur = this.data.current;
    const orders = this.data.orders.filter(function (o) {
      return cur === 'all' || o.statusType === cur;
    });
    this.setData({ filtered: orders });
  },

  onTabTap: function (e) {
    this.setData({ current: e.currentTarget.dataset.key });
    this.filter();
  },

  goDetail: function (e) {
    wx.navigateTo({ url: '/pages/order/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
