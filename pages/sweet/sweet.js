const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    products: [],   // 可选糖果/礼盒商品
    boxes: [
      { id: 'red', name: '红色喜庆礼盒', desc: '大红色烫金 · 6-8格' },
      { id: 'gold', name: '金色婚庆礼盒', desc: '香槟金 · 8-12格' },
      { id: 'simple', name: '简约手提礼盒', desc: '白绿清新 · 4-6格' }
    ],
    boxId: 'red',
    totalCount: 0,
    totalYuan: '0.00',
    loading: true,
    submitting: false
  },

  onLoad: function () {
    this.loadProducts();
  },

  loadProducts: function () {
    const that = this;
    // 优先找喜糖/礼盒类目，找不到则用关键字搜索
    api
      .getCategoryTree()
      .then(function (tree) {
        let categoryId = '';
        (tree || []).forEach(function (top) {
          if (/喜糖|礼盒|喜庆|伴手/.test(top.categoryName || '')) {
            categoryId = top.id;
            return;
          }
          (top.children || []).forEach(function (sub) {
            if (!categoryId && /喜糖|礼盒|喜庆|伴手/.test(sub.categoryName || '')) {
              categoryId = sub.id;
            }
          });
        });
        return api.getProductList(
          categoryId ? { categoryId: categoryId, pageSize: 20 } : { keyword: '喜糖', pageSize: 20 }
        );
      })
      .then(function (res) {
        const products = (res.rows || []).map(function (p) {
          return {
            id: p.id,
            productName: p.productName,
            subtitle: p.subtitle,
            thumb: util.imageUrl(p.thumbUrl, p.mainImageOssId),
            priceYuan: util.fen2yuan(p.minSalePrice),
            minSalePrice: p.minSalePrice || 0,
            quantity: 0,
            hasStock: p.hasStock !== false
          };
        });
        that.setData({ products: products, loading: false });
        that.recalc();
      })
      .catch(function () {
        that.setData({ loading: false });
      });
  },

  onBoxTap: function (e) {
    this.setData({ boxId: e.currentTarget.dataset.id });
  },

  onQtyChange: function (e) {
    const idx = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    const key = 'products[' + idx + '].quantity';
    const patch = {};
    let q = this.data.products[idx].quantity;
    if (type === 'minus' && q > 0) q -= 1;
    if (type === 'plus') q += 1;
    patch[key] = q;
    this.setData(patch);
    this.recalc();
  },

  recalc: function () {
    let count = 0;
    let amount = 0;
    this.data.products.forEach(function (p) {
      count += p.quantity;
      amount += p.minSalePrice * p.quantity;
    });
    this.setData({ totalCount: count, totalYuan: util.fen2yuan(amount) });
  },

  goDetail: function (e) {
    wx.navigateTo({
      url: '/pages/product/detail/detail?id=' + this.data.products[e.currentTarget.dataset.index].id
    });
  },

  // 加入购物车：逐个商品取首个有货 SKU 加购
  onAddCart: function () {
    const that = this;
    if (this.data.submitting) return;
    const picked = this.data.products.filter(function (p) { return p.quantity > 0; });
    if (picked.length === 0) {
      wx.showToast({ title: '请先选择糖果组合', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: '加入购物车' });

    const addToCartByProduct = function (p) {
      return api.getProductDetail(p.id).then(function (d) {
        const skus = (d.skus || []).filter(function (s) { return s.hasStock; });
        if (!skus.length) {
          return Promise.reject(new Error('「' + d.productName + '」暂时缺货'));
        }
        const sku = skus[0];
        return api
          .addToCart({ skuId: sku.id, quantity: p.quantity, selected: '1' })
          .then(function () {
            require('../../utils/sku-cache').saveSku({
              id: sku.id,
              skuNo: sku.skuNo,
              skuName: sku.skuName || d.productName,
              productId: d.id,
              productName: d.productName,
              specText: util.specText(sku.specValues),
              imageUrl: util.imageUrl(sku.imageDetailUrl, sku.imageOssId) || util.imageUrl(p.thumbUrl, p.mainImageOssId),
              salePrice: sku.salePrice
            });
          });
      });
    };

    let chain = Promise.resolve();
    let failed = '';
    picked.forEach(function (p) {
      chain = chain.then(function () {
        return addToCartByProduct(p).catch(function (err) {
          if (!failed) failed = err.message || '加购失败';
        });
      });
    });
    chain.then(function () {
      wx.hideLoading();
      that.setData({ submitting: false });
      getApp().refreshCartBadge();
      if (failed) {
        wx.showModal({
          title: '部分商品未加入',
          content: failed,
          showCancel: false
        });
      } else {
        wx.showToast({ title: '已加入购物车', icon: 'success' });
        setTimeout(function () {
          wx.switchTab({ url: '/pages/cart/cart' });
        }, 600);
      }
    });
  }
});
