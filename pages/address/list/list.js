const api = require('../../../utils/api');
const util = require('../../../utils/util');

Page({
  data: {
    mode: 'view', // view | select
    list: [],
    loading: true
  },

  onLoad: function (options) {
    this.setData({ mode: options.mode === 'select' ? 'select' : 'view' });
  },

  onShow: function () {
    this.loadList();
  },

  loadList: function () {
    const that = this;
    this.setData({ loading: true });
    api
      .getAddressList()
      .then(function (list) {
        list = (list || []).map(function (a) {
          return Object.assign({}, a, {
            line: util.addressLine(a),
            isDefaultFlag: a.isDefault === '1' || a.isDefault === 1
          });
        });
        that.setData({ list: list, loading: false });
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  // 选择模式：点击地址直接回传
  onSelect: function (e) {
    if (this.data.mode !== 'select') return;
    const item = this.data.list[e.currentTarget.dataset.index];
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev && typeof prev.onAddressSelected === 'function') {
      prev.onAddressSelected(item);
    }
    wx.navigateBack();
  },

  goEdit: function (e) {
    const item = this.data.list[e.currentTarget.dataset.index];
    wx.navigateTo({ url: '/pages/address/edit/edit?id=' + item.id });
  },

  goAdd: function () {
    wx.navigateTo({ url: '/pages/address/edit/edit' });
  },

  onDelete: function (e) {
    const that = this;
    const item = this.data.list[e.currentTarget.dataset.index];
    wx.showModal({
      title: '删除地址',
      content: '确定删除「' + item.receiverName + '」的地址吗？',
      success: function (res) {
        if (!res.confirm) return;
        api
          .deleteAddress(item.id)
          .then(function () {
            wx.showToast({ title: '已删除', icon: 'success' });
            that.loadList();
          });
      }
    });
  }
});
