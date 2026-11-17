const api = require('../../../utils/api');

Page({
  data: {
    id: '',
    form: {
      receiverName: '',
      receiverPhone: '',
      provinceCode: '',
      provinceName: '',
      cityCode: '',
      cityName: '',
      districtCode: '',
      districtName: '',
      detailAddress: '',
      isDefault: '0'
    },
    region: [],
    isEdit: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      wx.setNavigationBarTitle({ title: '编辑地址' });
      this.loadAddress(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
  },

  loadAddress: function (id) {
    const that = this;
    api
      .getAddressList()
      .then(function (list) {
        const addr = (list || []).find(function (a) { return String(a.id) === String(id); });
        if (!addr) return;
        that.setData({
          form: {
            receiverName: addr.receiverName || '',
            receiverPhone: addr.receiverPhone || '',
            provinceCode: addr.provinceCode || '',
            provinceName: addr.provinceName || '',
            cityCode: addr.cityCode || '',
            cityName: addr.cityName || '',
            districtCode: addr.districtCode || '',
            districtName: addr.districtName || '',
            detailAddress: addr.detailAddress || '',
            isDefault: addr.isDefault || '0'
          },
          region: [addr.provinceName || '', addr.cityName || '', addr.districtName || ''].filter(Boolean)
        });
      });
  },

  onInput: function (e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = e.detail.value;
    this.setData(patch);
  },

  onRegionChange: function (e) {
    const values = e.detail.value;
    const codes = e.detail.code || [];
    this.setData({
      region: values,
      'form.provinceCode': codes[0] || '',
      'form.provinceName': values[0] || '',
      'form.cityCode': codes[1] || '',
      'form.cityName': values[1] || '',
      'form.districtCode': codes[2] || '',
      'form.districtName': values[2] || ''
    });
  },

  onDefaultChange: function (e) {
    this.setData({ 'form.isDefault': e.detail.value ? '1' : '0' });
  },

  onSave: function () {
    const f = this.data.form;
    if (!f.receiverName.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(f.receiverPhone.trim())) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' });
      return;
    }
    if (!f.provinceName) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!f.detailAddress.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }
    const data = Object.assign({}, f);
    if (this.data.isEdit) data.id = this.data.id;
    api
      .saveAddress(data)
      .then(function () {
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(function () {
          wx.navigateBack();
        }, 600);
      });
  }
});
