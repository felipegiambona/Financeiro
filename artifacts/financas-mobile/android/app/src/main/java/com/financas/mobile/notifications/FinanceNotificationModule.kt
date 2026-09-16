package com.financas.mobile.notifications

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import android.content.Intent

class FinanceNotificationModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "FinanceNotificationListener"

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      val result = Arguments.createMap()
      result.putBoolean("enabled", NotificationListenerStore.isEnabled(context))
      result.putBoolean("listenerAccessGranted", NotificationListenerStore.hasListenerAccess(context))
      result.putInt("pendingCount", NotificationListenerStore.pendingEvents(context).length())
      val packages = Arguments.createArray()
      NotificationListenerStore.getAllowedPackages(context).sorted().forEach(packages::pushString)
      result.putArray("allowedPackages", packages)
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_STATUS_FAILED", error)
    }
  }

  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    NotificationListenerStore.setEnabled(context, enabled)
    promise.resolve(null)
  }

  @ReactMethod
  fun setAllowedPackages(packages: ReadableArray, promise: Promise) {
    val normalized = mutableSetOf<String>()
    for (index in 0 until packages.size()) {
      packages.getString(index)?.trim()?.takeIf { it.isNotEmpty() }?.let(normalized::add)
    }
    NotificationListenerStore.setAllowedPackages(context, normalized)
    promise.resolve(null)
  }

  @ReactMethod
  fun getPendingEvents(promise: Promise) {
    try {
      val result = Arguments.createArray()
      val events = NotificationListenerStore.pendingEvents(context)
      for (index in 0 until events.length()) {
        val event = events.optJSONObject(index) ?: continue
        val item = Arguments.createMap()
        item.putString("eventId", event.optString("eventId"))
        item.putString("packageName", event.optString("packageName"))
        item.putString("title", event.optString("title"))
        item.putString("text", event.optString("text"))
        item.putDouble("postedAt", event.optLong("postedAt").toDouble())
        result.pushMap(item)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_EVENTS_FAILED", error)
    }
  }

  @ReactMethod
  fun acknowledgeEvents(eventIds: ReadableArray, promise: Promise) {
    val ids = mutableSetOf<String>()
    for (index in 0 until eventIds.size()) {
      eventIds.getString(index)?.let(ids::add)
    }
    NotificationListenerStore.acknowledge(context, ids)
    promise.resolve(null)
  }

  @ReactMethod
  fun clearEvents(promise: Promise) {
    NotificationListenerStore.acknowledge(
      context,
      NotificationListenerStore.pendingEvents(context).let { events ->
        buildSet {
          for (index in 0 until events.length()) {
            events.optJSONObject(index)?.optString("eventId")?.let(::add)
          }
        }
      },
    )
    promise.resolve(null)
  }

  @ReactMethod
  fun openSettings(promise: Promise) {
    try {
      val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_SETTINGS_FAILED", error)
    }
  }
}