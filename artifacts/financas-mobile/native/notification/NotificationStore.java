package com.financas.mobile.notification;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

final class NotificationStore {
  private static final String PREFS = "financas_notification_listener";
  private static final String QUEUE_KEY = "pending_transactions";
  private static final int MAX_QUEUE_SIZE = 100;

  private NotificationStore() {}

  private static JSONArray readQueue(Context context) {
    String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(QUEUE_KEY, "[]");
    try {
      return new JSONArray(raw);
    } catch (Exception ignored) {
      return new JSONArray();
    }
  }

  static synchronized void enqueue(Context context, JSONObject candidate) {
    JSONArray current = readQueue(context);
    String candidateId = candidate.optString("id", "");
    for (int index = 0; index < current.length(); index += 1) {
      if (candidateId.equals(current.optJSONObject(index).optString("id", ""))) return;
    }
    JSONArray next = new JSONArray();
    int start = Math.max(0, current.length() - MAX_QUEUE_SIZE + 1);
    for (int index = start; index < current.length(); index += 1) {
      next.put(current.optJSONObject(index));
    }
    next.put(candidate);
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(QUEUE_KEY, next.toString())
      .apply();
  }

  static synchronized JSONArray getPending(Context context) {
    return readQueue(context);
  }

  static synchronized void acknowledge(Context context, Set<String> acknowledgedIds) {
    if (acknowledgedIds.isEmpty()) return;
    JSONArray current = readQueue(context);
    JSONArray next = new JSONArray();
    for (int index = 0; index < current.length(); index += 1) {
      JSONObject item = current.optJSONObject(index);
      if (item != null && !acknowledgedIds.contains(item.optString("id", ""))) {
        next.put(item);
      }
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(QUEUE_KEY, next.toString())
      .apply();
  }

  static synchronized void clear(Context context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .remove(QUEUE_KEY)
      .apply();
  }

  static Set<String> idsFromJsonArray(JSONArray ids) {
    Set<String> result = new HashSet<>();
    for (int index = 0; index < ids.length(); index += 1) {
      String id = ids.optString(index, "");
      if (!id.isEmpty()) result.add(id);
    }
    return result;
  }
}