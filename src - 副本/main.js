import 'leaflet/dist/leaflet.css';
import "swiper/dist/css/swiper.min.css";
import "./common/css/jquery.mCustomScrollbar.min.css"
import "./style.css";

import "leaflet";
import {antPath} from "leaflet-ant-path";
import "leaflet.markercluster";
import "proj4";
import "proj4leaflet";
import "./common/js/tileLayer.baidu.js";
require("jquery-mousewheel")($);
require('malihu-custom-scrollbar-plugin')($);
import "swiper";
import wx from 'weixin-js-sdk';
import {GPS, TimeFormat} from "./common/js/utils"
import FastClick from "fastclick"

FastClick.attach(document.body);

function CustomMap(opts) {
    var defaults = {
        container: 'map',
        center: [30.160607, 119.99203],
        wxCenter: [30.152991,119.984647],
        zoom: 17,
        minZoom: 16,
        maxZoom: 19,
        url: 'tiles/{z}/{x}_{-y}.png',
        detectRetina: true,
        maxBounds: [
            [30.1477,119.983508],
            [30.170121,120.00133]
        ],
        wxAppUrl: process.env.NODE_ENV == "production" ? "https://www.ipow.cn/Data_Interface/WeiXin.aspx" : "/WeiXin",
        WechatjsApiList: ['checkJsApi', 'getLocation', 'openLocation', 'onMenuShareTimeline', 'onMenuShareAppMessage'],
        showInfo: "https://www.ipow.cn/HzspMapBaiduServices/ShowInfo.ashx",
        searchSpots: "https://www.ipow.cn/HzspMapBaiduServices/spots.ashx",
        routePlanning: "https://www.ipow.cn/HzspMapBaiduServices/RoutePlanning.ashx",
        introduction: process.env.NODE_ENV == "production" ? "https://www.ipow.cn/HzspMapBaiduServices/api/scenic/Introduction" : "/Introduction",
        recommendroutes: "https://www.ipow.cn/HzspMapBaiduServices/recommendroutes.ashx",
        placeSearch: "https://www.ipow.cn/HzspMapBaiduServices/PlaceSearch.ashx",
        locationName: "杭州野生动物世界",
        locationAddress: "浙江省杭州市富阳区杭富路九龙大道1号"
    }
    this.opts = $.extend({},defaults,opts)
}
CustomMap.prototype = {
    constructor: CustomMap,
    init: function() {
        this.render()
        this.setParams()
        this.bind()
    },
    render: function() {
        this.initMap()
        this.addTile()
        this.getSpotsCategories()
        this.addHotspot()
        this.recommendLine()
        this.showHotspot()
    },
    setParams: function() {
        this.defZoneID = -1 // 第一个地图分类ID
        this.zoneIDArry = [] //地图分类ID
        this.latLong = [] //经纬度存储
        this.markersArr = [] //自定义标记点
        this.categoriesName = [] //分类名
        this.categoriesIcon = [] //icon分类
        this.routeMarkersArr = [] //景点标记点
        this.latLongMarkersArr = [] //景点标记点经纬度
        this.startLabel = null //设为起点
        this.startMarker = null //起点marker
        this.endMarker = null //终点marker
        this.startMarkerLabel = null //起点marker文字
        this.path = null //路线
        this.typeIdArr = [] //markerID
        this.routePoint = [] // 推荐线路断点
        this.splitPath = [] // 推荐线路断点路径
        this.showIndex = 1 // 精彩演出索引
        this.distance = 0 // 距离
        this.duration = 0 // 时间
        this.endMarkerName = "" // 终点name
        this.init = true
        this.shareUrl = ""
        this.shareId = ""
        this.shareCategory = -1
        this.shareDsec = "iMAP景区畅游系统"
        this.defaultTitle = "iMAP景区畅游系统"
        this.shareImgUrl = "https://www.ipow.cn/images/welcome.jpg"
        this.miniProgram = false
    },
    // 初始化地图
    initMap: function() {
        var self = this
        this.maxBounds = L.latLngBounds(this.opts.maxBounds)
        this.map = new L.map(this.opts.container, {
            bounceAtZoomLimits: false,
            crs: L.CRS.Baidu,
            zoom: this.opts.zoom,
            center: this.opts.center,
            minZoom: this.opts.minZoom,
            maxZoom: this.opts.maxZoom,
            maxBounds: this.maxBounds,
            attributionControl: false,
            zoomControl: false
        })
        this.longPressStart()
        wx.miniProgram.getEnv(function (res) {
            self.miniProgram = res.miniprogram
        })
    },
    // 添加瓦片图层
    addTile: function() {
        this.titleLayer = new L.TileLayer(this.opts.url, {
            minZoom: this.opts.minZoom,
            maxZoom: this.opts.maxZoom+1,
            detectRetina: true
        })
        this.titleLayer.addTo(this.map)
    },
    // 微信定位
    wechatHandler: function() {
        var self = this
        $.post(this.opts.wxAppUrl, {url: window.location.href}, function(data) {
            wx.config({
                debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
                appId: data["appId"], // 必填，公众号的唯一标识
                timestamp: data["timestamp"], // 必填，生成签名的时间戳
                nonceStr: data["nonceStr"], // 必填，生成签名的随机串
                signature: data["signature"],// 必填，签名，见附录1
                jsApiList: self.opts.WechatjsApiList// 必填，需要使用的JS接口列表
            })
            wx.error(function (res) {
                console.log('验证失败返回的信息:', res);
            })
            wx.ready(function(){
                //检查客户端是否支持某个js接口
                wx.checkJsApi({
                    jsApiList: self.opts.WechatjsApiList.splice(1), // 需要检测的JS接口列表，所有JS接口列表见附录2,
                    success: function (res) {
                        // 以键值对的形式返回，可用的api值true，不可用为false
                        // 如：{"checkResult":{"chooseImage":true},"errMsg":"checkJsApi:ok"}
                    }
                })
                wx.showOptionMenu();
                self.handlePosition(function ff() {
                    if(self.updatePosId1) {
                        clearTimeout(self.updatePosId1)
                    }
                    // 定时更新位置
                    self.updatePosId1 = setTimeout(function f() {
                        self.handlePosition(ff)
                    }, 2500)
                })

                // self.shareUrl = data["url"]
                self.sharePosition()

                //获取默认景点
                self.getDefaultSpot()
            })
        }, "json")
    },
    handlePosition: function(callback) {
        var self = this
        this.getCurrentPosition(function() {
            setTimeout(function() {
                if(self.nowInPark == true) {
                    callback()
                }
            }, 100)
        })
    },
    getCurrentPosition: function(callback) {
        var self = this
        wx.getLocation({
            type: 'gcj02', // 默认为wgs84的gps坐标，如果要返回直接给openLocation用的火星坐标，可传入'gcj02'
            success: function (res) {
                if (res.accuracy > 100) {
                    setTimeout(function() {
                        self.getCurrentPosition(callback);
                    }, 100)
                    return;
                }
                var latitude = res.latitude; // 纬度，浮点数，范围为90 ~ -90
                var longitude = res.longitude; // 经度，浮点数，范围为180 ~ -180。
                var BDcoordinate = GPS.bd_encrypt(latitude, longitude)
                self.nowLngLat = L.latLng(BDcoordinate['lat'], BDcoordinate['lon'])
                self.isInPark()
                setTimeout(function() {
                    if(self.nowInPark == true) {
                        if(self.startMarker) {
                            self.moveMarker(self.nowLngLat)
                        }else {
                            self.setStartMarker(self.nowLngLat)
                        }
                    }
                }, 100)
                callback()
            }
        })
    },
    // 是否在园区内
    isInPark: function() {
        if (this.maxBounds.contains(this.nowLngLat)) {
            this.nowInPark = true;
        }else {
            this.nowInPark = false;
            if(this.init) {
                this.init = false
                return
            }
            $(".notInPark").css({"display":"flex"});
        }
    },
    // 分享当前内容 
    sharePosition: function() {
        var self = this
        // var url = location.protocol + "//" + location.host + location.pathname
        wx.onMenuShareTimeline({
            title: this.defaultTitle, // 分享标题
            link: location.href, // 分享链接，该链接域名必须与当前企业的可信域名一致
            imgUrl: this.shareImgUrl, // 分享图标
            success: function () {
                // 用户确认分享后执行的回调函数
            },
            cancel: function () {
                // 用户取消分享后执行的回调函数
            }
        })
        wx.onMenuShareAppMessage({
            title: this.defaultTitle, // 分享标题
            desc: this.shareDsec, // 分享描述
            link: location.href, // 分享链接，该链接域名必须与当前企业的可信域名一致
            imgUrl: this.shareImgUrl, // 分享图标
            type: '', // 分享类型,music、video或link，不填默认为link
            dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
            success: function () {
                // 用户确认分享后执行的回调函数
            },
            cancel: function () {
                // 用户取消分享后执行的回调函数
            }
        })
        if(this.miniProgram) {
            var url = location.href
            var hasSpotId = url.indexOf("spotId")
            var spotId = hasSpotId > -1 ? url.substring(hasSpotId, url.indexOf("&")).split("=")[1] : -1
            var category = hasSpotId > -1 ? url.substring(url.indexOf("?")+1).split("&")[1].split("=")[1] : -1
            var data = { 
                spotId: spotId,
                category: category
            }
            wx.miniProgram.postMessage({
                data: data
            })
        }
    },
    //获取默认景点
    getDefaultSpot: function() {
        var self = this
        var search = ""
        var shareCategory = ""
        var url = location.href
        var hasSpotId = url.indexOf("spotId")
        var params = url.substring(url.indexOf("?")+1).split("&")
        if(hasSpotId > -1) {
            search = url.substring(hasSpotId, url.indexOf("&")).split("=")[1]
            shareCategory = params[1].split("=")[1]
            $(".zone_box_con_wrap").addClass("active")
            this.createrDetails(search, shareCategory)
            $(".zone_type a").eq(shareCategory).addClass("active").siblings().removeClass("active")
            $(".zone_type a").eq(shareCategory).siblings().hide()
            // 重置marker
            this.clearMarker()
            $.post(this.opts.searchSpots, { type: "category_spots", id: $(".zone_type a").eq(shareCategory).attr("id") }, function (data, status, xhr) {
    
                for (var index = 0; index < data.spots.length; index++) {
                    self.latLong.push(L.latLng(data.spots[index].longitude, data.spots[index].latitude)); //获取marker标点位置
                    self.typeIdArr.push(shareCategory)
                }
    
                self.createrMarkers(self.latLong, data, self.typeIdArr)
            }, "json");
        }else{
            $(".welcome_wrap").addClass("active")
        }
    },
    // 长按设为起点
    longPressStart: function() {
        var self = this
        function longPressStartFunc(e) {
            if(self.startLabel) {
                self.startLabel.remove()
                self.startLabel = null
            }
            self.startLabel = L.marker([e.latlng.lat, e.latlng.lng], {
                icon: L.divIcon({
                    html: '<div class="setStart">设为起点</div>'
                })
            })
            self.map.addLayer(self.startLabel)
            
            self.startLabel.on("click", function() {
                self.clearStart2End()
                self.setStartMarker(e.latlng)
                self.startLabel.remove()
                self.startLabel = null
            })
            
            self.map.on("click", function(e) {
                if(self.startLabel) {
                    self.startLabel.remove()
                    self.startLabel = null
                }
            })
            
        }
        this.longPressStartFunc = longPressStartFunc
        this.map.on("contextmenu", this.longPressStartFunc)
    },
    // 移动起点
    moveMarker: function(point) {
        this.startMarker.setLatLng([point.lat, point.lng])
    },
    // 设置起点
    setStartMarker: function(point) {
        if(this.startMarker) {
            this.startMarker.remove()
            this.startMarker = null
            this.startMarkerLabel.remove()
            this.startMarkerLabel = null
        }
        this.startMarker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                html: '<div class="navigation"><i></i></div>'
            })
        })
        this.startMarkerLabel = L.popup({
            className: 'startMarkerLabel'
        })
        .setLatLng([point.lat, point.lng])
        .setContent('<div class="startLabel">我在这里</div>')

        this.startMarker.bindPopup(this.startMarkerLabel)

        this.endMarkerName = ""
        this.distance = 0
        this.duration = 0

        this.map.addLayer(this.startMarker)
        setTimeout(function() {
            $(".navigation").parent().css("transition", "transform .3s")
        }, 100)
    },
    // 首页滚动热点
    addHotspot: function() {
        var self = this
        $.post(this.opts.showInfo, {type: "shows"}, function(data, status, xhr) {
            var html = ""
            var showHtml = ""
            if(data.Values.length > 0) {
                for (var index = 0, hotsopt; hotsopt = data.Values[index]; index++) {
                    if(hotsopt.Time.length > 0) {
                        html += '<div class="scroll_hotspot_item time" data-id='+hotsopt.Id+'><div class="scroll_hotspot_item_inner">' +
                                    '<span style="background: #'+hotsopt.Color+'">'+hotsopt.Type+'</span><div class="text"><p>'+hotsopt.Title+'</p></div><b>'+hotsopt.Time+'</b>' +
                                '</div></div>'
                        showHtml += '<li data-id='+hotsopt.Id+' data-index='+self.showIndex+'><span>演出</span><div class="text_flex"><div class="text"><p>'+hotsopt.Title+'</p></div><em>即将开始</em></div><b>'+hotsopt.Time+'</b><i></i></li>'
                    }else {
                        html += '<div class="scroll_hotspot_item notTime" data-id='+hotsopt.Id+'><div class="scroll_hotspot_item_inner">' +
                                    '<span style="background: #'+hotsopt.Color+'">'+hotsopt.Type+'</span><div class="text"><p>'+hotsopt.Title+'</p></div><i></i>' +
                                '</div></div>'
                    }
                }
            }
            
            $("#show_list").html(showHtml)
            if(showHtml == "") {
                $(".hotspot_list_wrap .hotspot_list_con .show_list").css("border", "none")
            }
            $("#scroll_hotspot_list").html(html)
            if(self.hotspotTimeId1) {
                clearTimeout(self.hotspotTimeId1)
            }
            if(self.hotspotTimeId2) {
                clearTimeout(self.hotspotTimeId2)
            }
            self.scrollHotspot()
            
            $(".notTime .scroll_hotspot_item_inner").on("touchstart", function() {
                self.createHotspotDetail($(this).parent(".notTime").attr("data-id"), $(this).find(".text p").html())
            })
            $(".time, #show_list li").on("touchstart", function() {
                $(".zone_type a").eq(self.showIndex).addClass("active").siblings().removeClass("active")
                $(".zone_type a").eq(self.showIndex).siblings().hide()
                $(".zone_type_con").addClass("active")

                // 重置marker
                self.clearMarker()
                self.clearStart2End()
                
                $.post(self.opts.searchSpots, { type: "category_spots", id: $(".zone_type a").eq(self.showIndex).attr("id") }, function (data, status, xhr) {
        
                    for (var index = 0; index < data.spots.length; index++) {
                        self.latLong.push(L.latLng(data.spots[index].longitude, data.spots[index].latitude)); //获取marker标点位置
                        self.typeIdArr.push(self.showIndex)
                    }
        
                    self.createrMarkers(self.latLong, data, self.typeIdArr)
                }, "json");

                $(".zone_box_con_wrap").addClass("active")
                if($(this).attr("data-index") >-1) {
                    self.createrDetails($(this).attr("data-id"), $(this).attr("data-index"))
                }else {
                    self.createrDetails($(this).attr("data-id"))
                }

                self.map.setView(self.opts.center, self.opts.zoom-1, {
                    animate: false
                })
            })
        }, "json")
    },
    // 热点滚动动画
    scrollHotspot: function() {
        var self = this
        var scrollHotspotItem = $(".scroll_hotspot_item")
        var scrollHotspotList = $(".scroll_hotspot_list")
        if(scrollHotspotItem.length>2) {
            var scrollHotspotItemfirst = scrollHotspotItem.eq(0).clone()
            var scrollHotspotItemsecond = scrollHotspotItem.eq(1).clone()
            var itemHeight = scrollHotspotItem.eq(0).outerHeight(true)
            var scrollIndex = 1
            scrollHotspotList.append(scrollHotspotItemfirst).append(scrollHotspotItemsecond)
        
            this.hotspotTimeId1 = setTimeout(function f() {
                scrollHotspotList.animate({
                    top: (-itemHeight*scrollIndex++)+'px'
                }, 1000, function() {
                    if(scrollIndex == $(".scroll_hotspot_item").length-1) {
                        scrollIndex = 1
                        scrollHotspotList.css("top", 0)
                        self.addHotspot()
                        return
                    }
                    self.hotspotTimeId2 = setTimeout(f, 5000)
                })
            }, 5000)
        }
    },
    // 创建热点详情
    createHotspotDetail: function(id, title) {
        var self = this
        $.post(this.opts.showInfo, {type:"getPushContent", id: id}, function(data, status, xhr) {
            $("#hotspot_detail").html(
                '<h2 class="title"><i class="back"></i>'+title+'</h2>' +
                '<div class="text">'+data.Values+'</div>'
            )
            $(".hotspot_detail_wrap").addClass("active")
            $(".hotspot_detail .title .back").click(function() {
                $(".hotspot_detail_wrap").removeClass("active")
            })
        }, "json")
    },
    // 显示今日热点
    showHotspot: function() {
        var self = this
        this.ifHotspotShow = false
        $(".info_item").on("touchstart", function() {
            if(!self.ifHotspotShow) {
                self.ifHotspotShow = true
                $.post(self.opts.showInfo, {type: "todayPush"}, function(data, status, xhr) {
                    var html = ""
                    if(data.Values.length > 0) {
                        for(var index=0,hotspot; hotspot=data.Values[index]; index++) {
                            html += '<li data-id='+hotspot.Id+'>'+
                                    '<span style="background: #'+hotspot.Color+';" >'+hotspot.Type+'</span>'+
                                    '<div class="text"><p>'+hotspot.Title+'</p></div><i></i>'+
                                    '</li>'
                        }
                    }else {
                        html = '<p style="line-height:50px;text-align:center;">暂无今日热点</p>'
                    }
                    $("#hotspot_list").html(html)
                    $("#hotspot_list li").click(function() {
                        self.createHotspotDetail($(this).attr("data-id"), $(this).find(".text p").html())
                    })
                }, "json")
            }
            $(".hotspot_list_wrap").addClass("active")
        })
    },
    // 获取景点分类
    getSpotsCategories: function() {
        var self = this
        this.categories = []
        $.post(this.opts.searchSpots, { type: "category" }, function (data, status, xhr) {
            // console.log(data.categories);
            self.categories = data.categories
            for (var index = 0; index < data.categories.length; index++) {
                if (index == 0) {
                    // 插入右侧导航按钮
                    $(".zone_type").append(
                        '<a href="javascript:;" class="active" id="' + data.categories[index].id + '"><i style="background:url(' + data.categories[index].icon + ') center center no-repeat;background-size:0.45rem auto;"></i><em></em>' + data.categories[index].name + '</a>'
                    )
        
                    // 插入列表模式按钮
                    $(".scenic_list_btn").append(
                        '<a href="javascript:;" class="active" id="' + data.categories[index].id + '"><i style="background:url(' + data.categories[index].icon + ') center center no-repeat;background-size:0.45rem auto;"></i>' + data.categories[index].name + '</a>'
                    )
                } else {
                    // 插入右侧导航按钮
                    $(".zone_type").append(
                        '<a href="javascript:;" id="' + data.categories[index].id + '"><i style="background:url(' + data.categories[index].icon + ') center center no-repeat;background-size:0.45rem auto;"></i><em></em>' + data.categories[index].name + '</a>'
                    )
        
                    // 插入列表模式按钮
                    $(".scenic_list_btn").append(
                        '<a href="javascript:;" id="' + data.categories[index].id + '"><i style="background:url(' + data.categories[index].icon + ') center center no-repeat;background-size:0.45rem auto;"></i>' + data.categories[index].name + '</a>'
                    )
                }
                // 插入搜索栏标签
                $(".search_tag").append('<a href="javascript:;" id="' + data.categories[index].id + '">' + data.categories[index].name + '</a>')
                self.categoriesName.push(data.categories[index].name)
                self.categoriesIcon.push(data.categories[index].icon)
            }
            
            self.defZoneID = $(".zone_type a").eq(0).attr("id")
            
            // 遍历地图分类ID到zoneIDArry
            for (var index = 0; index < $(".zone_type a").length; index++) {
                self.zoneIDArry.push($(".zone_type a").eq(index).attr("ID"))
            }
        
            // 创建右侧菜单第一区域marker
            self.createrDefMarker()

            // 微信定位
            self.wechatHandler()
        
        
            // 切换地图marker类别
            $(".zone_type a").on("touchstart", function () {
                if($(".zone_type_con").hasClass("active")) {
                    $(".zone_type_con").removeClass("active");
                    $(".zone_type a").show();
                }else {
                    var zoneIndex = $(this).index()
                    var that = $(this);
                    $(this).addClass("active").siblings().removeClass("active")
                    $(this).siblings().hide();
                    $(".zone_type_con").addClass("active")
            
                    // 重置marker
                    self.clearMarker()
                    self.clearStart2End()
                    
                    $.post(self.opts.searchSpots, { type: "category_spots", id: $(this).attr("id") }, function (data, status, xhr) {
            
                        for (var index = 0; index < data.spots.length; index++) {
                            self.latLong.push(L.latLng(data.spots[index].longitude, data.spots[index].latitude)); //获取marker标点位置
                            self.typeIdArr.push(zoneIndex)
                        }
            
                        self.createrMarkers(self.latLong, data, self.typeIdArr)
                    }, "json");
                }
            })

            $(".search_tag a").on("touchstart", function() {
                var zoneIndex = $(this).index()
                $(".zone_type a").eq(zoneIndex).addClass("active").siblings().removeClass("active")
                $(".zone_type a").eq(zoneIndex).show().siblings().hide()
                $(".search_box_con_wrap").removeClass("active")

                // 重置marker
                self.clearMarker()
                self.clearStart2End()
                
                $.post(self.opts.searchSpots, { type: "category_spots", id: $(this).attr("id") }, function (data, status, xhr) {
        
                    for (var index = 0; index < data.spots.length; index++) {
                        self.latLong.push(L.latLng(data.spots[index].longitude, data.spots[index].latitude)); //获取marker标点位置
                        self.typeIdArr.push(zoneIndex)
                    }
        
                    self.createrMarkers(self.latLong, data, self.typeIdArr)
                }, "json");
            })
        
        
            // 伸缩右侧导航功能
            $(".zone_type_extend_btn").on("click", function () {
                if ($(".zone_type_con").hasClass("active")) {
                    $(".zone_type_con").removeClass("active");
                    $(".zone_type a").show();
                } else {
                    $(".zone_type_con").addClass("active");
                    $(".zone_type a").hide();
                    $(".zone_type a.active").show();
                }
            })
        
        }, "json");
    },
    // 创建右侧菜单第一区域marker，当前为动物乐园
    createrDefMarker: function() {
        var self = this

        // 重置marker
        this.clearMarker()
        this.clearStart2End()

        $.post(this.opts.searchSpots, { type: "category_spots", id: this.defZoneID }, function (data, status, xhr) {
            // console.log(data);
    
            for (var index = 0; index < data.spots.length; index++) {
                self.latLong.push(L.latLng(data.spots[index].longitude, data.spots[index].latitude)) //获取marker标点位置
                self.typeIdArr.push(0)
            }
    
            // 创建地图标记点
            self.createrMarkers(self.latLong, data , self.typeIdArr)
    
        }, "json");
    },
    // 创建地图自定义marker
    createrMarkers: function(obj, mapData , mapID) {
        var mapPoint
        if(mapData.spots) {
            mapPoint = mapData.spots
        }else {
            mapPoint = mapData
        }
        
        var self = this
        for (var i = 0; i < obj.length; i++) {
            var point = obj[i]
            if(point) {
                if(mapPoint[i].ishot) {
                    var marker = L.marker([point.lng, point.lat], {
                        icon: L.divIcon({
                            html: '<div class="marker_icons route_icon hot"><i style="background:url('+require('./images/hot.png')+') center center no-repeat;background-size:0.28rem auto;"></i></div>'
                        })
                    })
                    var className = "marker_name_hot"
                }else {
                    var marker = L.marker([point.lng, point.lat], {
                        icon: L.divIcon({
                            html: '<div class="marker_icons route_icon"><i style="background:url(' + this.categories[mapID[i]].icon + ') center center no-repeat;background-size:0.28rem auto;"></i></div>'
                        })
                    })
                    var className = "marker_name"
                }
                var toolTip = L.tooltip({
                    permanent: true,
                    opacity: 1,
                    className: className,
                    direction: "center"
                })
                marker.bindTooltip(toolTip).setTooltipContent(mapPoint[i].name).openTooltip()

                this.markersArr.push(marker)
                // marker.addTo(this.map)
    
                var popup = L.popup({
                    keepInView: false,
                    minWidth: 230,
                    offset: [0, -10],
                    autoClose: false
                })
                .setLatLng([point.lng, point.lat])
                .setContent('<div class="info_box"' + 'id="' + mapPoint[i].id + '" data-index='+mapID[i]+'>' +
                '<div class="info_box_content"><div class="info_box_img"><div class="info_box_img_icon"><i><span style="background:url(' + this.categories[mapID[i]].icon + ') center center no-repeat;background-size:0.4rem auto;"></span></i><img src="' + mapPoint[i].img + '" alt=""></div><em class="pause"></em></div>' +
                '<div class="info_box_p">' + '<p>' + mapPoint[i].name + '</p>' + '<p class="info_box_area">' + mapPoint[i].area + '</p>' + '<p class="info_box_res"></p>' + '</div>' +
                '<div class="info_box_go" data-lng="'+obj[i].lng+'" data-lat="'+obj[i].lat+'"></div>' +
                '</div></div>');

                (function(index, markerPopup) {
                    marker.on("click", function(e) {
                        self.map.openPopup(markerPopup)
                        setTimeout(function() {
                            $(".info_box_area").show()
                            $(".info_box_res").hide()
                        }, 100)
                        if(self.startMarker) {
                            setTimeout(function() {
                                $(".info_box").addClass("hasStart")
                            }, 100)
                        }else {
                            setTimeout(function() {
                                $(".info_box").removeClass("hasStart")
                            }, 100)
                        }
                        if(mapPoint[index].name == self.endMarkerName) {
                            setTimeout(function() {
                                $(".info_box_area").hide()
                                $(".info_box_res").html("<span>"+self.distance+"</span>米&nbsp;&nbsp;<span>"+self.duration+"</span>分钟")
                                $(".info_box_res").show()
                                $(".info_box_go").hide()
                            }, 110)
                        }else if(self.endMarkerName !== ""){
                            setTimeout(function() {
                                $(".info_box_go").show()
                            }, 110)
                        }
                        setTimeout(function() {
                            if(!mapPoint[index].audioUrl) {
                                $(".pause").hide()
                            }else {
                                $(".pause").show()
                            }
                            // 点击地图标点显示详情
                            $("#commentary").attr("src", mapPoint[index].audioUrl)
                            self.ontan(mapPoint[index].audioUrl, mapPoint[index].name)
                            self.map.panTo([obj[index].lng, obj[index].lat])
                        }, 200)
                    })
                })(i, popup)
                

                // marker.bindPopup(popup)
            } 

        }
        // 点聚合
        self.setMarkerClusterer()

        // 默认关闭信息窗体
        setTimeout(function () {
            self.map.closePopup()
        }, 300)
    },
    // 点聚合
    setMarkerClusterer: function() {
        var self = this
        if(this.markerClusterer) {
            this.markerClusterer.clearLayers()
        }
        this.markerClusterer = L.markerClusterGroup({
            iconCreateFunction: function(cluster) {
                return L.divIcon({ html: '<div class="clusterer_icon">' + cluster.getChildCount() + '</div>' });
            },
            maxClusterRadius: 40,
            spiderfyDistanceMultiplier: 2,
            spiderLegPolylineOptions: { weight: 1.5, color: '#222', opacity: 0 },
            zoomToBoundsOnClick: false
            /* spiderfyOnMaxZoom: false,
            disableClusteringAtZoom: 19 */
        })
        this.markersArr.forEach(function(marker, index) {
            self.markerClusterer.addLayer(marker)
        })
        this.markerClusterer.on('clusterclick', function (a) {
            a.layer.zoomToBounds();
        });
        this.map.addLayer(this.markerClusterer)
    },
    // 点击地图标点显示详情
    ontan: function(audioSrc, name) {
        var self = this
        $(".info_box").on("touchstart", function (e) {
            if(e.target.className == "pause") {
                if(!audioSrc) {
                    return
                }
                $("#commentary")[0].play()
                $(e.target).removeClass("pause").addClass("playing")
                $(".info_box_img .info_box_img_icon").addClass("active")
                return
            }
            if(e.target.className == "playing") {
                $(e.target).removeClass("playing").addClass("pause")
                $(".info_box_img .info_box_img_icon").removeClass("active")
                $("#commentary")[0].pause()
                return
            }
            if(e.target.className == "info_box_go") {
                var latlng = self.startMarker.getLatLng()
                $.post(self.opts.routePlanning, {start: latlng.lat+","+latlng.lng, end: $(".info_box_go").attr("data-lng")+","+$(".info_box_go").attr("data-lat")}, function(res) {
                    var steps = res.result.routes[0].steps
                    var path = ""
                    var newPath = []
                    steps.forEach(function(item, index) {
                        path += item.path + ";"
                    })
                    path = path.slice(0, path.length-1)
                    path = path.split(";")
                    path.forEach(function(item, index) {
                        var newItem = item.split(",")
                        newPath.push([newItem[1], newItem[0]])
                    })
                    newPath.unshift([latlng.lat, latlng.lng])
                    newPath.push([$(".info_box_go").attr("data-lng"), $(".info_box_go").attr("data-lat")])
                    $(".info_box_go").hide()
                    $(".info_box_area").hide()
                    self.distance = res.result.routes[0].distance
                    self.duration = TimeFormat(res.result.routes[0].duration)
                    $(".info_box_res").html("<span>"+self.distance+"</span>米&nbsp;&nbsp;<span>"+self.duration+"</span>分钟").show()
                    self.endMarkerName = name

                    // 已在园区内或已设置起点
                    self.clearStart2End()
                    self.generateWalkRoute(newPath)
                    self.map.fitBounds([
                        latlng,
                        [$(".info_box_go").attr("data-lng"), $(".info_box_go").attr("data-lat")]
                    ])
                })
                return
            }
            
            
            $(".zone_box_con_wrap").addClass("active")
            // 创建详情页内容
            self.createrDetails($(this).attr("id"), $(this).attr("data-index"))
        })
    },
    // 创建详情页
    createrDetails: function(detailID, categoryIndex) {
        var self = this
        $.post(this.opts.searchSpots, { type: "spot", id: detailID }, function (data, status, xhr) { 
 
            self.shareId = detailID
            self.shareCategory = categoryIndex
            self.shareDsec = data.spot.name

            window.history.replaceState(null, null, location.protocol + "//" + location.host + location.pathname + "?spotId=" + detailID + "&category=" + categoryIndex)

            self.sharePosition()
            
            var time = data.spot.normalTimes || []
            var timeHtml = ""
            if(time.length > 0) {
                time.forEach(function(item) {
                    timeHtml += "<b>" + item.startTime.slice(0, item.startTime.length-3) + "</b>/"
                })
                timeHtml = timeHtml.slice(0, timeHtml.length-1)
            }
            $(".zone_box").html(
                '<div class="swiper-container">' +
                    '<div class="swiper-wrapper">' +
    
                    '</div>' +
                    '<div class="swiper-pagination"></div>' +
                '</div>' +
    
                '<div class="zone_title_wrap">' +
                    '<div class="zone_title">' +
                        '<h3>' + data.spot.name + '</h3>' +
                        '<p>' + data.spot.area + ' <span>距离：<b id="distance">定位后计算</b></span></p>' + 
                    '</div>' +
                    '<a href="javascript:;" class="zone_target" longitude="' + data.spot.longitude + '" latitude="' + data.spot.latitude + '"><i></i>去这里</a>' +
                '</div>' +

                '<div class="zone_time_wrap">' +
                    '<div class="zone_time_icon"><i></i>今日演出时间</div>' +
                    '<div class="zone_time">' +timeHtml+ '</div>' +
                '</div>' +
    
                '<div class="zone_media">' +
                    '<div class="zone_media_video"></div>' +
                    '<div class="zone_media_audio"><audio controls preload src="' + data.spot.audio + '"></audio></div>' +
                '</div>' +
    
                '<div class="zone_intro">' +
                    data.spot.description +
                '</div>' +

                '<div class="zone_share"><i></i>分享</div>' 
            )
    
            $(".pop_video_box_wrap").html(
                '<video controls preload src="' + data.spot.video + '"></video>'
            )

            if(time.length == 0) {
                $(".zone_time_wrap").remove()
            }
          
            // 音视频为空时去除div
            if(data.spot.audio == ""){
                $(".zone_media_audio").remove();
            }
            if (data.spot.video == "") {
                $(".zone_media_video").remove();
                $(".zone_media_audio").css({ "border-left": "none", "width": "94%" })
            }
            if (data.spot.audio == "" && data.spot.video == "") {
                $(".zone_media").remove();
            }

            if($(".zone_media_audio audio")[0]) {
                $(".zone_media_audio audio")[0].onplaying = function() {
                    $("#commentary")[0].pause()
                    $(".playing").removeClass("playing").addClass("pause")
                    $(".info_box_img .info_box_img_icon").removeClass("active")
                }
            }
            
            // 插入焦点图
            for (var index = 0; index < data.spot.imgs.length; index++) {
                $(".swiper-wrapper").append(
                    '<div class="swiper-slide">' +
                        '<img src="' + data.spot.imgs[index].imguri + '" alt="">' +
                    '</div>'
                )
            }
    
            // 点击视频播放
            $(".zone_media_video").on("click",function(){
                if (data.spot.video == null) {
                    alert('暂无视频')
                }else{
                    $(".pop_video_box").css({ "display": "flex" });
                }
            })
            $(".video_close_btn").on("click", function () {
                $(".pop_video_box").css({ "display": "none" });
                $(".pop_video_box_wrap").find("video")[0].pause();
            })

            // 计算距离
            if(self.startMarker) {
                var latlng = self.startMarker.getLatLng()
                $.post(self.opts.routePlanning, {start: latlng.lat+","+latlng.lng, end: data.spot.latitude+","+data.spot.longitude}, function(res) {
                    var distance = res.result.routes[0].distance
                    var steps = res.result.routes[0].steps
                    var path = ""
                    var newPath = []
                    steps.forEach(function(item, index) {
                        path += item.path + ";"
                    })
                    path = path.slice(0, path.length-1)
                    path = path.split(";")
                    path.forEach(function(item, index) {
                        var newItem = item.split(",")
                        newPath.push([newItem[1], newItem[0]])
                    })
                    newPath.unshift([latlng.lat, latlng.lng])
                    newPath.push([data.spot.latitude, data.spot.longitude])

                    document.getElementById("distance").innerHTML = distance + "m"
                    $(".zone_target").on("touchstart", function () {
                        self.endMarkerName = data.spot.name
                        self.distance = distance
                        self.duration = TimeFormat(res.result.routes[0].duration)
                        // 已在园区内或已设置起点
                        self.clearStart2End()
                        self.generateWalkRoute(newPath)
                        self.map.fitBounds([
                            latlng,
                            [data.spot.latitude, data.spot.longitude]
                        ])
                        self.map.closePopup()
                    })
                })
            }
            else {
                $(".zone_target").on("touchstart", function () {
                    // 不在园区内
                    self.isInPark()
                })
            }
    
            // 焦点图
            self.fnBannerShow()
            
        }, "json");
    },
    // 生成断点线路
    generateSplitPointRoute: function() {
        var self = this
        self.routePoint.forEach(function(item, index) {
            var path = antPath([
                [self.latLongMarkersArr[index+1].lng, self.latLongMarkersArr[index+1].lat],
                item
            ],
                {"delay":400,"dashArray":[10,20],"weight":5,"color":"#00a0e9","opacity": 1,"fillOpacity": 1,"pulseColor":"#41d3ff","paused":false,"reverse":false}
            )
            path.addTo(self.map)
            self.splitPath.push(path)
        })
    },
    // 生成线路
    generateWalkRoute: function(route) {
        this.path = antPath(route,
            {"delay":400,"dashArray":[10,20],"weight":5,"color":"#00a0e9","opacity": 1,"fillOpacity": 1,"pulseColor":"#41d3ff","paused":false,"reverse":false}
        )
        this.path.addTo(this.map)

        $(".zone_box_con_wrap").removeClass("active");
        $(".zone_box").empty();
        $(".pop_video_box_wrap").empty();
        $(".scenic_list_con").removeClass("active");
        // $(".scenic_list_close").addClass("hide");
    },
    // 详情焦点图
    fnBannerShow: function() {
        var swiper = new Swiper('.swiper-container', {
            pagination: '.swiper-pagination',
            paginationClickable: true,
            speed: 800,
            spaceBetween: 0,
            loop: true,
            autoplay: 3000,
        });
    },
    // 推荐路线列表
    recommendLine: function() {
        var self = this
        $.post(this.opts.recommendroutes, { type: "routes" }, function (data, status, xhr) {
            // console.log(data);
            if(data.routes.length > 0) {
                for (var index = 0; index < data.routes.length; index++) {
                    $(".recommend_line_wrap").append(
                        '<div class="recommend_line_box">' +
                            '<div class="recommend_line_title_wrap">' +
                                '<div class="recommend_line_title">' +
                                    '<h3>' + data.routes[index].name + '</h3>' +
                                    '<p>' + '景点数' + data.routes[index].spotcount + '个' + '&nbsp;' + '|' + '&nbsp;' + '全程' + data.routes[index].distance + '公里' + '&nbsp;' + '|' + '&nbsp;' + '约' + data.routes[index].time + '</p>' +
                                '</div>' +
                                '<a href="javascript:;" class="showSpot_btn" id="' + data.routes[index].id + '">查看</a>' +
                            '</div>' +
                        '</div>'
                    )
                }
            }else {
                $(".recommend_line_wrap").html('<p style="line-height:40px;text-align:center;">暂无推荐路线</p>')
            }
        
            setTimeout(function(){
                // 打开路线推荐
                $(".route_item").on("touchstart", function () {
                    $(".recommend_line_con").addClass("active");
                })
                // 关闭路线推荐
                $(".recommend_line_close i").on("touchstart", function () {
                    $(".recommend_line_con").removeClass("active");
                })
        
                // 推荐线路详情
                $(".showSpot_btn").on("touchstart", function (obj) {
                    var that = $(this);
        
                    // 隐藏右上角切换
                    $(".zone_type_con").addClass("hide");
                    $(".close_search").hide()
                    $("#list_mode_btn").hide()

                    $(".scroll_hotspot").hide()
                    
                    $("#search_list_mode_btn").hide()

                    // 显示路线推荐
                    $(".recommend_line_spot_con").addClass("active");
                    $(".recommend_line_con").removeClass("active");

                    self.map.closePopup()
        
                    $.post(self.opts.recommendroutes, { type: "route", id: that.attr("id") }, function (data, status, xhr) {

                        self.clearStart2End()
                        self.clearMarker()
        
                        // 插入路线推荐列表
                        $(".recommend_line_box_spot_wrap").append(
                            '<div class="recommend_line_box">' +
                                '<div class="recommend_line_title_wrap">' +
                                    '<div class="recommend_line_title">' +
                                        '<h3>' + data.route.name + '</h3>' +
                                        '<p>' + '景点数' + data.route.spotcount + '个' + '&nbsp;' + '|' + '&nbsp;' + '全程' + data.route.distance + '公里' + '&nbsp;' + '|' + '&nbsp;' + '约' + data.route.time + '</p>' +
                                    '</div>' +
                                    '<a href="javascript:;" class="line_spot_list_close_btn" id="clearMarker"></a>' +
                                '</div>' +
                            '</div>'
                        );
                        
                        for (var index = 0; index < data.route.spots.length; index++) {
                            self.latLongMarkersArr.push(L.latLng(data.route.spots[index].longitude, data.route.spots[index].latitude)); //获取marker标点位置

                            $(".recommend_line_spot_list_btn").append(
                                '<a href="javascript:;" longitude="' + data.route.spots[index].longitude + '" latitude="' + data.route.spots[index].latitude + '">' + '<em>' + (index + 1) + '</em>' + '<i>' + data.route.spots[index].name + '</i></a>'
                            )
                        }

                        $(".recommend_line_spot_list_btn_wrap").mCustomScrollbar("destroy")
                        $(".recommend_line_spot_list_btn_wrap").mCustomScrollbar({
                            theme:"light",
                            axis:"x"
                        });
        
        
                        // 后台返回
                        if(data.route.spots.length > 1) {
                            var paths = ""
                            var newPath = []
                            for (var i = 0; i < data.route.spots.length; i++) {
                                var spot = data.route.spots[i]
                                paths += spot.path + ";"
                            }
                            paths = paths.slice(1, paths.length-1)
                            paths = paths.split(";")
                            paths.forEach(function(item, index) {
                                var newItem = item.split(",")
                                newPath.push([newItem[1], newItem[0]])
                            })
                            newPath.unshift([data.route.spots[0].latitude, data.route.spots[0].longitude])
                            newPath.push([data.route.spots[data.route.spots.length-1].latitude, data.route.spots[data.route.spots.length-1].longitude])

                            self.generateWalkRoute(newPath)

                            for (var j = 1; j < data.route.spots.length-1; j++) {
                                var spot = data.route.spots[j]
                                var points = spot.path.split(";")
                                var point = points[points.length-1].split(",")
                                self.routePoint.push([point[1], point[0]])
                            }

                            self.generateSplitPointRoute()
                            // self.map.setViewport([self.latLongMarkersArr[0], self.latLongMarkersArr[self.latLongMarkersArr.length-1]]);          //调整到最佳视野
                        }

                        self.map.setView(self.opts.center, self.opts.zoom, {
                            animate: false
                        })

                        var zoomHandler = function() {
                            $(".recommend_line_spot_con").addClass("hide");
                        }

                        self.map.once("zoomstart", zoomHandler)
                        

                        // 重置marker
                        self.markerClusterer.clearLayers()
        
                        // 创建路线marker
                        self.createrLineMarkers(self.latLongMarkersArr, data)
        
                        setTimeout(function(){
                            // 关闭线路推荐详情
                            $(".line_spot_list_close_btn").on("click", function () {
        
                                self.map.off("zoomstart", zoomHandler)
                                $(".recommend_line_spot_con").removeClass("active hide");
                                $(".recommend_line_con").addClass("active");
                                $(".recommend_line_box_spot_wrap,.recommend_line_spot_list_btn").empty();
                                
        
                                self.clearStart2End()
                                for (var j = 0, layer; layer = self.routeMarkersArr[j]; j++) {
                                    self.map.removeLayer(layer)
                                }
                                self.routeMarkersArr = []
                                self.latLongMarkersArr = []
                                self.createrDefMarker()
        
                                // 显示右上角切换 
                                $(".zone_type_con").removeClass("hide");
                                $("#list_mode_btn").css("display", "flex")
                                $(".zone_type a").eq(0).show().addClass("active").siblings().removeClass("active")
                                $(".zone_type a").eq(0).siblings().hide()
                                $(".scroll_hotspot").show()
                            })
        
                        },500)
        
                    }, "json");
                })
            },1500)
        
        }, "json");
    },
    // 创建路线marker
    createrLineMarkers: function(obj, mapData) {
        var mapPoint = mapData.route.spots
        var self = this
    
        var itemWidth = $(".recommend_line_spot_list_btn a").outerWidth(true)
        for (var i = 0; i < obj.length; i++) {
            var point = L.latLng(obj[i].lat, obj[i].lng)
            if (i == 0) {
                var marker = L.marker([obj[i].lng, obj[i].lat], {
                    icon: L.divIcon({
                        html: '<div class="marker_icons start">' + '起' + '</div>'
                    })
                })
                var className = "marker_name_start"
            } else if (i == obj.length - 1) {
                var marker = L.marker([obj[i].lng, obj[i].lat], {
                    icon: L.divIcon({
                        html: '<div class="marker_icons end">' + '终' + '</div>'
                    })
                })
                var className = "marker_name_end"
            } else {
                var marker = L.marker([obj[i].lng, obj[i].lat], {
                    icon: L.divIcon({
                        html: '<div class="marker_icons">' + (i + 1) + '</div>'
                    })
                })
                var className = "marker_name"
            }
            var toolTip = L.tooltip({
                permanent: true,
                opacity: 1,
                className: className,
                direction: "center"
            })
            
            marker.bindTooltip(toolTip).setTooltipContent(mapPoint[i].name).openTooltip()
            this.routeMarkersArr.push(marker)
            marker.addTo(this.map)

            var popup = L.popup({
                keepInView: false,
                minWidth: 230,
                offset: [0, -10],
                autoClose: false
            })
            .setLatLng([point.lng, point.lat])
            .setContent('<div class="info_box"' + 'id="' + mapPoint[i].id + '">' +
            '<div class="info_box_content"><div class="info_box_img"><div class="info_box_img_icon"><img src="' + mapPoint[i].img + '" alt=""></div><em class="pause"></em></div>' +
            '<div class="info_box_p">' + '<p>' + mapPoint[i].name + '</p>' + '<p class="info_box_area">' + mapPoint[i].area + '</p>' + '<p class="info_box_res"></p>' + '</div>' +
            '<div class="info_box_go" data-lng="'+obj[i].lng+'" data-lat="'+obj[i].lat+'"></div>' +
            '</div></div>');


            (function(index, markerPopup) {
                marker.on("click", function(e) {
                    self.map.openPopup(markerPopup)
                    setTimeout(function() {
                        $(".info_box_area").show()
                        $(".info_box_res").hide()
                    }, 100)
                    if(self.startMarker) {
                        setTimeout(function() {
                            $(".info_box").addClass("hasStart")
                        }, 100)
                    }else {
                        setTimeout(function() {
                            $(".info_box").removeClass("hasStart")
                        }, 100)
                    }
                    if(mapPoint[index].name == self.endMarkerName) {
                        setTimeout(function() {
                            $(".info_box_area").hide()
                            $(".info_box_res").html("<span>"+self.distance+"</span>米&nbsp;&nbsp;<span>"+self.duration+"</span>分钟")
                            $(".info_box_res").show()
                            $(".info_box_go").hide()
                        }, 110)
                    }else if(self.endMarkerName !== ""){
                        setTimeout(function() {
                            $(".info_box_go").show()
                        }, 110)
                    }
                    setTimeout(function() {
                        if(!mapPoint[index].audioUrl) {
                            $(".pause").hide()
                        }else {
                            $(".pause").show()
                        }
                        // 点击地图标点显示详情
                        $("#commentary").attr("src", mapPoint[index].audioUrl)
                        self.ontan(mapPoint[index].audioUrl, mapPoint[index].name)
                        self.map.panTo([obj[index].lng, obj[index].lat])
                    }, 200)
                    $(".recommend_line_spot_list_btn a").each(function() {
                        if(e.target.getLatLng().lng == Number($(this).attr("longitude"))) {
                            var j = $(this).index()
                            $(this).addClass("active").siblings().removeClass("active")
                            $(".recommend_line_spot_list_btn_wrap").mCustomScrollbar("scrollTo", -itemWidth*j+'px')
                        }
                    })
                })
            })(i, popup)

            // marker.bindPopup(popup)
        }

        $(".recommend_line_spot_list_btn a").on("click", function () {
            self.map.closePopup()

            var i = $(this).index();

            $(this).addClass("active").siblings().removeClass("active");
            $(".recommend_line_spot_list_btn_wrap").mCustomScrollbar("scrollTo", -itemWidth*i+'px')

            var popup = L.popup({
                keepInView: false,
                minWidth: 230,
                offset: [0, -10],
                autoClose: false
            })
            .setLatLng([$(this).attr("latitude"), $(this).attr("longitude")])
            .setContent('<div class="info_box"' + 'id="' + mapPoint[i].id + '">' +
            '<div class="info_box_content"><div class="info_box_img"><div class="info_box_img_icon"><img src="' + mapPoint[i].img + '" alt=""></div><em class="pause"></em></div>' +
            '<div class="info_box_p">' + '<p>' + mapPoint[i].name + '</p>' + '<p class="info_box_area">' + mapPoint[i].area + '</p>' + '<p class="info_box_res"></p>' + '</div>' +
            '<div class="info_box_go" data-lng="'+obj[i].lng+'" data-lat="'+obj[i].lat+'"></div>' +
            '</div></div>');

            popup.openOn(self.map)

            setTimeout(function() {
                $(".info_box_area").show()
                $(".info_box_res").hide()
            }, 100)
            if(self.startMarker) {
                setTimeout(function() {
                    $(".info_box").addClass("hasStart")
                }, 100)
            }else {
                setTimeout(function() {
                    $(".info_box").removeClass("hasStart")
                }, 100)
            }
            if(mapPoint[i].name == self.endMarkerName) {
                setTimeout(function() {
                    $(".info_box_area").hide()
                    $(".info_box_res").html("<span>"+self.distance+"</span>米&nbsp;&nbsp;<span>"+self.duration+"</span>分钟")
                    $(".info_box_res").show()
                    $(".info_box_go").hide()
                }, 110)
            }else if(self.endMarkerName !== ""){
                setTimeout(function() {
                    $(".info_box_go").show()
                }, 110)
            }
            
            setTimeout(function() {
                if(!mapPoint[i].audioUrl) {
                    $(".pause").hide()
                }else {
                    $(".pause").show()
                }
                $("#commentary").attr("src", mapPoint[i].audioUrl)
                self.ontan(mapPoint[i].audioUrl, mapPoint[i].name)
            },100)
        })

    },
    // 清除起点至终点polyline
    clearStart2End: function() {
        var self = this
        if(this.path) {
            this.map.removeLayer(this.path)
        }
        if(this.splitPath) {
            this.splitPath.forEach(function(item, index) {
                self.map.removeLayer(item)
            })
            this.splitPath = []
            this.routePoint = []
        }
    },
    // 重置marker
    clearMarker: function() {
        for(var index = 0; index < this.markersArr.length; index++) {
            this.map.removeLayer(this.markersArr[index])
        }
        this.markersArr = []
        this.latLong = []
        this.typeIdArr = []
    },
    // 景区列表模式按钮
    changeListMode: function() {
        var self = this
        $("#list_mode_btn").on("click", function () {
            $(".scenic_list_con").addClass("active");
            // $(".scenic_list_close").removeClass("hide");
            $(".scenic_list_btn a").eq(0).addClass("active").siblings().removeClass("active");
            
            // 创建列表第一页内容
            self.createrZoneList(self.defZoneID, 0);
            
        })
        $(".scenic_list_close").on("touchstart", function () {
            $(".scenic_list_con").removeClass("active");
            // $(this).addClass("hide");
        })
        
        // 景区列表模式切换按钮
        setTimeout(function(){
            $(".scenic_list_btn a").on("click", function () {
                var ZoneListID = $(this).attr("id");
                $(this).addClass("active").siblings().removeClass("active");
        
                // 创建列表内容
                self.createrZoneList(ZoneListID, $(this).index());
        
                setTimeout(function(){
                    // 景区列表模式详情点击
                    $(".scenic_list_box li").on("click", function () {
                        $(".zone_box_con_wrap").addClass("active");
                        
                        self.createrDetails($(this).attr("id"), $(this).attr("data-index"))
                    })
                },500)
            })
        
            // 动物详情关闭按钮
            $(".zone_box_close i").on("click", function () {
                $(".zone_box_con_wrap").removeClass("active")
                $(".zone_box").empty();
                $(".pop_video_box_wrap").empty();
                self.shareId = ""
                self.shareCategory = -1
                self.shareDsec = "iMAP景区畅游系统"
                window.history.replaceState(null, null, location.protocol + "//" + location.host + location.pathname)
                self.sharePosition()
            })
        },1000)
    },
    // 创建景区列表模式
    createrZoneList: function(zoneID, i) {
        var self = this
        $(".scenic_list_box").empty();
        $.post(this.opts.searchSpots, { type: "category_spots", id: zoneID }, function (data, status, xhr) {
    
            for (var index = 0; index < data.spots.length; index++) {
                $(".scenic_list_box").append(
                    '<li id=' + data.spots[index].id + ' data-index='+i+'>' +
                        '<div class="scenic_list_box_img"><i><span style="background:url(' + self.categoriesIcon[i] + ') center center no-repeat;background-size:0.35rem auto;"></span></i><img src="' + data.spots[index].img + '" alt=""></div>' +
                        '<div class="scenic_list_box_text">' +
                            '<h4>' + data.spots[index].name + '</h4>' +
                            '<p>' + data.spots[index].area + '</p>' +
                        '</div>' +
                        '<div class="distance"><i></i></div>' +
                    '</li>'
                )
            }

            setTimeout(function () {
                // 景区列表模式详情点击
                $(".scenic_list_box li").on("click", function () {
                    $(".zone_box_con_wrap").addClass("active");
        
                    self.createrDetails($(this).attr("id"), $(this).attr("data-index"))
                })
            }, 500)
    
        }, "json");
    },
    // 创建景区介绍内容
    createrScenicIntro: function() {
        var self = this
        $.get(this.opts.introduction, function (data) {
            var tags = data.Tags.split(",")
            var TagSpan = ""
            tags.forEach(function(item) {
                TagSpan += "<span>"+item+"</span>"
            })
            $(".scenic_intro_con_text").append(
                '<div class="scenic_intro_con_text_overflow">' + 
                    '<div class="scenic_intro_con_text_inner">' + 
                        '<div class="scenic_intro_title_box">' +
                            '<div class="scenic_intro_title_box_top">' +
                                '<a href="javascript:;" class="scenic_intro_title_box_music_btn" style="background:url(' + data.ImageUrl + ');background-size:100% auto;"><i></i></a>' +
            
                                '<div class="scenic_intro_title_box_top_text">' +
                                    '<h3>' + data.Name + '</h3>' +
                                    '<div class="tag">'+TagSpan+'</div>' +
                                    '<a class="openLocationLink" href="javascript:;" target="_blank"><i></i>' + data.Address + '</a>' +
                                '</div>' +
                            '</div>' +
            
                            '<div class="scenic_intro_title_box_top_music">' +
                                '<audio src="' + data.AudioUrl + '" controls></audio>' +
                            '</div>' +
                        '</div >' +
            
                        '<div class="scenic_intro_wrap">' +
                            '<div class="scenic_intro_text">' + data.Introduction + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            )
            $(".openLocationLink").on("click", function() {
                wx.openLocation({
                    latitude: self.opts.wxCenter[0], // 纬度，浮点数，范围为90 ~ -90
                    longitude: self.opts.wxCenter[1], // 经度，浮点数，范围为180 ~ -180。
                    name: self.opts.locationName, // 位置名
                    address: self.opts.locationAddress, // 地址详情说明
                    scale: 15, // 地图缩放级别,整形值,范围从1~28。默认为最大
                    infoUrl: '', // 在查看位置界面底部显示的超链接,可点击跳转
                })
            })
        })
    },
    // 搜索请求
    handleSearch: function(query, callback) {
        if($.trim(query) == "") {
            alert("请输入关键词")
            return
        }
        var self = this
        $("#search_name").html(query)
        $("#keywords_list").val(query)
        $.post(this.opts.placeSearch, {query: query}, function(data) {
            if(data.length == 0) {
                alert("没有符合的结果")
                return
            }
            if(callback) {
                callback()
            }

            // console.log(data)
            var searchListContent = ""

            // 重置marker
            self.clearMarker()
            self.clearStart2End()
                
            for (var index = 0; index < data.length; index++) {
                self.latLong.push(L.latLng(data[index].longitude, data[index].latitude)); //获取marker标点位置
                for(var j=0;j<self.categoriesName.length;j++) {
                    if(data[index].category == self.categoriesName[j]) {
                        self.typeIdArr.push(j)
                        break
                    }
                }
                
                searchListContent += '<li id='+data[index].id+' data-index='+self.typeIdArr[index]+'>'+
                    '<div class="scenic_list_box_img"><i><span style="background:url(' + self.categoriesIcon[self.typeIdArr[index]] + ') center center no-repeat;background-size:0.35rem auto;"></span></i><img src="'+data[index].img+'" alt=""></div>'+
                    '<div class="scenic_list_box_text">'+
                        '<h4>'+data[index].name+'</h4>'+
                        '<p>'+data[index].area+'</p>'+
                    '</div>'+
                    '<div class="distance"><i></i></div>'+
                '</li>'
            }

            $(".search_result_list").html(searchListContent)

            $(".search_result_list li").on("click", function() {
                $(".zone_box_con_wrap").addClass("active")
                // 创建详情页内容
                self.createrDetails($(this).attr("id"), $(this).attr("data-index"))
            })

            self.createrMarkers(self.latLong, data, self.typeIdArr)

            self.map.setView(self.opts.center, self.opts.zoom, {
                animate: false
            })

        }, "json")
    },
    // 景区介绍按钮
    bindGetIntro: function() {
        var self = this
        $(".intro_item").on("click",function(){
            $(".scenic_intro_con").addClass("active");
        
            // 创建景区介绍内容
            self.createrScenicIntro();
        
            setTimeout(function () {
                $(".scenic_intro_close i").on("click", function () {
                    $(".scenic_intro_con").removeClass("active");
                    $(".scenic_intro_con_text").empty();
                })
        
                // 景区介绍音乐
                $(".scenic_intro_title_box_music_btn").on("click", function () {
                    if ($(this).hasClass("active")) {
                        $(this).removeClass("active");
                        $(".scenic_intro_title_box_top_music").find("audio")[0].pause();
                    } else {
                        $(this).addClass("active");
                        $(".scenic_intro_title_box_top_music").find("audio")[0].play();
                    }
                })
                $(".scenic_intro_title_box_top_music").find('audio').bind('play', function () {
                    $(".scenic_intro_title_box_music_btn").addClass("active");
                });
                $(".scenic_intro_title_box_top_music").find('audio').bind('pause', function () {
                    $(".scenic_intro_title_box_music_btn").removeClass("active");
                });
            }, 500)
        })
    },
    // 退出搜索模式
    quitSearch: function() {
        var self = this
        $(".close_search").on("click", function() {
            $(this).hide()
            self.createrDefMarker()
            $("#search_list_mode_btn").hide()
            $("#list_mode_btn").css("display", "flex")
            $(".zone_type_con").removeClass("hide");
            $(".zone_type a").eq(0).addClass("active").siblings().removeClass("active")
            $(".zone_type a").eq(0).show().siblings().hide()
        })
    },
    // 搜索按钮
    bindSearch: function() {
        var self = this
        $(".search_item").on("touchstart", function() {
            $(".search_box_con_wrap").addClass("active")
            // $("#keywords").trigger("focus")
        })
        $(".search_box_close i").on("touchstart", function() {
            $(".search_box_con_wrap").removeClass("active")
            $("#keywords").blur()
        })
        $("#keywords").on("focus", function() {
            // $("html,body").animate({"scrollTop": 0}, 1)
        }).on("search", function() {
            $(this).blur()
            self.handleSearch($(this).val(), function() {
                $(".close_search").css("display", "flex")
                $(".search_box_con_wrap").removeClass("active")
                $("#search_list_mode_btn").css("display", "flex")
                $("#list_mode_btn").hide()
                $(".zone_type_con").addClass("hide");
            })
        })
        $(".confirm").on("click", function() {
            $("#keywords").blur()
            self.handleSearch($("#keywords").val(), function() {
                $(".close_search").css("display", "flex")
                $(".search_box_con_wrap").removeClass("active")
                $("#search_list_mode_btn").css("display", "flex")
                $("#list_mode_btn").hide()
                $(".zone_type_con").addClass("hide");
            })
        })
        $("#keywords_list").on("search", function() {
            $(this).blur()
            self.handleSearch($(this).val())
        })
        $("#search_list_mode_btn").on("click", function() {
            $(".search_list_box_con_wrap").addClass("active")
        })
        $(".search_list_box_close").on("touchstart", function() {
            $(".search_list_box_con_wrap").removeClass("active")
        })
    },
    // 点击定位按钮定位
    bindGetPos: function() {
        var self = this
        $(".getLocBtn").on("touchstart",function(){
            self.endMarkerName = ""
            self.distance = 0
            self.duration = 0
            self.map.closePopup()
            self.getCurrentPosition(function() {
                self.clearStart2End()
                if(self.nowInPark) {                  
                    self.setStartMarker(self.nowLngLat)
                    self.map.panTo([self.nowLngLat.lng, self.nowLngLat.lat])
                }
            })
        })
    },
    // 关闭不在园区内提醒
    hideNotInPark: function() {
        var self = this
        $(".notInPark_close i").on("touchstart",function(){
            $(".notInPark").hide();
        })
    },
    // 关闭热点详情
    hideHotspotDetail: function() {
        $(".hotspot_detail_close i").on("touchstart",function() {
            $(".hotspot_detail_wrap").removeClass("active")
        })
    },
    // 关闭热点列表
    hideHotspotList: function() {
        $(".hotspot_close i").on("touchstart",function() {
            $(".hotspot_list_wrap").removeClass("active")
        })
    },
    // 指针旋转方向
    bindDeviceorientation: function() {
        window.addEventListener('deviceorientation',DeviceOrientationHandler,false)
        function DeviceOrientationHandler(e) {
            $(".navigation").css("transform", "rotateZ("+ e.webkitCompassHeading +"deg)")
            $(".navigation").css("webkitTransform", "rotateZ("+ e.webkitCompassHeading +"deg)")
        }
    },
    // 打开微信地图
    bindOpenLocation: function() {
        var self = this
        $(".openLocation").on("click", function() {
            wx.openLocation({
                latitude: self.opts.wxCenter[0], // 纬度，浮点数，范围为90 ~ -90
                longitude: self.opts.wxCenter[1], // 经度，浮点数，范围为180 ~ -180。
                name: '杭州野生动物世界', // 位置名
                address: '浙江省杭州市富阳区杭富路九龙大道1号', // 地址详情说明
                scale: 15, // 地图缩放级别,整形值,范围从1~28。默认为最大
                infoUrl: '', // 在查看位置界面底部显示的超链接,可点击跳转
            })
        })
    },
    // 关闭弹窗
    bindCloseOverlay: function() {
        Array.prototype.slice.call(document.getElementsByClassName("overlay")).forEach(function(item) {
            item.addEventListener("touchstart",function(e){
                if($(e)[0].target.className.match("overlay")) {
                    $(this).removeClass("active")
                }
            },true)
        })
    },
    // 绑定音频事件
    bindAudio: function() {
        $("#commentary")[0].onended = function() {
            $(".playing").removeClass("playing").addClass("pause")
            $(".info_box_img .info_box_img_icon").removeClass("active")
        }
        $("#commentary")[0].onplaying = function() {
            if($(".zone_media_audio audio").length > 0) {
                $(".zone_media_audio audio")[0].pause()
            }
        }
    },
    // 关闭欢迎
    bindCloseWelcome: function() {
        $(".welcome_card .close").on("click", function() {
            $(".welcome_wrap").removeClass("active")
        })
    },
    bind: function() {
        this.bindOpenLocation()
        this.hideHotspotDetail()
        this.hideHotspotList()
        this.hideNotInPark()
        this.bindCloseOverlay()
        this.bindGetPos()
        this.bindGetIntro()
        this.changeListMode()
        this.bindDeviceorientation()
        this.bindSearch()
        this.quitSearch()
        this.bindAudio()
        this.bindCloseWelcome()
    }
}


var customMap = new CustomMap()
customMap.init()



