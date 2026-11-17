const api = require('../../utils/api');
const util = require('../../utils/util');

const HISTORY_KEY = 'searchHistory';

Page({
  data: {
    keyword: '',
    history: [],
    hot: ['洗衣液', '抽纸', '洗洁精', '喜糖礼盒', '伴手礼', '湿巾'],
    list: [],
    total: 0,
    searched: false,
    loading: false,
    finished: false,
    pageNum: 1
  },

  onLoad: function () {
    this.setData({ history: wx.getStorageSync(HISTORY_KEY) || [] });
  },

  onInput: function (e) {
    this.setData({ keyword: e.detail.value });
  },

  onConfirm: function () {
    this.doSearch();
  },

  onHotTap: function (e) {
    this.setData({ keyword: e.currentTarget.dataset.word });
    this.doSearch();
  },

  onHistoryTap: function (e) {
    this.setData({ keyword: e.currentTarget.dataset.word });
    this.doSearch();
  },

  onClearHistory: function () {
    wx.removeStorageSync(HISTORY_KEY);
    this.setData({ history: [] });
  },

  doSearch: function () {
    const kw = (this.data.keyword || '').trim();
    if (!kw) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
      return;
    }
    const history = [kw].concat(this.data.history.filter(function (h) { return h !== kw; })).slice(0, 10);
    wx.setStorageSync(HISTORY_KEY, history);
    this.setData({ history: history, searched: true, list: [], pageNum: 1, finished: false, total: 0 });
    this.loadPage();
  },

  loadPage: function () {
    const that = this;
    if (this.data.loading || this.data.finished) return;
    this.setData({ loading: true });
    api
      .getProductList({ keyword: this.data.keyword, pageNum: this.data.pageNum, pageSize: 10 })
      .then(function (res) {
        const rows = (res.rows || []).map(function (it) {
          return {
            id: it.id,
            productName: it.productName,
            thumb: util.imageUrl(it.thumbUrl, it.mainImageOssId),
            priceYuan: util.fen2yuan(it.minSalePrice),
            hasStock: it.hasStock !== false
          };
        });
        const list = that.data.list.concat(rows);
        const total = res.total || 0;
        that.setData({
          list: list,
          total: total,
          pageNum: that.data.pageNum + 1,
          finished: list.length >= total || rows.length < 10,
          loading: false
        });
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  onReachBottom: function () {
    if (this.data.searched) this.loadPage();
  },

  goDetail: function (e) {
    wx.navigateTo({ url: '/pages/product/detail/detail?id=' + e.currentTarget.dataset.id });
  },

  goBack: function () {
    wx.navigateBack();
  }
});
