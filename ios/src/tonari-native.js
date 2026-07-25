/* となりの栄養士 — iOS ネイティブ橋渡し (tonari-native.js)
 * =====================================================================
 * index.html には一切手を入れず、この1ファイルだけで
 * 「Web ではできないこと」を iOS のネイティブ機能に差し替えます。
 *
 *   1. リマインダー通知
 *      Web 版はアプリを開いている間しか通知できません（Web Push はサーバー必須）。
 *      iOS では端末内でスケジュールする通知に差し替え、アプリを完全に閉じていても
 *      設定時刻に届くようにします。記録済みの日は通知しません。
 *
 *   2. アプリアイコンのバッジ
 *      navigator.setAppBadge / clearAppBadge を iOS の実装に差し替えます。
 *      （index.html 側は "setAppBadge" in navigator を見て呼ぶだけなので、
 *        アプリ側のコードは変更不要です）
 *
 *   3. CSV の書き出し
 *      WKWebView では <a download> が働かず、ファイルを保存できません。
 *      アンカーのクリックを横取りして、iOS の共有シート（AirDrop・メール・
 *      「ファイル」アプリに保存 等）に流します。
 *
 *   4. 記録データの自動バックアップ
 *      localStorage への保存に合わせて、アプリ専用領域の JSON ファイルにも
 *      同じ内容を書き出します。万一 localStorage が空になっていた場合は
 *      起動時に自動で書き戻します（iCloud バックアップの対象にもなります）。
 *
 *   5. 触覚フィードバック / ステータスバー / 起動画面
 *      ボタン操作に iOS の軽いハプティクスを添え、見た目を整えます。
 *
 * ブラウザ（GitHub Pages）で開いたときは、この処理はすべて素通りします。
 * つまり Web 版の挙動は今までどおりです。
 */
(function () {
  "use strict";

  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) {
    return; // ブラウザ（PWA）では何もしない
  }

  var P = Cap.Plugins || {};
  var LocalNotifications = P.LocalNotifications;
  var Filesystem = P.Filesystem;
  var Share = P.Share;
  var App = P.App;
  var Haptics = P.Haptics;
  var StatusBar = P.StatusBar;
  var SplashScreen = P.SplashScreen;
  // バッジは @capawesome/capacitor-badge（Badge）を使う。
  // 自作のネイティブ拡張（ios/native/）を入れた場合は TonariBadge が使われる。
  // どちらも無ければバッジ機能だけが静かに無効になる。
  var Badge = P.Badge || P.TonariBadge;

  var STORAGE_KEY = "tonari-data";        // index.html が使っている保存キー
  var BACKUP_PATH = "tonari-backup.json"; // 自動バックアップ先（Library 配下）
  var NOTIF_ID_BASE = 4200;               // 通知 ID の起点
  var NOTIF_DAYS_AHEAD = 14;              // 何日先まで予約しておくか

  function log() {
    if (!window.__tonariDebug) return;
    console.log.apply(console, ["[tonari-native]"].concat([].slice.call(arguments)));
  }

  /* ------------------------------------------------------------------
   * 保存データの読み取り（index.html と同じ判定を、書き換えずに再現する）
   * ---------------------------------------------------------------- */

  function readState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /** index.html の dateKey と同じ「端末ローカル日付」の文字列。 */
  function dateKey(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  /** index.html の recorded(d) 相当: 食事SV・補食回数・間食の種類のどれかがあるか。 */
  function recordedOn(day) {
    if (!day || typeof day !== "object") return false;
    var sv = day.sv && typeof day.sv === "object" ? day.sv : {};
    var total = 0;
    Object.keys(sv).forEach(function (k) {
      var n = Number(sv[k]);
      if (isFinite(n)) total += n;
    });
    if (total > 0) return true;
    if (Number(day.snacks) > 0) return true;
    var kinds = day.snackKinds && typeof day.snackKinds === "object" ? day.snackKinds : {};
    return Object.keys(kinds).some(function (k) {
      return !!kinds[k];
    });
  }

  /** "21:00" → {h:21, m:0}。壊れていれば既定の 21:00。 */
  function parseTime(str) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(str || ""));
    if (!m) return { h: 21, m: 0 };
    var h = Math.min(23, Math.max(0, Number(m[1])));
    var min = Math.min(59, Math.max(0, Number(m[2])));
    return { h: h, m: min };
  }

  /* ------------------------------------------------------------------
   * 1. リマインダー通知（アプリを閉じていても届く）
   * ---------------------------------------------------------------- */

  var permissionAsked = false;

  async function ensurePermission(interactive) {
    if (!LocalNotifications) return false;
    try {
      var cur = await LocalNotifications.checkPermissions();
      if (cur.display === "granted") return true;
      if (cur.display === "denied") return false;
      // 未確認のときだけ OS のダイアログを出す（利用者が通知を ON にした直後）
      if (!interactive || permissionAsked) return false;
      permissionAsked = true;
      var res = await LocalNotifications.requestPermissions();
      return res.display === "granted";
    } catch (e) {
      log("permission error", e);
      return false;
    }
  }

  /** 自分が予約した通知だけを取り消す（他プラグインの通知には触らない）。 */
  async function cancelOurs() {
    try {
      var pending = await LocalNotifications.getPending();
      var mine = (pending.notifications || []).filter(function (n) {
        return n.id >= NOTIF_ID_BASE && n.id < NOTIF_ID_BASE + NOTIF_DAYS_AHEAD;
      });
      if (mine.length) {
        await LocalNotifications.cancel({
          notifications: mine.map(function (n) {
            return { id: n.id };
          })
        });
      }
    } catch (e) {
      log("cancel error", e);
    }
  }

  var syncTimer = null;

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncReminders();
    }, 1200);
  }

  async function syncReminders() {
    if (!LocalNotifications) return;

    var S = readState();
    var reminder = S && S.reminder ? S.reminder : null;
    var on = !!(reminder && reminder.on);

    await cancelOurs();
    await updateBadgeFromState(S);

    if (!on || !S || !S.profile || !S.consent) return;

    // 利用者が通知を ON にしているので、この文脈なら許可を求めてよい
    var ok = await ensurePermission(true);
    if (!ok) return;

    var t = parseTime(reminder.time);
    var name = S.profile && S.profile.name ? S.profile.name + "さん、" : "";
    var body = name + "今日の食事はまだ記録されていません。1分だけ、今日の分をつけませんか？";

    var now = new Date();
    var todayKey = dateKey(now);
    var days = S.days && typeof S.days === "object" ? S.days : {};
    var list = [];

    for (var i = 0; i < NOTIF_DAYS_AHEAD; i++) {
      var at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, t.h, t.m, 0, 0);
      if (at.getTime() <= now.getTime()) continue;                 // 過ぎた時刻は予約しない
      if (i === 0 && recordedOn(days[todayKey])) continue;         // 今日はもう記録済み
      list.push({
        id: NOTIF_ID_BASE + i,
        title: "となりの栄養士",
        body: body,
        schedule: { at: at, allowWhileIdle: true }
      });
    }

    if (!list.length) return;
    try {
      await LocalNotifications.schedule({ notifications: list });
      log("scheduled", list.length, "notifications from", list[0].schedule.at);
    } catch (e) {
      log("schedule error", e);
    }
  }

  /* ------------------------------------------------------------------
   * 2. アプリアイコンのバッジ
   * ---------------------------------------------------------------- */

  async function setBadge(count) {
    if (!Badge) return; // バッジ用プラグインが未導入なら何もしない
    try {
      if (count > 0) await Badge.set({ count: count });
      else if (Badge.clear) await Badge.clear();
      else await Badge.set({ count: 0 });
    } catch (e) {
      log("badge error", e);
    }
  }

  /** 保存データから「今日はまだ未記録か」を判定してバッジを更新する。 */
  async function updateBadgeFromState(S) {
    if (!S) S = readState();
    var reminder = S && S.reminder ? S.reminder : null;
    if (!S || !S.profile || !S.consent || !reminder || !reminder.on) return setBadge(0);
    var days = S.days && typeof S.days === "object" ? S.days : {};
    if (recordedOn(days[dateKey(new Date())])) return setBadge(0);
    var t = parseTime(reminder.time);
    var now = new Date();
    var due = now.getHours() * 60 + now.getMinutes() >= t.h * 60 + t.m;
    return setBadge(due ? 1 : 0);
  }

  // index.html は "setAppBadge" in navigator を見てから呼ぶ。
  // ここで生やしておけば、アプリ側のコードを変えずに iOS のバッジが動く。
  if (Badge && !("setAppBadge" in navigator)) {
    try {
      Object.defineProperty(navigator, "setAppBadge", {
        value: function (n) {
          return setBadge(typeof n === "number" ? n : 1);
        },
        configurable: true
      });
      Object.defineProperty(navigator, "clearAppBadge", {
        value: function () {
          return setBadge(0);
        },
        configurable: true
      });
    } catch (e) {
      log("badge polyfill failed", e);
    }
  }

  /* ------------------------------------------------------------------
   * 3. CSV 書き出し → iOS の共有シート
   * ---------------------------------------------------------------- */

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.onload = function () {
        var s = String(reader.result || "");
        var comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s); // data:...;base64, を落とす
      };
      reader.readAsDataURL(blob);
    });
  }

  async function shareDownload(href, filename) {
    var res = await fetch(href);
    var blob = await res.blob();
    var base64 = await blobToBase64(blob);
    // 「ファイル」アプリからも取り出せるよう Documents に置く
    await Filesystem.writeFile({ path: filename, data: base64, directory: "DOCUMENTS" });
    var uri = await Filesystem.getUri({ path: filename, directory: "DOCUMENTS" });
    await Share.share({
      title: "となりの栄養士の記録",
      text: "食生活の記録（CSV）",
      files: [uri.uri]
    });
  }

  if (Filesystem && Share) {
    var origAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      var name = this.getAttribute("download");
      var href = this.getAttribute("href") || this.href || "";
      if (name && /^blob:/.test(href)) {
        // index.html の exportCSV() はここを通る。href が revoke される前に読み切る。
        shareDownload(href, name).catch(function (e) {
          log("share failed", e);
          window.alert(
            "書き出しに失敗しました。時間をおいてもう一度お試しください。\n(" + (e && e.message ? e.message : e) + ")"
          );
        });
        return;
      }
      return origAnchorClick.apply(this, arguments);
    };
  }

  /* ------------------------------------------------------------------
   * 4. 記録データの自動バックアップと復元
   * ---------------------------------------------------------------- */

  var backupTimer = null;

  function scheduleBackup() {
    if (!Filesystem) return;
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = setTimeout(function () {
      backupTimer = null;
      writeBackup();
    }, 1500);
  }

  async function writeBackup() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      await Filesystem.writeFile({
        path: BACKUP_PATH,
        data: raw,
        directory: "LIBRARY", // アプリ専用の非公開領域。iCloud バックアップの対象になる
        encoding: "utf8",
        recursive: true
      });
      log("backup written", raw.length, "bytes");
    } catch (e) {
      log("backup error", e);
    }
  }

  /** 記録も設定も何も入っていない状態か。 */
  function looksEmpty(S) {
    if (!S || typeof S !== "object") return true;
    if (S.profile || S.consent) return false;
    var days = S.days && typeof S.days === "object" ? S.days : {};
    return !Object.keys(days).some(function (k) {
      return recordedOn(days[k]);
    });
  }

  async function restoreIfEmpty() {
    if (!Filesystem) return;
    // 復元 → reload の無限ループを防ぐ（sessionStorage は再読み込みでも残る）
    try {
      if (window.sessionStorage.getItem("tonari-native-restored")) return;
    } catch (e) {
      /* sessionStorage が使えない環境では素通り */
    }

    if (!looksEmpty(readState())) return;

    var raw;
    try {
      var got = await Filesystem.readFile({
        path: BACKUP_PATH,
        directory: "LIBRARY",
        encoding: "utf8"
      });
      raw = typeof got.data === "string" ? got.data : null;
    } catch (e) {
      return; // バックアップがまだ無い（初回起動）
    }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (looksEmpty(parsed)) return; // 中身も空なら書き戻す意味がない

    try {
      window.sessionStorage.setItem("tonari-native-restored", "1");
    } catch (e) {
      /* 続行 */
    }
    window.localStorage.setItem(STORAGE_KEY, raw);
    log("restored from backup, reloading");
    window.location.reload();
  }

  // localStorage への保存を検知する。localStorage 自体はプロパティ代入が
  // 「キーの書き込み」になってしまうため、必ずプロトタイプ側を包む。
  (function hookStorage() {
    var proto = window.Storage && window.Storage.prototype;
    if (!proto || typeof proto.setItem !== "function") return;
    var orig = proto.setItem;
    proto.setItem = function (key, value) {
      var out = orig.apply(this, arguments);
      if (key === STORAGE_KEY) {
        scheduleBackup();
        scheduleSync();
      }
      return out;
    };
  })();

  /* ------------------------------------------------------------------
   * 5. 見た目と手ざわり
   * ---------------------------------------------------------------- */

  function setupChrome() {
    if (StatusBar) {
      // 背景が淡いので、時刻などの文字は黒（Capacitor の "LIGHT" が黒文字）
      StatusBar.setStyle({ style: "LIGHT" }).catch(function () {});
    }
    if (SplashScreen) {
      SplashScreen.hide().catch(function () {});
    }
  }

  function setupHaptics() {
    if (!Haptics) return;
    var SELECTOR = ".btn-main, .chip, .opt, nav button, button.disp";
    document.addEventListener(
      "click",
      function (ev) {
        var el = ev.target && ev.target.closest ? ev.target.closest(SELECTOR) : null;
        if (!el || el.disabled) return;
        Haptics.impact({ style: "LIGHT" }).catch(function () {});
      },
      true
    );
  }

  /* ------------------------------------------------------------------
   * 起動と復帰
   * ---------------------------------------------------------------- */

  function boot() {
    setupChrome();
    setupHaptics();
    restoreIfEmpty()
      .then(function () {
        return writeBackup();
      })
      .then(function () {
        return syncReminders();
      })
      .catch(function (e) {
        log("boot error", e);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  if (App && App.addListener) {
    App.addListener("appStateChange", function (state) {
      if (state && state.isActive) {
        // 復帰時: 日付が変わっているかもしれないので通知とバッジを取り直す
        scheduleSync();
      } else {
        writeBackup();
      }
    });
  }

  // 通知をタップして戻ってきたときも、状態を合わせ直す
  if (LocalNotifications && LocalNotifications.addListener) {
    LocalNotifications.addListener("localNotificationActionPerformed", function () {
      scheduleSync();
    });
  }

  // 日付をまたいだときの取りこぼし対策（index.html 側も1分ごとに自己点検している）
  setInterval(function () {
    updateBadgeFromState(null);
  }, 60000);
})();
