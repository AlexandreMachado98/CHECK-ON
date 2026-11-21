package com.checkon.app

import android.app.Application
import android.os.Build
import com.checkon.app.data.Api
import com.checkon.app.data.LocalStore
import com.checkon.app.data.Photos
import com.checkon.app.data.Repository
import com.checkon.app.data.Rules
import com.checkon.app.data.SessionStore
import com.checkon.app.data.ThemeSettings

class CheckOnApp : Application() {
    lateinit var repository: Repository
        private set
    lateinit var themeSettings: ThemeSettings
        private set

    override fun onCreate() {
        super.onCreate()
        themeSettings = ThemeSettings(this)
        val sessions = SessionStore(this)
        // Ex.: "Android 15 - samsung SM-A256E - app 1.0.0" (aparece no portal em "Enviada do aparelho").
        val device = Rules.asciiOnly("Android ${Build.VERSION.RELEASE} - ${Build.MANUFACTURER} ${Build.MODEL} - app ${BuildConfig.VERSION_NAME}")
        repository = Repository(sessions, Api(sessions, device), LocalStore(this), Photos(this))
    }
}
