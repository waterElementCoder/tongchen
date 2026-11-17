const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    banners: [],
    categoryEntries: [],
    hotProducts: [],
    newProducts: [],
    recommendProducts: [],
    loading: true
  },

  onLoad: function () {
    this.loadHome();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  loadHome: function () {
    const that = this;
    this.setData({ loading: true });
    api
      .getHome()
      .then(function (data) {
        data = data || {};
        that.setData({
          banners: that.decorate(data.banners || []),
          categoryEntries: that.decorate((data.categoryEntries || []).slice(0, 5)),
          hotProducts: that.decorate(data.hotProducts || []),
          newProducts: that.decorate(data.newProducts || []),
          recommendProducts: that.decorate(data.recommendProducts || []),
          loading: false
        });
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  // 首页内容项补齐展示字段
  decorate: function (list) {
    return (list || []).map(function (item) {
      item.cover = util.imageUrl(item.imageUrl, item.imageOssId);
      return item;
    });
  },

  onSearchTap: function () {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 双专区入口
  onZoneTap: function (e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'daily') {
      wx.switchTab({ url: '/pages/category/category' });
    } else {
      wx.navigateTo({ url: '/pages/sweet/sweet' });
    }
  },

  onEntryTap: function (e) {
    const item = e.currentTarget.dataset.item;
    this.goTarget(item);
  },

  onBannerTap: function (e) {
    const item = e.currentTarget.dataset.item;
    this.goTarget(item);
  },

  onProductTap: function (e) {
    const item = e.currentTarget.dataset.item;
    this.goTarget(item);
  },

  goTarget: function (item) {
    if (!item) return;
    const type = item.targetType || '';
    if (type.toUpperCase().indexOf('PRODUCT') > -1 && item.targetId) {
      wx.navigateTo({ url: '/pages/product/detail/detail?id=' + item.targetId });
      return;
    }
    if (type.toUpperCase().indexOf('CATEGORY') > -1 && item.targetId) {
      wx.navigateTo({ url: '/pages/product/list/list?categoryId=' + item.targetId + '&title=' + (item.title || '商品列表') });
      return;
    }
    if (item.targetUrl) {
      wx.navigateTo({ url: item.targetUrl });
      return;
    }
    wx.switchTab({ url: '/pages/category/category' });
  }
});
