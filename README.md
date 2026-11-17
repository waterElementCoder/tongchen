# 日喜优选 · 小程序接入说明

## 〇、当前联调环境（临时）

| 项 | 值 |
|---|---|
| 接口地址 | `https://jbjxcx.djv5.site`（https 正式域名） |
| 小程序 appid | `wx52002b4a5c001233` |
| clientid | `f83fecb04d418f847763968eeccf9914` |
| tenantId | `144033` |
| grantType | `xcx` |

已实测确认（2026-11-01）：

- `POST /auth/xcxLogin` 路径与参数正确：用上述 appid + clientId + tenantId 请求，后端能真正调用微信接口（返回「code 无效」属预期，因为没有真实 wx.login code）；
- `/mall/app/*` **全部需要登录态**（不带 token 一律返回 `{"code":401,"msg":"认证失败，无法访问系统资源"}`），所以小程序里所有商城接口都按带 token 请求，首次进入会自动静默登录；
- `POST /getPhoneNumber` 存在且需要 token；
- `POST /pay/wxJsapi` **不校验 token**，但必填 `contactName`、`subOpenid`，且该 openid 对应用户未绑手机号时返回 `msg = bind-mobile-number`。

> 联调提示：http 域名需要在开发者工具里勾选「不校验合法域名」（`project.config.json` 已设 `urlCheck: false`）；真机预览需要打开调试模式，否则 http 请求会被拦截。

## 一、配置项（`config/config.js`）

| 字段 | 说明 |
|---|---|
| `baseUrl` | 后端网关地址，不带末尾斜杠（当前为 `https://jbjxcx.djv5.site`） |
| `appid` | 小程序 appid（登录请求体的 appid，同时作为每个商城接口的 query 参数） |
| `clientid` | 请求头 clientid，登录请求体里字段名为 `clientId` |
| `tenantId` | 登录请求体的租户标识 |
| `loginUrl` | 微信登录接口，默认 `/auth/xcxLogin`；**置空则登录页进入开发模式（手动粘贴 token）** |
| `phoneUrl` | 手机号绑定接口，默认 `/getPhoneNumber` |
| `payUrl` | 微信 JSAPI 支付下单接口，默认 `/pay/wxJsapi` |
| `payTenantId` | 支付请求体里的业务租户标识，默认 `842681`。后端用它把 `/pay/wxJsapi` 路由到商城支付；**不传会被错误分发到「活动报名」支付并返回「报名日期不能为空」** |
| `ossPrefix` | 商品图 OSS 前缀（接口只返回 `imageOssId` 时使用） |

`project.config.json` 里的 `appid` 需与 `config.appid` 一致（当前已一致）。

## 二、认证流程（与 `/project/study` 参考项目一致）

```
① 静默登录
   wx.login() → code
   POST {baseUrl}/auth/xcxLogin
   body: { code, appid, clientId, grantType: 'xcx', tenantId }
   → data.access_token（也兼容 data.token / data.accessToken）+ 用户信息

② 绑定手机号
   <button open-type="getPhoneNumber" bindgetphonenumber="...">
   e.detail.code
   POST {baseUrl}/getPhoneNumber?appid=xxx
   header: Authorization: Bearer <access_token>, clientid
   body: { code, appid }
   → data.phoneNumber（兼容 data.phone / data.mobile）
   绑定成功后再调用一次 ①，刷新用户信息

③ 业务请求
   每个 /mall/app/* 请求 query 带 appid，header 带 Authorization + clientid
```

实现位置：`utils/auth.js`（登录/绑定手机号）、`utils/request.js`（业务请求，401 自动重登一次）。

## 三、登录态策略

- 应用启动**不强制登录**，首页/分类/商品等 `auth:false` 接口匿名可访问。
- 需要登录态的接口（购物车、地址、订单）在发请求前自动静默登录一次（`ensureLogin`）。
- token 失效（401）时自动清除本地态 → 静默重登 → 重试一次；仍失败则跳登录页。
- 登录页步骤：微信一键登录 → 手机号授权（可跳过）→ 返回来源页。
- 「我的」页展示手机号，未绑定时提供「去绑定」按钮（`open-type="getPhoneNumber"`）。
- 「我的」页底部可退出登录（清 token 与用户信息）。

## 四、支付流程（POST /pay/wxJsapi）

实现位置：`utils/pay.js`，两个入口：

- 确认订单页：先 `POST /mall/app/order` 创建订单（锁库存）→ `pay({ orderId })` 绑定该订单并发起支付；
- 订单详情页「去支付」：同样 `pay({ orderId })`。

请求体：

```json
{
  "customerIp": "本机 IP（wx.getLocalIPAddress，失败兜底 0.0.0.0）",
  "openid": "登录返回的用户 openid",
  "subAppid": "config.appid",
  "subOpenid": "同 openid",
  "contactName": "联系人（地址联系人 > 用户昵称）",
  "contactPhone": "联系电话（地址电话 > 绑定手机号）",
  "shareOpenid": "",
  "tenantId": "842681",
  "bizJsonStr": "{\"requestId\":\"wx-yyyyMMdd-xxx\",\"mallOrderId\":123}"
}
```

- `tenantId`：**必传**，值为 `842681`（`config.payTenantId`）。后端靠它把请求分发到商城支付处理器；不传会落到「活动报名」支付，返回「报名日期不能为空」；
- `requestId`：预支付唯一请求号，前端生成 `wx-yyyyMMdd-随机`；
- `mallOrderId`：**联调阶段写死为 `2116857524786384897`**（`config.payMallOrderId`），仅绑定该商城订单并支付；前端已不再调用 `POST /mall/app/order` 创建订单（后端临时方案，正式版需移除写死值并恢复建单链路）；
- 响应 `data.wcPayData` 为 JSON 字符串，解析后调 `wx.requestPayment`（兼容 `package/packageVal/prepayId`）；
- 后端返回 `msg = bind-mobile-number` 时，前端弹窗引导去绑定手机号；
- 下单前前端会主动检查用户是否已绑定手机号，未绑定先引导绑定，避免产生无法支付的订单。

### 4.1 云闪付（云微笔笔付）

与微信支付**同一个接口** `/pay/wxJsapi`，请求体只多传 `payType: 'UnionPayAppMini'`（其余字段完全一致）。

```json
{ "customerIp": "...", "subAppid": "...", "subOpenid": "...", "contactName": "...", "contactPhone": "...", "shareOpenid": "", "tenantId": "842681", "bizJsonStr": "{...}", "payType": "UnionPayAppMini" }
```

- 响应 `data = { cqpMpAppId, qpMpPath }`，用 `wx.navigateToMiniProgram({ appId: cqpMpAppId, path: qpMpPath })` 跳到云闪付小程序收银台；
- `navigateToMiniProgram` 必须在用户手势中触发，所以拿到参数后先弹 `wx.showModal` 承接（用户点「去支付」才跳）；
- 从云闪付小程序返回本小程序时 `App.onShow` 的场景值 `scene === 1038`，据此判定已返回并刷新订单；
- 云闪付不支持前端拿支付结果，返回后跳支付结果页展示「支付结果确认中」，以订单状态为准（`pages/order/result` 的 `pending=1`）。

代码位置：`utils/pay.js`（`pay({ payType: 'unionpay' })` 与 `choosePayMethod()`）、`pages/order/confirm`（提交订单时先选支付方式）、`pages/order/detail`（立即支付同样可选）、`pages/order/result`（确认中状态）。

## 五、手机号组件前提

- 小程序需为企业主体且已认证；
- 使用「手机号快速验证组件」按次收费（当前 0.03 元/次），额度可在微信公众平台查看；
- 基础库需 ≥ 2.21.2（本项目 `libVersion` 为 3.4.3，满足）。

## 五、待后端确认

1. 登录接口是否同为 `/auth/xcxLogin`（body 字段名 `clientId` 大小写）、`/getPhoneNumber` 的路径与返回字段；
2. 登录响应里用户信息的嵌套结构（代码已兼容 `data.userInfo` / 平铺两种）；
3. `orderStatus` 枚举实际取值（见 `utils/util.js` 的 `ORDER_STATUS`，需按后端调整）；
4. 支付接口：确认 `/pay/wxJsapi` 响应里 `wcPayData` 的字段名（已兼容 `package/packageVal/prepayId`）与 `data` 中是否返回 `mallOrderId`；另确认登录用户信息里的 openid 字段名（已兼容 `openid/openId/subOpenid`）。
