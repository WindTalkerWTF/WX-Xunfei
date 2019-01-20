//index.js
//获取应用实例
const app = getApp()
const util = require('../../utils/util.js')
const dateformat = require('../../utils/dateformat.js')
const plugin = requirePlugin("WechatSI")

// 获取**全局唯一**的语音识别管理器**recordRecoManager**
const manager = plugin.getRecordRecognitionManager()

// 是否有文件正在播放
let isPlayingVoice = false;
// 正在播放的文件名
let playingVoiceKey = '';
// 正在播放的文件索引
let playingVoiceIndex = 0;

Page({

  /**
   * 页面的初始数据
   */
  data: {
    historyRecords: [],
    dialogList: [
      // {
      //   // 当前语音输入内容
      //   create: '04/27 15:37',
      //   lfrom: 'zh_CN',
      //   lto: 'en_US',
      //   text: '这是测试这是测试这是测试这是测试',
      //   translateText: 'this is test.this is test.this is test.this is test.',
      //   voicePath: '',
      //   translateVoicePath: '',
      //   autoPlay: false, // 自动播放背景音乐
      //   id: 0,
      // },
    ],
    scroll_top: 10000, // 竖向滚动条位置

    bottomButtonDisabled: false, // 底部按钮disabled

    // tips_language: language[0], // 目前只有中文

    initTranslate: {
      // 为空时的卡片内容
      create: '04/27 15:37',
      text: '等待说话',
    },

    currentTranslate: {
      // 当前语音输入内容
      create: '04/27 15:37',
      text: '等待说话',
    },
    recording: false,  // 正在录音
    recordStatus: 0,   // 状态： 0 - 录音中 1- 翻译中 2 - 翻译完成/二次翻译

    toView: 'fake',  // 滚动位置
    lastId: -1,    // dialogList 最后一个item的 id
    currentTranslateVoice: '', // 当前播放语音路径

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.initHistory();
    this.initRecord();
  },
  /**
    * 按住按钮开始语音识别
    */
  streamRecord: function (e) {
    // console.log("streamrecord" ,e)
    let detail = e.detail || {}
    let buttonItem = detail.buttonItem || {}
    manager.start({
      lang: "zh_CN",
    })

    this.setData({
      recordStatus: 0,
      recording: true,
      currentTranslate: {
        // 当前语音输入内容
        create: util.recordTime(new Date()),
        text: '正在聆听中',
        lfrom: "zh_CN",
        lto: "zh_CN",
      },
    })

  },


  /**
   * 松开按钮结束语音识别
   */
  streamRecordEnd: function (e) {

    // console.log("streamRecordEnd" ,e)
    let detail = e.detail || {}  // 自定义组件触发事件时提供的detail对象
    let buttonItem = detail.buttonItem || {}

    // 防止重复触发stop函数
    if (!this.data.recording || this.data.recordStatus != 0) {
      console.warn("has finished!")
      return
    }

    manager.stop()

    this.setData({
      bottomButtonDisabled: true,
    })
  },

  initHistory(){
    // 读取储存着的笔记
    let historyRecords = JSON.parse(wx.getStorageSync('historyRecords') || '[]');

    // 添加播放标记
    historyRecords = historyRecords.map(v => {
      v.playing = false;

      if (v.isRec === true && !v.word) {
        v.isRec = false;
      }

      return v;
    })
    console.log("%%%%%%%");
    console.log(historyRecords)
    this.setData({ historyRecords });
  },

  /**
   * 初始化语音识别回调
   * 绑定语音播放开始事件
   */
  initRecord: function () {
    //有新的识别内容返回，则会调用此事件
    manager.onRecognize = (res) => {
      let currentData = Object.assign({}, this.data.currentTranslate, {
        text: res.result,
      })
      this.setData({
        currentTranslate: currentData,
      })
      // this.scrollToNew();
    }

    // 识别结束事件
    manager.onStop = (res) => {
      // 取出录音文件识别出来的文字信息
      let text = res.result
      // 获取音频文件临时地址
      let filePath = res.tempFilePath
      let duration = res.duration

      if (text == '') {
        this.showRecordEmptyTip()
        return
      }
      
      if(res.duration < 1000){
        util.showTips('录音时间过短')
        return
      }

      console.log("-----------------")
      console.log(text)
      let lastId = this.data.lastId + 1

      wx.saveFile({
        tempFilePath: filePath,
        success: fileInfo => {
          const { savedFilePath } = fileInfo;
          const voiceKey = `historyRecords-${Date.now()}`

          // 生成笔记并保存再 storage
          const historyRecord = {
            key: voiceKey,
            path: savedFilePath,
            duration: (duration / 1000).toFixed(2),
            word: '',
            isRec: false,
            time: dateformat(new Date, 'YYYY-MM-DD HH:mm:ss'),
            contentText: text
          };

          const historyRecords = this.data.historyRecords.map(v => v);
          historyRecords.unshift(historyRecord);

          // this.recognizeVoice(voiceKey, savedFilePath);
          this.saveToStorage(historyRecords);
          this.setData({ historyRecords });
        },
        fail() {
          util.showModel('错误', '保存语音失败');
        }
      });
    
      // let currentData = Object.assign({}, this.data.currentTranslate, {
      //   text: res.result,
      //   translateText: '正在翻译中',
      //   id: lastId,
      //   voicePath: res.tempFilePath
      // })

      // this.setData({
      //   currentTranslate: currentData,
      //   recordStatus: 1,
      //   lastId: lastId,
      // })
      // console.log("-----------------")
      // console.log(currentData)
      // this.translateText(currentData, this.data.dialogList.length)
    }

    // 识别错误事件
    manager.onError = (res) => {

      this.setData({
        recording: false,
        bottomButtonDisabled: false,
      })

    }

    // 语音播放开始事件
    wx.onBackgroundAudioPlay(res => {

      const backgroundAudioManager = wx.getBackgroundAudioManager()
      let src = backgroundAudioManager.src

      this.setData({
        currentTranslateVoice: src
      })

    })
  },

  saveToStorage(histroyRecords) {
    console.log("save records: " + histroyRecords)
    histroyRecords = histroyRecords.map(v => {
      delete v.playing;
      return v
    });

    wx.setStorage({
      key: 'historyRecords',
      data: JSON.stringify(histroyRecords)
    })
  },


  /**
   * 翻译
   */
  translateText: function (item, index) {
    let lfrom = item.lfrom || 'zh_CN'
    let lto = item.lto || 'en_US'

    plugin.translate({
      lfrom: lfrom,
      lto: lto,
      content: item.text,
      tts: true,
      success: (resTrans) => {

        let passRetcode = [
          0, // 翻译合成成功
          -10006, // 翻译成功，合成失败
          -10007, // 翻译成功，传入了不支持的语音合成语言
          -10008, // 翻译成功，语音合成达到频率限制
        ]

        if (passRetcode.indexOf(resTrans.retcode) >= 0) {
          let tmpDialogList = this.data.dialogList.slice(0)

          if (!isNaN(index)) {

            let tmpTranslate = Object.assign({}, item, {
              autoPlay: true, // 自动播放背景音乐
              translateText: resTrans.result,
              translateVoicePath: resTrans.filename || "",
              translateVoiceExpiredTime: resTrans.expired_time || 0
            })

            tmpDialogList[index] = tmpTranslate


            this.setData({
              dialogList: tmpDialogList,
              bottomButtonDisabled: false,
              recording: false,
            })

          } else {
            console.error("index error", resTrans, item)
          }
        } else {
          console.warn("翻译失败", resTrans, item)
        }

      },
      fail: function (resTrans) {
        console.error("调用失败", resTrans, item)
        this.setData({
          bottomButtonDisabled: false,
          recording: false,
        })
      },
      complete: resTrans => {
        this.setData({
          recordStatus: 1,
        })
        wx.hideLoading()
        console.log(resTrans)
      }
    })

  },

  /**
    * 识别内容为空时的反馈
    */
  showRecordEmptyTip: function () {
    this.setData({
      recording: false,
      // bottomButtonDisabled: false,
    })
    wx.showToast({
      title: "未识别到语音,请大声说话",
      icon: 'success',
      image: '../../images/no_voice.png',
      duration: 1500,
      success: function (res) {

      },
      fail: function (res) {
        console.log(res);
      }
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    try {
      wx.removeStorageSync('historyRecords')
    } catch (e) {
      // Do something when catch error
      console.log("清除缓存失败:")
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    
  }
})

// Page({
//   data: {
//     motto: 'Hello World',
//     userInfo: {},
//     hasUserInfo: false,
//     canIUse: wx.canIUse('button.open-type.getUserInfo')
//   },
//   //事件处理函数
//   bindViewTap: function() {
//     wx.navigateTo({
//       url: '../logs/logs'
//     })
//   },
//   onLoad: function () {
//     if (app.globalData.userInfo) {
//       this.setData({
//         userInfo: app.globalData.userInfo,
//         hasUserInfo: true
//       })
//     } else if (this.data.canIUse){
//       // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
//       // 所以此处加入 callback 以防止这种情况
//       app.userInfoReadyCallback = res => {
//         this.setData({
//           userInfo: res.userInfo,
//           hasUserInfo: true
//         })
//       }
//     } else {
//       // 在没有 open-type=getUserInfo 版本的兼容处理
//       wx.getUserInfo({
//         success: res => {
//           app.globalData.userInfo = res.userInfo
//           this.setData({
//             userInfo: res.userInfo,
//             hasUserInfo: true
//           })
//         }
//       })
//     }
//   },
//   getUserInfo: function(e) {
//     console.log(e)
//     app.globalData.userInfo = e.detail.userInfo
//     this.setData({
//       userInfo: e.detail.userInfo,
//       hasUserInfo: true
//     })
//   }
// })
