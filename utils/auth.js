// 登录 / 手机号绑定
// 流程与 /project/study 参考项目一致：
//   1) wx.login() 拿 code → POST /auth/xcxLogin
//      body: { code, appid, clientId, grantType, tenantId }
//      返回 data.access_token（token）+ 用户信息（phone 为空表示未绑定手机号）
//   2) <button open-type="getPhoneNumber"> 回调里取 e.detail.code
//      → POST /getPhoneNumber，body: { code, appid }，头带 Authorization
//   3) 绑定成功后静默再登录一次，刷新用户信息
const config = require('../config/config');

const TOKEN_KEY = config.tokenKey || 'token';
const USER_KEY = 'userInfo';

// 进行中的登录任务，避免并发重复调用
let loginTask = null;

// ---------- 本地存储 ----------

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setUser(user) {
  if (!user || typeof user !== 'object') return getUser();
  const merged = Object.assign({}, getUser() || {}, user);
  wx.setStorageSync(USER_KEY, merged);
  return merged;
}

function isLoggedIn() {
  return !!getToken();
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  loginTask = null;
}

// 从登录响应里取用户信息（后端可能嵌套 userInfo，也可能平铺）
function pickUser(data) {
  if (!data || typeof data !== 'object') return null;
  const user = data.userInfo || data.user || data.userData || null;
  if (user && typeof user === 'object') return Object.assign({}, data, user);
  return data;
}

function pickToken(data) {
  if (!data || typeof data !== 'object') return '';
  return data.access_token || data.accessToken || data.token || '';
}

function pickPhone(data) {
  if (!data || typeof data !== 'object') return '';
  return data.phoneNumber || data.phone || data.mobile || data.purePhoneNumber || '';
}

// ---------- 裸请求 ----------
// 登录与绑定手机号不经过 utils/request，避免循环依赖，也不触发 401 跳转
function rawRequest(opts) {
  return new Promise(function (resolve, reject) {
    const header = {
      'content-type': 'application/json',
      clientid: config.clientid
    };
    if (opts.auth !== false) {
      header.Authorization = 'Bearer ' + getToken();
    }

    let url = config.baseUrl.replace(/\/+$/, '') + opts.path;
    if (opts.withAppid) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'appid=' + encodeURIComponent(config.appid);
    }

    wx.request({
      url: url,
      method: opts.method || 'POST',
      data: opts.data || {},
      header: header,
      success: function (res) {
        const body = res.data || {};
        if (res.statusCode === 401) {
          reject(new Error('登录已过期，请重新登录'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(body.msg || '网络异常(' + res.statusCode + ')'));
          return;
        }
        const ok = body.code === 200 || body.code === 0 || body.code === undefined;
        if (!ok) {
          reject(new Error(body.msg || body.message || '请求失败'));
          return;
        }
        resolve(body.data !== undefined ? body.data : body);
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '网络连接失败'));
      }
    });
  });
}

// ---------- 登录 ----------

/**
 * 微信静默登录：wx.login → /auth/xcxLogin
 * @returns {Promise<Object>} 登录返回的 data（含 access_token 与用户信息）
 */
function login() {
  if (!config.loginUrl) {
    return Promise.reject(new Error('未配置登录接口'));
  }
  if (loginTask) return loginTask;

  loginTask = new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) {
        if (!res.code) {
          reject(new Error('获取微信登录凭证失败'));
          return;
        }
        rawRequest({
          path: config.loginUrl,
          method: 'POST',
          auth: false,
          data: {
            code: res.code,
            appid: config.appid,
            clientId: config.clientid,
            grantType: config.grantType,
            tenantId: config.tenantId
          }
        })
          .then(function (data) {
            const token = pickToken(data);
            if (!token) {
              reject(new Error('登录响应缺少 token'));
              return;
            }
            setToken(token);
            const user = pickUser(data) || {};
            if (!user.phone) {
              const phone = pickPhone(data);
              if (phone) user.phone = phone;
            }
            setUser(user);
            resolve(data || {});
          })
          .catch(reject);
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '微信登录失败'));
      }
    });
  });

  // 无论成功失败都释放任务锁
  loginTask.then(clearTask, clearTask);
  function clearTask() {
    loginTask = null;
  }
  return loginTask;
}

/**
 * 确保已登录：已有 token 直接返回，否则静默登录一次
 */
function ensureLogin() {
  if (getToken()) return Promise.resolve(getUser());
  if (!config.loginUrl) return Promise.resolve(null);
  return login();
}

/**
 * 强制刷新一次登录态（token 与用户信息）
 */
function refreshLogin() {
  wx.removeStorageSync(TOKEN_KEY);
  return login();
}

// ---------- 手机号绑定 ----------

/**
 * 绑定手机号
 * @param {String} phoneCode 按钮 open-type="getPhoneNumber" 回调的 e.detail.code
 * @returns {Promise<Object>} { phone, raw }
 */
function bindPhone(phoneCode) {
  return new Promise(function (resolve, reject) {
    if (!phoneCode) {
      reject(new Error('未获取到手机号凭证'));
      return;
    }
    if (!getToken()) {
      reject(new Error('请先登录'));
      return;
    }
    if (!config.phoneUrl) {
      reject(new Error('未配置手机号绑定接口'));
      return;
    }

    rawRequest({
      path: config.phoneUrl,
      method: 'POST',
      withAppid: true,
      data: { code: phoneCode, appid: config.appid }
    })
      .then(function (data) {
        const phone = pickPhone(data);
        if (!phone) {
          // 已绑定等场景后端可能不返回手机号，回查一次用户信息
          refreshUser().then(function () {
            resolve({ phone: (getUser() || {}).phone || '', raw: data });
          });
          return;
        }
        setUser({ phone: phone });
        resolve({ phone: phone, raw: data });
      })
      .catch(reject);
  });
}

/**
 * 静默重新登录，刷新用户信息（绑定手机号后调用）
 */
function refreshUser() {
  if (!config.loginUrl) return Promise.resolve(getUser());
  return login().then(function () {
    return getUser();
  });
}

// ---------- 退出 ----------

function logout() {
  clearAuth();
}

module.exports = {
  getToken: getToken,
  setToken: setToken,
  getUser: getUser,
  setUser: setUser,
  isLoggedIn: isLoggedIn,
  clearAuth: clearAuth,
  login: login,
  ensureLogin: ensureLogin,
  refreshLogin: refreshLogin,
  refreshUser: refreshUser,
  bindPhone: bindPhone,
  logout: logout
};
