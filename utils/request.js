// 网络请求封装
// 所有商城接口约定：
//   - 每个请求 query 携带 appid
//   - 请求头携带 Authorization: Bearer <token> 与 clientid
//   - 响应为 { code, msg, data } 或分页 { total, rows, code, msg }
const config = require('../config/config');
const auth = require('./auth');

const TOKEN_KEY = config.tokenKey || 'token';

function getToken() {
  return auth.getToken();
}

function setToken(token) {
  auth.setToken(token);
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
}

function isLoggedIn() {
  return auth.isLoggedIn();
}

function buildQuery(params) {
  const qs = Object.keys(params || {})
    .filter(function (k) {
      return params[k] !== undefined && params[k] !== null && params[k] !== '';
    })
    .map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    })
    .join('&');
  return qs ? '?' + qs : '';
}

function goLogin() {
  const pages = getCurrentPages();
  const current = pages.length ? pages[pages.length - 1].route : '';
  if (current === 'pages/login/login') return;
  wx.navigateTo({ url: '/pages/login/login' });
}

/**
 * 发起请求
 * @param {Object} opts
 * @param {string} opts.path 接口路径，如 /mall/app/home
 * @param {string} [opts.method] GET/POST/PUT/DELETE
 * @param {Object} [opts.data] 请求体（POST/PUT）
 * @param {Object} [opts.params] query 参数（自动附加 appid）
 * @param {boolean} [opts.auth] 是否需要登录态，默认 true
 * @param {boolean} [opts.silent] 出错时是否不弹 toast
 * @returns {Promise<any>} 解析后的 data（分页接口返回完整对象）
 */
function request(opts) {
  const needAuth = opts.auth !== false;
  // 需要登录态但本地没有 token 时，先静默登录一次（登录接口未配置则跳过）
  if (needAuth && !auth.getToken() && config.loginUrl) {
    return auth
      .ensureLogin()
      .catch(function () {
        return null;
      })
      .then(function () {
        return send(opts, false);
      });
  }
  return send(opts, false);
}

function send(opts, retried) {
  const method = (opts.method || 'GET').toUpperCase();
  const authNeeded = opts.auth !== false;
  const params = Object.assign({ appid: config.appid }, opts.params || {});
  const url = config.baseUrl.replace(/\/+$/, '') + opts.path + buildQuery(params);

  const header = {
    'content-type': 'application/json',
    clientid: config.clientid
  };
  if (authNeeded) {
    header.Authorization = 'Bearer ' + auth.getToken();
  }

  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: method,
      data: opts.data || {},
      header: header,
      success: function (res) {
        if (res.statusCode === 401) {
          auth.clearAuth();
          // 登录态失效：静默重登后重试一次
          if (!retried && config.loginUrl) {
            auth
              .login()
              .then(function () {
                resolve(send(opts, true));
              })
              .catch(function () {
                if (!opts.silent) wx.showToast({ title: '请先登录', icon: 'none' });
                goLogin();
                reject(new Error('未登录或登录已过期'));
              });
            return;
          }
          if (!opts.silent) {
            wx.showToast({ title: '请先登录', icon: 'none' });
          }
          goLogin();
          reject(new Error('未登录或登录已过期'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          if (!opts.silent) {
            wx.showToast({ title: '网络异常(' + res.statusCode + ')', icon: 'none' });
          }
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const body = res.data || {};
        const okCode = body.code === 200 || body.code === 0 || body.code === undefined;
        if (!okCode) {
          if (!opts.silent) {
            wx.showToast({ title: body.msg || body.message || '请求失败', icon: 'none' });
          }
          reject(new Error(body.msg || '请求失败'));
          return;
        }
        resolve(body.data !== undefined ? body.data : body);
      },
      fail: function (err) {
        if (!opts.silent) {
          wx.showToast({ title: '网络连接失败', icon: 'none' });
        }
        reject(err);
      }
    });
  });
}

module.exports = {
  request: request,
  getToken: getToken,
  setToken: setToken,
  clearToken: clearToken,
  isLoggedIn: isLoggedIn
};
