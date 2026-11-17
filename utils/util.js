// 通用工具：金额/图片/状态映射
const config = require('../config/config');

// 接口金额字段为整数（单位：分），统一转元显示
function fen2yuan(fen) {
  if (fen === undefined || fen === null || isNaN(fen)) return '0.00';
  return (Number(fen) / 100).toFixed(2);
}

// 图片地址：优先用接口返回的 url，否则用 ossPrefix + ossId 拼接
function imageUrl(url, ossId) {
  if (url) return url;
  if (ossId && config.ossPrefix) return config.ossPrefix + ossId;
  return '';
}

// 订单状态映射（后端枚举确认后可在此调整）
const ORDER_STATUS = {
  '0': { text: '待支付', type: 'pay' },
  '1': { text: '待发货', type: 'ship' },
  '2': { text: '待收货', type: 'receive' },
  '3': { text: '已完成', type: 'done' },
  '4': { text: '已取消', type: 'cancel' },
  '5': { text: '售后中', type: 'refund' },
  '10': { text: '待支付', type: 'pay' },
  '20': { text: '待发货', type: 'ship' },
  '30': { text: '待收货', type: 'receive' },
  '40': { text: '已完成', type: 'done' },
  '50': { text: '已取消', type: 'cancel' },
  'UNPAID': { text: '待支付', type: 'pay' },
  'PAID': { text: '待发货', type: 'ship' },
  'SHIPPED': { text: '待收货', type: 'receive' },
  'COMPLETED': { text: '已完成', type: 'done' },
  'CANCELLED': { text: '已取消', type: 'cancel' }
};

function orderStatusInfo(status) {
  return ORDER_STATUS[String(status)] || { text: String(status || ''), type: 'other' };
}

// SKU 规格文案：specValues 为 {key: value} 对象或 JSON 字符串
function specText(specValues) {
  let obj = specValues;
  if (typeof specValues === 'string') {
    try {
      obj = JSON.parse(specValues);
    } catch (e) {
      return specValues;
    }
  }
  if (!obj || typeof obj !== 'object') return '';
  return Object.keys(obj)
    .map(function (k) {
      return obj[k];
    })
    .join(' / ');
}

// 地址格式化
function addressLine(addr) {
  if (!addr) return '';
  return [addr.provinceName, addr.cityName, addr.districtName, addr.detailAddress]
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  fen2yuan: fen2yuan,
  imageUrl: imageUrl,
  orderStatusInfo: orderStatusInfo,
  specText: specText,
  addressLine: addressLine
};
