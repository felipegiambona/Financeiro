package com.financas.mobile.notification;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

public class FinancasNotificationListenerService extends NotificationListenerService {
  @Override
  public void onNotificationPosted(StatusBarNotification statusBarNotification) {
    if (statusBarNotification == null || getPackageName().equals(statusBarNotification.getPackageName())) return;
    Notification notification = statusBarNotification.getNotification();
    if (notification == null || notification.extras == null) return;

    Bundle extras = notification.extras;
    String title = readText(extras, Notification.EXTRA_TITLE);
    String text = readText(extras, Notification.EXTRA_BIG_TEXT);
    if (text.isEmpty()) text = readText(extras, Notification.EXTRA_TEXT);
    if (title.isEmpty() && text.isEmpty()) return;

    String appLabel = statusBarNotification.getPackageName();
    try {
      ApplicationInfo applicationInfo = getPackageManager().getApplicationInfo(statusBarNotification.getPackageName(), 0);
      appLabel = getPackageManager().getApplicationLabel(applicationInfo).toString();
    } catch (PackageManager.NameNotFoundException ignored) {
      // The package can disappear while the notification is being processed.
    }

    org.json.JSONObject candidate = NotificationParser.parse(
      statusBarNotification.getPackageName(),
      appLabel,
      title,
      text,
      statusBarNotification.getPostTime()
    );
    if (candidate != null) NotificationStore.enqueue(this, candidate);
  }

  private String readText(Bundle extras, String key) {
    CharSequence value = extras.getCharSequence(key);
    return value == null ? "" : value.toString();
  }
}