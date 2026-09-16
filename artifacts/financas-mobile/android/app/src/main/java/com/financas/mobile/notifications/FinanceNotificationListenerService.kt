package com.financas.mobile.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinanceNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    NotificationListenerStore.enqueue(this, sbn)
  }
}