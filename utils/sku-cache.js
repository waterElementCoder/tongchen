// 购物车 SKU 本地快照
// 服务端购物车只保存 skuId/quantity/selected，不含商品名称、图片、价格，
// 因此加入购物车时把 SKU 信息缓存在本地，购物车页展示时合并。
const SKU_CACHE_KEY = 'skuCache';

function readCache() {
  return wx.getStorageSync(SKU_CACHE_KEY) || {};
}

function saveSku(sku) {
  if (!sku || !sku.id) return;
  const cache = readCache();
  cache[String(sku.id)] = {
    id: sku.id,
    skuNo: sku.skuNo || '',
    skuName: sku.skuName || '',
    productId: sku.productId || sku.id,
    productName: sku.productName || '',
    specText: sku.specText || '',
    imageUrl: sku.imageUrl || '',
    salePrice: sku.salePrice || 0
  };
  wx.setStorageSync(SKU_CACHE_KEY, cache);
}

function getSku(skuId) {
  return readCache()[String(skuId)] || null;
}

function removeSku(skuId) {
  const cache = readCache();
  delete cache[String(skuId)];
  wx.setStorageSync(SKU_CACHE_KEY, cache);
}

module.exports = {
  saveSku: saveSku,
  getSku: getSku,
  removeSku: removeSku
};
