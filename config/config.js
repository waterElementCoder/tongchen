// 全局配置：后端地址、小程序标识与认证接口
// 正式环境：https://jbjxcx.djv5.site（https，已在公众平台配置 request 合法域名）
module.exports = {
  // 后端网关地址（不带末尾斜杠）
  // 原临时联调环境 http://47.121.206.64:8080 已切换为正式 https 域名
  baseUrl: 'https://jbjxcx.djv5.site',
  // 小程序 appid：登录请求体里的 appid，同时作为每个商城接口的 query 参数
  appid: 'wx52002b4a5c001233',
  // clientid：请求头 clientid，登录请求体里叫 clientId
  clientid: 'f83fecb04d418f847763968eeccf9914',

  // ---------- 认证（与 /project/study 参考项目保持一致）----------
  // 微信小程序登录：wx.login 的 code 换取 access_token
  // 置空则登录页进入「开发模式」（手动粘贴 token）
  loginUrl: '/auth/xcxLogin',
  // 手机号绑定：按钮 open-type="getPhoneNumber" 返回的 code 换取手机号
  phoneUrl: '/getPhoneNumber',
  // 登录请求体固定参数
  grantType: 'xcx',
  tenantId: '144033',
  // 本地存储 token 的 key
  tokenKey: 'token',

  // 微信 JSAPI 支付下单接口（POST，bizJsonStr 里支持 mallOrderId 绑定已有订单，
  // 或 addressId+items 直接创建商城订单；见 utils/pay.js）
  payUrl: '/pay/wxJsapi',
  // 支付接口的业务租户标识：后端用它在 /pay/wxJsapi 内区分商城支付与其他业务支付
  // （不传会被路由到「活动报名」支付处理器，返回「报名日期不能为空」）
  payTenantId: '842681',
  // 联调阶段写死的商城订单号：/pay/wxJsapi 的 bizJsonStr.mallOrderId 固定传这个值，
  // 前端不再调用 POST /mall/app/order 创建订单（后端联调临时方案，正式版需移除）
  payMallOrderId: '2116857524786384897',
  // 图片资源地址前缀：当接口只返回 imageOssId 而没有 imageUrl 时，
  // 会用 `${ossPrefix}${ossId}` 拼出图片地址；后端有 OSS 下载接口时填写
  ossPrefix: ''
};
