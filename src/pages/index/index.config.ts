export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '印谱',
      navigationBarBackgroundColor: '#F4EFE6',
      navigationBarTextStyle: 'black'
    })
  : {
      navigationBarTitleText: '印谱',
      navigationBarBackgroundColor: '#F4EFE6',
      navigationBarTextStyle: 'black'
    }
