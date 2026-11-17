// 微信 JSAPI 支付（POST /pay/wxJsapi）
// 请求体（与后端 MallPay 约定一致）：
//   {
//     customerIp, subAppid, subOpenid,
//     contactName, contactPhone, shareOpenid,
//     tenantId,                              // 业务租户标识，后端据此路由到商城支付
//     bizJsonStr: JSON.stringify({
//       requestId,                           // 预支付唯一请求号
//       mallOrderId                          // 已有商城订单号（联调阶段写死，见 config.payMallOrderId）
//     })
//   }
// 注：openid 字段按后端要求暂不传，统一用 subOpenid 作为支付用户标识
//
// ---------- 云闪付（云微笔笔付）----------
// 与微信支付同一个接口，只在请求体里多传 payType: 'UnionPayAppMini'，
// 返回 data = { cqpMpAppId, qpMpPath }，用 wx.navigateToMiniProgram 跳到云闪付小程序完成付款；
// 从云闪付小程序返回本小程序时场景值 scene = 1038，据此刷新订单状态。
// 注意：前端不再调用 POST /mall/app/order 创建订单，直接绑定已有商城订单支付
// 响应 data.wcPayData 为 JSON 字符串（timeStamp/nonceStr/package/signType/paySign）
// 后端未绑手机号时返回 msg = bind-mobile-number
const config = require('../config/config');
const auth = require('./auth');
const { request } = require('./request');

// 预支付唯一请求号：wx-yyyyMMdd-xxxxx
function genRequestId() {
  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }
  const d = new Date();
  const dateStr = '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  return 'wx-' + dateStr + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getLocalIp() {
  return new Promise(function (resolve) {
    if (!wx.getLocalIPAddress) {
      resolve('0.0.0.0');
      return;
    }
    wx.getLocalIPAddress({
      success: function (res) {
        resolve(res.localip || '0.0.0.0');
      },
      fail: function () {
        resolve('0.0.0.0');
      }
    });
  });
}

// 从响应中提取 wx.requestPayment 所需参数
function extractPayParams(data) {
  let raw = data;
  if (raw && typeof raw.wcPayData === 'string') {
    try {
      raw = JSON.parse(raw.wcPayData);
    } catch (e) {
      raw = null;
    }
  } else if (raw && raw.wcPayData && typeof raw.wcPayData === 'object') {
    raw = raw.wcPayData;
  }
  if (!raw || typeof raw !== 'object') return null;
  const pkg = raw.package || raw.packageVal || (raw.prepayId ? 'prepay_id=' + raw.prepayId : '');
  const params = {
    timeStamp: raw.timeStamp || raw.timestamp || raw.time_stamp,
    nonceStr: raw.nonceStr || raw.nonce_str,
    package: pkg,
    signType: raw.signType || 'RSA',
    paySign: raw.paySign
  };
  if (!params.timeStamp || !params.nonceStr || !params.package || !params.paySign) {
    return null;
  }
  return params;
}

// 从云闪付下单响应中提取跳转云闪付小程序所需参数
function extractUnionParams(data) {
  if (!data || typeof data !== 'object') return null;
  const appId = data.cqpMpAppId || data.cqpMpAppid || data.cqpAppId || data.mpAppId;
  const path = data.qpMpPath || data.qpMpAppPath || data.mpPath;
  if (!appId || !path) return null;
  return { appId: appId, path: path };
}

// 拉起云闪付小程序（wx.navigateToMiniProgram 需在用户手势中触发，用弹窗承接）
// resolve({ unionPay: true }) 表示已从云闪付小程序返回，需自行查询订单状态
function launchUnionPay(data) {
  const params = extractUnionParams(data);
  if (!params) {
    return Promise.reject(new Error('云闪付支付参数缺失，请稍后重试'));
  }
  return new Promise(function (resolve, reject) {
    // 监听从云闪付小程序返回（场景值 1038）
    let handler = null;
    function unwatch() {
      if (handler && wx.offAppShow) {
        wx.offAppShow(handler);
      }
      handler = null;
    }
    wx.showModal({
      title: '云闪付支付',
      content: '即将跳转到云闪付小程序完成支付，付款后会自动回到本小程序。',
      confirmText: '去支付',
      cancelText: '取消',
      success: function (res) {
        if (!res.confirm) {
          const e = new Error('已取消支付');
          e.cancelled = true;
          reject(e);
          return;
        }
        handler = function (showRes) {
          if (showRes && showRes.scene === 1038) {
            unwatch();
            resolve({ unionPay: true });
          }
        };
        if (wx.onAppShow) {
          wx.onAppShow(handler);
        }
        wx.navigateToMiniProgram({
          appId: params.appId,
          path: params.path,
          fail: function () {
            unwatch();
            reject(new Error('跳转云闪付失败，请稍后重试'));
          }
        });
      },
      fail: function () {
        const e = new Error('已取消支付');
        e.cancelled = true;
        reject(e);
      }
    });
  });
}

/**
 * 发起支付
 * @param {Object} opts
 * @param {String} [opts.payType] 支付方式：'wxpay'（默认）/ 'unionpay'（云闪付）
 * @param {String} [opts.contactName] 联系人（缺省取用户昵称）
 * @param {String} [opts.contactPhone] 联系电话（缺省取用户绑定手机号）
 * @returns {Promise} 微信支付成功 resolve；云闪付返回 resolve({unionPay:true})；
 *                    取消 reject(err.cancelled=true)；其余 reject(Error)
 */
function pay(opts) {
  opts = opts || {};
  const unionPay = opts.payType === 'unionpay';
  return auth.ensureLogin().then(function () {
    const user = auth.getUser() || {};
    const openid = user.openid || user.openId || user.subOpenid || '';
    if (!openid) {
      const err = new Error('登录信息缺少 openid，无法发起支付');
      err.needRelogin = true;
      throw err;
    }

    // 联调临时方案：mallOrderId 写死（config.payMallOrderId），不走创建订单链路
    const biz = {
      requestId: genRequestId(),
      mallOrderId: config.payMallOrderId
    };

    return getLocalIp().then(function (ip) {
      const payload = {
        customerIp: ip,
        // openid 暂不传（后端联调确认以 subOpenid 为准，避免「appid和openid不匹配」）
        subAppid: config.appid,
        subOpenid: openid,
        contactName: opts.contactName || user.nickname || user.nickName || '日喜用户',
        contactPhone: opts.contactPhone || user.phone || '',
        shareOpenid: '',
        tenantId: config.payTenantId || '',
        bizJsonStr: JSON.stringify(biz)
      };
      // 云闪付：同一接口多传 payType，后端返回 cqpMpAppId / qpMpPath
      if (unionPay) {
        payload.payType = 'UnionPayAppMini';
      }
      return request({
        path: config.payUrl,
        method: 'POST',
        silent: true,
        data: payload
      });
    }).then(function (data) {
      if (unionPay) {
        return launchUnionPay(data);
      }
      const params = extractPayParams(data);
      if (!params) {
        throw new Error('支付参数缺失，请稍后重试');
      }
      return new Promise(function (resolve, reject) {
        wx.requestPayment({
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
          success: function (res) {
            resolve(res);
          },
          fail: function (err) {
            const e = new Error('支付未完成');
            e.cancelled = !!(err && err.errMsg && err.errMsg.indexOf('cancel') >= 0);
            reject(e);
          }
        });
      });
    });
  });
}

// 统一处理支付失败提示；需要绑手机号时引导用户去绑定
function handlePayError(e) {
  const msg = (e && e.message) || '';
  if (msg.indexOf('bind-mobile') >= 0) {
    wx.showModal({
      title: '需要绑定手机号',
      content: '支付前请先授权绑定微信手机号',
      confirmText: '去绑定',
      showCancel: false,
      success: function () {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    });
    return;
  }
  if (e && e.needRelogin) {
    wx.showModal({
      title: '登录信息失效',
      content: msg,
      confirmText: '重新登录',
      showCancel: false,
      success: function () {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    });
    return;
  }
  if (e && e.cancelled) {
    wx.showToast({ title: '已取消支付', icon: 'none' });
    return;
  }
  wx.showToast({ title: msg || '支付失败，请重试', icon: 'none' });
}

// 是否已绑定手机号（下单前主动校验，避免产生无法支付的订单）
function hasPhone() {
  const user = auth.getUser() || {};
  return !!user.phone;
}

// 选择支付方式：resolve('wxpay' | 'unionpay')，用户取消时 reject(err.cancelled=true)
function choosePayMethod() {
  return new Promise(function (resolve, reject) {
    wx.showActionSheet({
      itemList: ['微信支付', '云闪付支付'],
      success: function (res) {
        resolve(res.tapIndex === 1 ? 'unionpay' : 'wxpay');
      },
      fail: function () {
        const e = new Error('已取消支付');
        e.cancelled = true;
        reject(e);
      }
    });
  });
}

module.exports = {
  pay: pay,
  handlePayError: handlePayError,
  hasPhone: hasPhone,
  choosePayMethod: choosePayMethod
};
