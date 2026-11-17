// 商城接口层（对应后端 /mall/app 系列接口）
const { request } = require('./request');

// ---------- 首页 / 分类 ----------
// 查询商城小程序首页聚合内容
function getHome() {
  return request({ path: '/mall/app/home' });
}

// 查询商城商品分类树
function getCategoryTree() {
  return request({ path: '/mall/app/category/tree' });
}

// ---------- 商品 ----------
// 分页查询已上架商品
function getProductList(params) {
  return request({ path: '/mall/app/product/list', params: params });
}

// 查询商品详情及可售 SKU
function getProductDetail(id) {
  return request({ path: '/mall/app/product/' + id });
}

// ---------- 库存 ----------
// 单个 SKU 可售库存
function getSkuStock(skuId) {
  return request({ path: '/mall/app/stock/sku/' + skuId });
}

// 批量查询 SKU 可售库存（最多 50 个）
function batchSkuStock(skuIds) {
  return request({ path: '/mall/app/stock/batch', method: 'POST', data: { skuIds: skuIds } });
}

// ---------- 收货地址 ----------
function getAddressList() {
  return request({ path: '/mall/app/address' });
}

// 新增或保存收货地址
function saveAddress(data) {
  return request({ path: '/mall/app/address', method: 'POST', data: data });
}

function deleteAddress(id) {
  return request({ path: '/mall/app/address/' + id, method: 'DELETE' });
}

// ---------- 购物车 ----------
function getCart() {
  return request({ path: '/mall/app/cart' });
}

// 新增/更新购物车 SKU 数量
function addToCart(data) {
  return request({ path: '/mall/app/cart', method: 'POST', data: data });
}

function deleteCartItem(id) {
  return request({ path: '/mall/app/cart/' + id, method: 'DELETE' });
}

// ---------- 订单 ----------
function getOrderList() {
  return request({ path: '/mall/app/order/list' });
}

function getOrderDetail(id) {
  return request({ path: '/mall/app/order/' + id });
}

// 订单金额预览（不创建订单）
function previewOrder(data) {
  return request({ path: '/mall/app/order/preview', method: 'POST', data: data });
}

// 创建订单并锁定库存
function createOrder(data) {
  return request({ path: '/mall/app/order', method: 'POST', data: data });
}

module.exports = {
  getHome: getHome,
  getCategoryTree: getCategoryTree,
  getProductList: getProductList,
  getProductDetail: getProductDetail,
  getSkuStock: getSkuStock,
  batchSkuStock: batchSkuStock,
  getAddressList: getAddressList,
  saveAddress: saveAddress,
  deleteAddress: deleteAddress,
  getCart: getCart,
  addToCart: addToCart,
  deleteCartItem: deleteCartItem,
  getOrderList: getOrderList,
  getOrderDetail: getOrderDetail,
  previewOrder: previewOrder,
  createOrder: createOrder
};
