const api = require('../../../utils/api');
const util = require('../../../utils/util');
const skuCache = require('../../../utils/sku-cache');

Page({
  data: {
    id: '',
    detail: null,
    images: [],
    skus: [],
    specs: [],
    // 已选规格值 {specName: value}
    selected: {},
    currentSku: null,
    quantity: 1,
    priceYuan: '0.00',
    marketYuan: '',
    showSkuPopup: false,
    // buy=立即购买 cart=加入购物车
    buyMode: 'cart',
    canBuy: false,
    sweetMode: false,
    stockText: '',
    loadError: false,
    errMsg: '',
    // 是否已收藏（本地记录，控制底部红心空心/实心）
    isFav: false
  },

  onLoad: function (options) {
    this.setData({ id: options.id, isFav: this.checkFav(options.id) });
    this.loadDetail(options.id);
  },

  // 读取本地收藏记录
  checkFav: function (id) {
    const favs = wx.getStorageSync('favProducts') || [];
    return favs.indexOf(id) > -1;
  },

  loadDetail: function (id) {
    const that = this;
    wx.showLoading({ title: '加载中' });
    api
      .getProductDetail(id)
      .then(function (d) {
        wx.hideLoading();
        const images = [d.mainImageDetailUrl].concat(d.albumDetailUrls || [])
          .filter(Boolean)
          .map(function (u) { return u; });
        const specs = d.specs || [];
        const skus = (d.skus || []).map(function (s) {
          return {
            id: s.id,
            skuNo: s.skuNo,
            skuName: s.skuName,
            specValues: s.specValues || {},
            salePrice: s.salePrice,
            marketPrice: s.marketPrice,
            image: util.imageUrl(s.imageDetailUrl, s.imageOssId),
            availableQuantity: s.availableQuantity,
            hasStock: s.hasStock,
            specText: util.specText(s.specValues)
          };
        });
        // 默认选中每个规格的第一项，并匹配 SKU
        const selected = {};
        specs.forEach(function (sp) {
          if (sp.specValues && sp.specValues.length > 0) selected[sp.specName] = sp.specValues[0];
        });
        const sweet =
          d.category && d.category.categoryName &&
          /喜糖|礼盒|伴手/.test(d.category.categoryName);
        that.setData({
          detail: d,
          images: images.length ? images : (d.mainImageDetailUrl ? [d.mainImageDetailUrl] : ['']),
          skus: skus,
          specs: specs,
          selected: selected,
          sweetMode: !!sweet,
          detailImages: that.parseDetailContent(d)
        });
        that.matchSku();
      })
      .catch(function (e) {
        wx.hideLoading();
        that.setData({
          loadError: true,
          errMsg: (e && e.message) || ''
        });
      });
  },

  onRetry: function () {
    this.setData({ loadError: false, errMsg: '' });
    this.loadDetail(this.data.id);
  },

  // 图文详情解析：URL 列表按图片渲染，否则按富文本
  parseDetailContent: function (d) {
    if (!d.detailContent) return [];
    const ct = (d.detailContentType || '').toLowerCase();
    const content = d.detailContent.trim();
    if (ct.indexOf('image') > -1 || /^https?:\/\//.test(content) || content.indexOf('\n') > -1) {
      return content.split(/[\n,，]/).map(function (s) { return s.trim(); }).filter(function (s) {
        return /^https?:\/\//.test(s);
      });
    }
    return [];
  },

  // 根据已选规格匹配 SKU
  matchSku: function () {
    const specs = this.data.specs;
    const selected = this.data.selected;
    const allChosen = specs.every(function (sp) { return selected[sp.specName]; });
    let sku = null;
    if (specs.length === 0) {
      sku = this.data.skus[0] || null;
    } else if (allChosen) {
      sku =
        this.data.skus.find(function (s) {
          return specs.every(function (sp) {
            return String(s.specValues[sp.specName] || '') === String(selected[sp.specName]);
          });
        }) || null;
    }
    const stockText = sku
      ? sku.hasStock
        ? '库存 ' + (sku.availableQuantity > 999 ? '999+' : sku.availableQuantity) + ' 件'
        : '该规格暂时缺货'
      : '请选择完整规格';
    this.setData({
      currentSku: sku,
      priceYuan: sku ? util.fen2yuan(sku.salePrice) : '0.00',
      marketYuan: sku && sku.marketPrice && sku.marketPrice > (sku.salePrice || 0) ? util.fen2yuan(sku.marketPrice) : '',
      canBuy: !!(sku && sku.hasStock),
      stockText: stockText
    });
  },

  onPreview: function (e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({ urls: this.data.images.filter(Boolean), current: current });
  },

  openSkuPopup: function (e) {
    this.setData({ showSkuPopup: true, buyMode: (e.currentTarget.dataset.mode || 'cart') });
  },

  closeSkuPopup: function () {
    this.setData({ showSkuPopup: false });
  },

  stopBubble: function () {},

  onSpecTap: function (e) {
    const name = e.currentTarget.dataset.name;
    const value = e.currentTarget.dataset.value;
    const selected = Object.assign({}, this.data.selected);
    selected[name] = value;
    this.setData({ selected: selected });
    this.matchSku();
  },

  onQuantityChange: function (e) {
    const type = e.currentTarget.dataset.type;
    let q = this.data.quantity;
    const max = this.data.currentSku && this.data.currentSku.availableQuantity ? this.data.currentSku.availableQuantity : 999;
    if (type === 'minus' && q > 1) q -= 1;
    if (type === 'plus' && q < max) q += 1;
    this.setData({ quantity: q });
  },

  onQuantityInput: function (e) {
    let v = parseInt(e.detail.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    const max = this.data.currentSku && this.data.currentSku.availableQuantity ? this.data.currentSku.availableQuantity : 999;
    if (v > max) v = max;
    this.setData({ quantity: v });
  },

  // 收藏（本地）
  onFavTap: function () {
    const id = this.data.id;
    let favs = wx.getStorageSync('favProducts') || [];
    const faved = favs.indexOf(id) > -1;
    if (faved) {
      favs = favs.filter(function (f) { return f !== id; });
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      favs.unshift(id);
      wx.showToast({ title: '已收藏', icon: 'success' });
    }
    wx.setStorageSync('favProducts', favs);
    // 同步界面状态：未收藏空心红心 / 已收藏实心红心
    this.setData({ isFav: !faved });
  },

  goCart: function () {
    wx.switchTab({ url: '/pages/cart/cart' });
  },

  onSweetTap: function () {
    wx.navigateTo({ url: '/pages/sweet/sweet' });
  },

  // 弹窗内确认
  onConfirmSku: function () {
    const sku = this.data.currentSku;
    if (!sku) {
      wx.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    if (!sku.hasStock) {
      wx.showToast({ title: '该规格暂时缺货', icon: 'none' });
      return;
    }
    if (this.data.buyMode === 'cart') {
      this.addToCart(sku);
    } else {
      this.buyNow(sku);
    }
  },

  buildSkuSnapshot: function (sku) {
    const d = this.data.detail;
    return {
      id: sku.id,
      skuNo: sku.skuNo,
      skuName: sku.skuName || d.productName,
      productId: d.id,
      productName: d.productName,
      specText: sku.specText,
      imageUrl: sku.image || this.data.images[0] || '',
      salePrice: sku.salePrice
    };
  },

  addToCart: function (sku) {
    const that = this;
    api
      .addToCart({ skuId: sku.id, quantity: this.data.quantity, selected: '1' })
      .then(function () {
        skuCache.saveSku(that.buildSkuSnapshot(sku));
        wx.showToast({ title: '已加入购物车', icon: 'success' });
        that.setData({ showSkuPopup: false });
        getApp().refreshCartBadge();
      });
  },

  buyNow: function (sku) {
    skuCache.saveSku(this.buildSkuSnapshot(sku));
    const line = {
      skuId: sku.id,
      quantity: this.data.quantity,
      // 快照字段用于确认订单页展示
      skuName: sku.skuName || this.data.detail.productName,
      productName: this.data.detail.productName,
      specText: sku.specText,
      imageUrl: sku.image || this.data.images[0] || '',
      salePrice: sku.salePrice
    };
    wx.setStorageSync('buyNowLine', line);
    this.setData({ showSkuPopup: false });
    wx.navigateTo({ url: '/pages/order/confirm/confirm?mode=buyNow' });
  }
});
