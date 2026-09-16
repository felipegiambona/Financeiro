package com.financas.mobile.notifications

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

internal object NotificationListenerStore {
  private const val PREFERENCES = "finance_notification_listener"
  private const val ENABLED = "enabled"
  private const val ALLOWED_PACKAGES = "allowed_packages"
  private const val EVENTS = "events"
  private const val MAX_EVENTS = 100

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  fun isEnabled(context: Context): Boolean =
    preferences(context).getBoolean(ENABLED, false)

  fun setEnabled(context: Context, enabled: Boolean) {
    preferences(context).edit().putBoolean(ENABLED, enabled).apply()
  }

  fun getAllowedPackages(context: Context): Set<String> =
    preferences(context).getStringSet(ALLOWED_PACKAGES, emptySet()).orEmpty()

  fun setAllowedPackages(context: Context, packages: Set<String>) {
    preferences(context).edit().putStringSet(ALLOWED_PACKAGES, packages).apply()
  }

  fun pendingEvents(context: Context): JSONArray =
    readEvents(preferences(context).getString(EVENTS, "[]"))

  fun enqueue(context: Context, notification: StatusBarNotification) {
    if (!isEnabled(context)) return
    if (notification.packageName !in getAllowedPackages(context)) return

    val title = notification.notification.extras
      ?.getCharSequence("android.title")
      ?.toString()
      ?.trim()
      .orEmpty()
    val text = (
      notification.notification.extras?.getCharSequence("android.bigText")
        ?: notification.notification.extras?.getCharSequence("android.text")
      )
      ?.toString()
      ?.trim()
      .orEmpty()
    if (title.isEmpty() && text.isEmpty()) return

    val eventId = "${notification.packageName}|${notification.key}|${notification.postTime}"
    val current = pendingEvents(context)
    for (index in 0 until current.length()) {
      if (current.optJSONObject(index)?.optString("eventId") == eventId) return
    }

    current.put(JSONObject().apply {
      put("eventId", eventId)
      put("packageName", notification.packageName)
      put("title", title)
      put("text", text)
      put("postedAt", notification.postTime)
    })
    while (current.length() > MAX_EVENTS) {
      current.remove(0)
    }
    preferences(context).edit().putString(EVENTS, current.toString()).apply()
  }

  fun acknowledge(context: Context, eventIds: Set<String>) {
    if (eventIds.isEmpty()) return
    val current = pendingEvents(context)
    val remaining = JSONArray()
    for (index in 0 until current.length()) {
      val event = current.optJSONObject(index) ?: continue
      if (event.optString("eventId") !in eventIds) remaining.put(event)
    }
    preferences(context).edit().putString(EVENTS, remaining.toString()).apply()
  }

  fun hasListenerAccess(context: Context): Boolean {
    val enabledListeners = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners",
    ) ?: return false
    val expected = ComponentName(context, FinanceNotificationListenerService::class.java)
    return enabledListeners.split(':')
      .mapNotNull(ComponentName::unflattenFromString)
      .any { it == expected }
  }

  private fun readEvents(value: String): JSONArray =
    try {
      JSONArray(value)
    } catch (_: Exception) {
      JSONArray()
    }
}