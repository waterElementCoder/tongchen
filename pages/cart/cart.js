const api = require('../../utils/api');
const util = require('../../utils/util');
const skuCache = require('../../utils/sku-cache');

Page({
  data: {
    items: [],
    allSelected: true,
    totalCount: 0,
    totalYuan: '0.00',
    loading: true,
    editing: false
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    const auth = require('../../utils/auth');
    // 需要登录态：没有 token 时先静默登录（登录接口未配置则直接进空态）
    auth
      .ensureLogin()
      .catch(function () {
        return null;
      })
      .then(() => {
        if (!auth.getToken()) {
          this.setData({ items: [], loading: false });
          return;
        }
        this.loadCart();
      });
  },

  loadCart: function () {
    const that = this;
    this.setData({ loading: true });
    api
      .getCart()
      .then(function (list) {
        that.decorate(list || []);
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  // 合并本地 SKU 快照与库存
  decorate: function (cartList) {
    const that = this;
    const skuIds = cartList.map(function (it) { return it.skuId; });
    const stockPromise = skuIds.length > 0
      ? api.batchSkuStock(skuIds).catch(function () { return []; })
      : Promise.resolve([]);
    stockPromise.then(function (stocks) {
      const stockMap = {};
      (stocks || []).forEach(function (s) { stockMap[s.skuId] = s; });
      const items = cartList.map(function (it) {
        const snap = skuCache.getSku(it.skuId) || {};
        const stock = stockMap[it.skuId] || {};
        return {
          id: it.id,
          skuId: it.skuId,
          quantity: it.quantity,
          selected: it.selected === '1' || it.selected === 1 || it.selected === true,
          name: snap.skuName || snap.productName || ('SKU ' + it.skuId),
          specText: snap.specText || '',
          imageUrl: snap.imageUrl || '',
          priceYuan: util.fen2yuan(snap.salePrice || 0),
          salePrice: snap.salePrice || 0,
          hasStock: stock.hasStock !== false,
          missing: !snap.id
        };
      });
      that.setData({ items: items, loading: false });
      that.recalc();
    });
  },

  recalc: function () {
    let count = 0;
    let amount = 0;
    let all = this.data.items.length > 0;
    this.data.items.forEach(function (it) {
      count += it.quantity;
      if (it.selected && it.hasStock) {
        amount += it.salePrice * it.quantity;
      }
      if (!it.selected) all = false;
    });
    this.setData({
      totalCount: count,
      totalYuan: util.fen2yuan(amount),
      allSelected: all
    });
  },

  onToggle: function (e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.items[idx];
    const that = this;
    const selected = item.selected ? '0' : '1';
    api
      .addToCart({ skuId: item.skuId, quantity: item.quantity, selected: selected })
      .then(function () {
        const key = 'items[' + idx + '].selected';
        const patch = {};
        patch[key] = !item.selected;
        that.setData(patch);
        that.recalc();
      });
  },

  onToggleAll: function () {
    const that = this;
    const target = !this.data.allSelected;
    const selected = target ? '1' : '0';
    Promise.all(
      this.data.items.map(function (it) {
        if (it.selected === target) return Promise.resolve();
        return api.addToCart({ skuId: it.skuId, quantity: it.quantity, selected: selected });
      })
    )
      .then(function () {
        that.loadCart();
      })
      .catch(function () {});
  },

  onQtyChange: function (e) {
    const idx = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    const item = this.data.items[idx];
    let q = item.quantity;
    if (type === 'minus' && q <= 1) {
      wx.showToast({ title: '最少保留 1 件，可长按删除', icon: 'none' });
      return;
    }
    q = type === 'minus' ? q - 1 : q + 1;
    if (item.stockLimit && q > item.stockLimit) {
      wx.showToast({ title: '超出可售库存', icon: 'none' });
      return;
    }
    const that = this;
    api
      .addToCart({ skuId: item.skuId, quantity: q, selected: item.selected ? '1' : '0' })
      .then(function () {
        const patch = {};
        patch['items[' + idx + '].quantity'] = q;
        that.setData(patch);
        that.recalc();
      });
  },

  onDelete: function (e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.items[idx];
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定删除该商品吗？',
      success: function (res) {
        if (!res.confirm) return;
        api
          .deleteCartItem(item.id)
          .then(function () {
            skuCache.removeSku(item.skuId);
            wx.showToast({ title: '已删除', icon: 'success' });
            that.loadCart();
            getApp().refreshCartBadge();
          });
      }
    });
  },

  goDetail: function (e) {
    const item = this.data.items[e.currentTarget.dataset.index];
    if (item.productId) {
      wx.navigateTo({ url: '/pages/product/detail/detail?id=' + item.productId });
    }
  },

  goLogin: function () {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goCheckout: function () {
    const lines = this.data.items
      .filter(function (it) { return it.selected && it.hasStock; })
      .map(function (it) {
        return {
          skuId: it.skuId,
          quantity: it.quantity,
          skuName: it.name,
          specText: it.specText,
          imageUrl: it.imageUrl,
          salePrice: it.salePrice
        };
      });
    if (lines.length === 0) {
      wx.showToast({ title: '请选择要结算的商品', icon: 'none' });
      return;
    }
    wx.setStorageSync('checkoutLines', lines);
    wx.navigateTo({ url: '/pages/order/confirm/confirm?mode=cart' });
  }
});
