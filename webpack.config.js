var webpack = require("webpack")
var path = require("path")
var ExtractTextPlugin = require('extract-text-webpack-plugin')
var CopyWebpackPlugin = require("copy-webpack-plugin")
var HtmlWebpackPlugin = require("html-webpack-plugin")
var production = process.env.NODE_ENV === "production"

var messup = production ? {
    test: /\.js$/,
    loader: 'decent-messup/loader',
    options: {
        headCnt: 5,
        es6: true
    },
    exclude: /node_modules/
} : {}

module.exports = {
    entry: {
        build: "./src/main.js"
    },
    output: {
        path: path.resolve(__dirname, "leaflet-map"),
        filename: "js/[name].[chunkhash:8].js"
    },
    module: {
        rules: [
            {
                test: /\.html$/,
                loader: "html-loader"
            },
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {
                            loader: "css-loader",
                            options: {
                                importLoaders: 1
                            }
                        },
                        "postcss-loader"
                    ]
                })
            },
            messup,
            {
                test: /\.js$/,
                loader: "babel-loader",
                exclude: /node_modules/
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/,
                loader: "url-loader",
                options: {
                    limit: 3000,
                    name: "images/[name].[hash:7].[ext]",
                    publicPath: '..'
                }
            },
            { test: /jquery-mousewheel/, loader: "imports-loader?define=>false&this=>window" },
			{ test: /malihu-custom-scrollbar-plugin/, loader: "imports-loader?define=>false&this=>window" }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
            'window.$': 'jquery',
            'window.jQuery': 'jquery'
        }),
        new HtmlWebpackPlugin({
            template: "./src/index.html"
        }),
        new ExtractTextPlugin({
            filename: "css/[name].css"
        }),
        new CopyWebpackPlugin([
            {
                from: path.join(__dirname, "./src/tiles"),
                to: path.join(__dirname, "./leaflet-map/tiles")
            }
        ])
    ],
    optimization: {
        minimize: true
    },
    devServer: {
        port: 2079,
        host: "192.168.8.119",
        proxy: {
            "/Introduction": {
                target: "https://www.ipow.cn/HzspMapBaiduServices/api/scenic/Introduction",
                secure: true,
                pathRewrite: {"^/Introduction" : ""},
                changeOrigin: true
            },
            "/WeiXin": {
                target: "https://www.ipow.cn/Data_Interface/WeiXin.aspx",
                secure: true,
                pathRewrite: {"^/WeiXin" : ""},
                changeOrigin: true
            }
        }
    },
    mode: "development"
}