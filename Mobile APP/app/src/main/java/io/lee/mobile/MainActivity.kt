package io.lee.mobile

import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.loadsImagesAutomatically = true
        settings.allowFileAccess = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Spoof User-Agent to bypass Google OAuth disallowed_useragent block
        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = defaultUserAgent
            .replace("; wv", "")
            .replace("Version/4.0 ", "")
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                if (url.contains("leeio-f1ab6.firebaseapp.com/__/auth/handler")) {
                    return false
                }
                view.loadUrl(url)
                return true
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                if (url != null && url.contains("leeio-f1ab6.firebaseapp.com/__/auth/handler")) {
                    var fragment = ""
                    val hashIndex = url.indexOf("#")
                    val queryIndex = url.indexOf("?")
                    if (hashIndex != -1) {
                        fragment = url.substring(hashIndex + 1)
                    } else if (queryIndex != -1) {
                        fragment = url.substring(queryIndex + 1)
                    }

                    if (fragment.isNotEmpty()) {
                        var accessToken = ""
                        var idToken = ""
                        val params = fragment.split("&")
                        for (param in params) {
                            val keyValue = param.split("=")
                            if (keyValue.size == 2) {
                                val key = keyValue[0]
                                val value = keyValue[1]
                                if (key == "access_token") {
                                    accessToken = value
                                } else if (key == "id_token") {
                                    idToken = value
                                }
                            }
                        }
                        if (accessToken.isNotEmpty() || idToken.isNotEmpty()) {
                            val localUrl = "https://appassets.androidplatform.net/assets/index.html?access_token=$accessToken&id_token=$idToken"
                            view?.post {
                                view.loadUrl(localUrl)
                            }
                        }
                    }
                }
            }
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }
}

