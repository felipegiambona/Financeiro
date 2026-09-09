package com.financas.mobile.notification;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

public class FinancasNotificationListenerModule extends ReactContextBaseJavaModule {
  public FinancasNotificationListenerModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "FinancasNotificationListener";
  }

  @ReactMethod
  public void isNotificationListenerEnabled(Promise promise) {
    try {
      String enabledListeners = Settings.Secure.getString(
        getReactApplicationContext().getContentResolver(),
        "enabled_notification_listeners"
      );
      String component = new ComponentName(
        getReactApplicationContext(),
        FinancasNotificationListenerService.class
      ).flattenToString();
      promise.resolve(enabledListeners != null && enabledListeners.contains(component));
    } catch (Exception error) {
      promise.reject("NOTIFICATION_LISTENER_STATUS_FAILED", error);
    }
  }

  @ReactMethod
  public void openNotificationListenerSettings(Promise promise) {
    try {
      Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_LISTENER_SETTINGS_FAILED", error);
    }
  }

  @ReactMethod
  public void getPendingNotifications(Promise promise) {
    try {
      JSONArray pending = NotificationStore.getPending(getReactApplicationContext());
      WritableArray result = Arguments.createArray();
      for (int index = 0; index < pending.length(); index += 1) {
        JSONObject item = pending.optJSONObject(index);
        if (item == null) continue;
        WritableMap map = Arguments.createMap();
        map.putString("id", item.optString("id", ""));
        map.putString("type", item.optString("type", "expense"));
        map.putDouble("amount", item.optDouble("amount", 0));
        map.putString("description", item.optString("description", "Lançamento via notificação"));
        map.putString("date", item.optString("date", ""));
        map.putString("paymentStatus", item.optString("paymentStatus", "paid"));
        WritableMap recurrence = Arguments.createMap();
        recurrence.putString("kind", "none");
        map.putMap("recurrence", recurrence);
        result.pushMap(map);
      }
      promise.resolve(result);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_QUEUE_READ_FAILED", error);
    }
  }

  @ReactMethod
  public void acknowledgeNotifications(ReadableArray ids, Promise promise) {
    try {
      JSONArray jsonIds = new JSONArray();
      for (int index = 0; index < ids.size(); index += 1) {
        jsonIds.put(ids.getString(index));
      }
      Set<String> acknowledgedIds = NotificationStore.idsFromJsonArray(jsonIds);
      NotificationStore.acknowledge(getReactApplicationContext(), acknowledgedIds);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_QUEUE_ACK_FAILED", error);
    }
  }

  @ReactMethod
  public void clearPendingNotifications(Promise promise) {
    try {
      NotificationStore.clear(getReactApplicationContext());
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOTIFICATION_QUEUE_CLEAR_FAILED", error);
    }
  }
}