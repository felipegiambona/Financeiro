package com.financas.mobile.notification;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

final class NotificationParser {
  private static final Pattern CURRENCY_AMOUNT = Pattern.compile(
    "(?i)R\\$\\s*([0-9][0-9.\\s]*(?:,[0-9]{2})?)"
  );
  private static final Pattern DECIMAL_AMOUNT = Pattern.compile(
    "\\b([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})\\b"
  );

  private NotificationParser() {}

  static JSONObject parse(String packageName, String appLabel, String title, String text, long postedAt) {
    String normalized = (title + " " + text).trim().toLowerCase(Locale.ROOT);
    boolean income = containsAny(normalized, "pix recebido", "recebimento", "recebido", "recebida", "crédito", "credito", "entrada", "depositado", "caiu na conta");
    boolean expense = containsAny(normalized, "pix enviado", "compra", "pagamento", "pagou", "débito", "debito", "saque", "tarifa", "fatura");
    if (!income && !expense) return null;

    BigDecimal amount = extractAmount(title + " " + text);
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return null;

    try {
      String fingerprint = hash(packageName + "|" + title + "|" + text + "|" + (postedAt / 60000));
      JSONObject recurrence = new JSONObject().put("kind", "none");
      Date date = new Date(postedAt > 0 ? postedAt : System.currentTimeMillis());
      String dateKey = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(date);
      String safeLabel = appLabel == null || appLabel.trim().isEmpty() ? "Notificação" : appLabel.trim();
      String safeTitle = title == null || title.trim().isEmpty()
        ? (income ? "Recebimento via notificação" : "Pagamento via notificação")
        : title.trim().substring(0, Math.min(title.trim().length(), 48));

      return new JSONObject()
        .put("id", fingerprint)
        .put("type", income && !expense ? "income" : "expense")
        .put("amount", amount.doubleValue())
        .put("description", safeLabel + " · " + safeTitle)
        .put("date", dateKey)
        .put("dueDate", JSONObject.NULL)
        .put("recurrence", recurrence)
        .put("paymentStatus", "paid");
    } catch (Exception ignored) {
      return null;
    }
  }

  private static BigDecimal extractAmount(String content) {
    Matcher currencyMatcher = CURRENCY_AMOUNT.matcher(content);
    if (currencyMatcher.find()) return parseBrazilianNumber(currencyMatcher.group(1));
    Matcher decimalMatcher = DECIMAL_AMOUNT.matcher(content);
    if (decimalMatcher.find()) return parseBrazilianNumber(decimalMatcher.group(1));
    return null;
  }

  private static BigDecimal parseBrazilianNumber(String value) {
    try {
      String normalized = value.replace(" ", "").replace(".", "").replace(",", ".");
      return new BigDecimal(normalized);
    } catch (Exception ignored) {
      return null;
    }
  }

  private static boolean containsAny(String value, String... terms) {
    for (String term : terms) {
      if (value.contains(term)) return true;
    }
    return false;
  }

  private static String hash(String value) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] bytes = digest.digest(value.getBytes("UTF-8"));
    StringBuilder result = new StringBuilder();
    for (byte item : bytes) result.append(String.format(Locale.ROOT, "%02x", item));
    return result.toString();
  }
}