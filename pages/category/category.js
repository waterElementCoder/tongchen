const api = require('../../utils/api');

Page({
  data: {
    categories: [],
    current: 0,
    loading: true
  },

  onLoad: function () {
    this.loadTree();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  loadTree: function () {
    const that = this;
    this.setData({ loading: true });
    api
      .getCategoryTree()
      .then(function (tree) {
        tree = tree || [];
        // 只展示有子分类或自身可点的顶级分类
        tree = tree.map(function (item) {
          return {
            id: item.id,
            categoryName: item.categoryName,
            children: item.children || []
          };
        });
        that.setData({ categories: tree, current: 0, loading: false });
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  onPrimaryTap: function (e) {
    this.setData({ current: Number(e.currentTarget.dataset.index) });
  },

  onSecondaryTap: function (e) {
    const item = e.currentTarget.dataset.item;
    const primary = this.data.categories[this.data.current];
    wx.navigateTo({
      url:
        '/pages/product/list/list?categoryId=' +
        item.id +
        '&title=' +
        encodeURIComponent((primary ? primary.categoryName + ' · ' : '') + item.categoryName)
    });
  },

  goSearch: function () {
    wx.navigateTo({ url: '/pages/search/search' });
  }
});
