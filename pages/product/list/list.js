const api = require('../../../utils/api');
const util = require('../../../utils/util');

const PAGE_SIZE = 10;

Page({
  data: {
    title: '商品列表',
    categoryId: '',
    keyword: '',
    sort: 'default', // default | sales | priceAsc | priceDesc
    list: [],
    pageNum: 1,
    total: 0,
    finished: false,
    loading: false
  },

  onLoad: function (options) {
    const data = {
      categoryId: options.categoryId || '',
      keyword: options.keyword || ''
    };
    if (options.title) {
      data.title = decodeURIComponent(options.title);
    }
    wx.setNavigationBarTitle({ title: data.title });
    this.setData(data);
    this.reload();
  },

  onShow: function () {},

  reload: function () {
    this.setData({ list: [], pageNum: 1, finished: false, total: 0 });
    this.loadPage();
  },

  loadPage: function () {
    const that = this;
    if (this.data.loading || this.data.finished) return Promise.resolve();
    this.setData({ loading: true });
    const params = {
      pageNum: this.data.pageNum,
      pageSize: PAGE_SIZE
    };
    if (this.data.categoryId) params.categoryId = this.data.categoryId;
    if (this.data.keyword) params.keyword = this.data.keyword;
    if (this.data.sort === 'sales') {
      params.orderByColumn = 'saleCount';
      params.isAsc = 'desc';
    } else if (this.data.sort === 'priceAsc') {
      params.orderByColumn = 'minSalePrice';
      params.isAsc = 'asc';
    } else if (this.data.sort === 'priceDesc') {
      params.orderByColumn = 'minSalePrice';
      params.isAsc = 'desc';
    }
    return api
      .getProductList(params)
      .then(function (res) {
        const rows = (res.rows || []).map(function (it) {
          return {
            id: it.id,
            productName: it.productName,
            subtitle: it.subtitle,
            thumb: util.imageUrl(it.thumbUrl, it.mainImageOssId),
            priceYuan: util.fen2yuan(it.minSalePrice),
            saleCount: it.saleCount || 0,
            hasStock: it.hasStock !== false
          };
        });
        const list = that.data.list.concat(rows);
        const total = res.total || 0;
        that.setData({
          list: list,
          total: total,
          pageNum: that.data.pageNum + 1,
          finished: list.length >= total || rows.length < PAGE_SIZE,
          loading: false
        });
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  onSortTap: function (e) {
    const key = e.currentTarget.dataset.key;
    let sort = key;
    if (key === 'price') {
      sort = this.data.sort === 'priceAsc' ? 'priceDesc' : 'priceAsc';
    }
    this.setData({ sort: sort });
    this.reload();
  },

  onReachBottom: function () {
    this.loadPage();
  },

  onPullDownRefresh: function () {
    this.reload();
    wx.stopPullDownRefresh();
  },

  goDetail: function (e) {
    wx.navigateTo({ url: '/pages/product/detail/detail?id=' + e.currentTarget.dataset.id });
  }
});
