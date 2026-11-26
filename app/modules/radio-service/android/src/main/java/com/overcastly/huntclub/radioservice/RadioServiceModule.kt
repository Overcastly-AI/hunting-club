package com.overcastly.huntclub.radioservice

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RadioServiceModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RadioService")

    /** Starts (or updates) the foreground service and its persistent notification. */
    Function("start") { title: String, body: String, channelName: String ->
      val intent = Intent(context, RadioLinkService::class.java)
        .putExtra(RadioLinkService.EXTRA_TITLE, title)
        .putExtra(RadioLinkService.EXTRA_BODY, body)
        .putExtra(RadioLinkService.EXTRA_CHANNEL_NAME, channelName)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stop") {
      context.stopService(Intent(context, RadioLinkService::class.java))
    }
  }
}
