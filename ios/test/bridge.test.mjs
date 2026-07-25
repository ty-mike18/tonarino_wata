/**
 * tonari-native.js の動作確認テスト。
 *
 *   実行:  node test/bridge.test.mjs
 *
 * Mac も Xcode も無い環境で、通知の予約ルールとバックアップ／復元の
 * 動きだけを検証します（Capacitor のプラグインは偽物に差し替えます）。
 *
 * 確認していること
 *   1. リマインダーが OFF なら通知を1件も予約しない
 *   2. ON かつ今日が未記録なら、今日を含めて14日ぶん予約する
 *   3. ON でも今日が記録済みなら、今日ぶんだけ飛ばす
 *   4. 記録を保存すると自動バックアップが書かれる
 *   5. localStorage が空でバックアップがあるとき、書き戻して再読み込みする
 *   6. ブラウザ（Capacitor 無し）では何もしない
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src", "tonari-native.js");
const CODE = readFileSync(SRC, "utf8");

const RealDate = Date;
const FIXED = new RealDate(2026, 6, 25, 8, 0, 0); // 2026-07-25(土) 08:00 端末ローカル
const TODAY = "2026-07-25";
const STORAGE_KEY = "tonari-data";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* 偽の実行環境                                                        */
/* ------------------------------------------------------------------ */

class FakeStorage {
  constructor() {
    this._m = new Map();
  }
  getItem(k) {
    return this._m.has(k) ? this._m.get(k) : null;
  }
  setItem(k, v) {
    this._m.set(k, String(v));
  }
  removeItem(k) {
    this._m.delete(k);
  }
  clear() {
    this._m.clear();
  }
}

class MockDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED.getTime());
    else super(...args);
  }
  static now() {
    return FIXED.getTime();
  }
}

function makeEnv({ stored = null, backup = null, native = true } = {}) {
  const calls = {
    scheduled: [],
    cancelled: [],
    badge: [],
    written: [],
    shared: [],
    reloaded: 0,
    permissionRequests: 0
  };

  const files = new Map();
  if (backup !== null) files.set("LIBRARY/tonari-backup.json", backup);

  const localStorage = new FakeStorage();
  if (stored !== null) localStorage.setItem(STORAGE_KEY, stored);
  const sessionStorage = new FakeStorage();

  let pending = [];

  const Plugins = {
    LocalNotifications: {
      async checkPermissions() {
        return { display: "granted" };
      },
      async requestPermissions() {
        calls.permissionRequests++;
        return { display: "granted" };
      },
      async getPending() {
        return { notifications: pending.map((n) => ({ id: n.id })) };
      },
      async cancel({ notifications }) {
        calls.cancelled.push(...notifications.map((n) => n.id));
        const gone = new Set(notifications.map((n) => n.id));
        pending = pending.filter((n) => !gone.has(n.id));
      },
      async schedule({ notifications }) {
        calls.scheduled.push(...notifications);
        pending.push(...notifications);
      },
      addListener() {}
    },
    Badge: {
      async set({ count }) {
        calls.badge.push(count);
      },
      async clear() {
        calls.badge.push(0);
      }
    },
    Filesystem: {
      async writeFile({ path: p, data, directory }) {
        files.set(`${directory}/${p}`, data);
        calls.written.push(`${directory}/${p}`);
      },
      async readFile({ path: p, directory }) {
        const key = `${directory}/${p}`;
        if (!files.has(key)) throw new Error("File does not exist");
        return { data: files.get(key) };
      },
      async getUri({ path: p, directory }) {
        return { uri: `file:///fake/${directory}/${p}` };
      }
    },
    Share: {
      async share(opts) {
        calls.shared.push(opts);
      }
    },
    App: { addListener() {} },
    Haptics: { async impact() {} },
    StatusBar: { async setStyle() {} },
    SplashScreen: { async hide() {} }
  };

  const listeners = {};
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval,
    Promise,
    Date: MockDate,
    Object,
    Array,
    Number,
    String,
    JSON,
    Math,
    isFinite,
    Error,
    Storage: FakeStorage,
    HTMLAnchorElement: class {
      getAttribute() {
        return null;
      }
      click() {}
    },
    FileReader: class {
      readAsDataURL() {
        this.result = "data:text/csv;base64,QUJD";
        if (this.onload) this.onload();
      }
    },
    fetch: async () => ({ blob: async () => ({}) }),
    navigator: {},
    document: {
      readyState: "complete",
      addEventListener: (t, fn) => {
        (listeners[t] ||= []).push(fn);
      }
    }
  };
  sandbox.HTMLAnchorElement.prototype.click = function () {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage = localStorage;
  sandbox.sessionStorage = sessionStorage;
  sandbox.location = {
    reload() {
      calls.reloaded++;
    }
  };
  sandbox.alert = () => {};
  sandbox.Capacitor = native
    ? { isNativePlatform: () => true, Plugins }
    : { isNativePlatform: () => false, Plugins: {} };

  return { sandbox, calls, localStorage, files };
}

async function run(env) {
  vm.createContext(env.sandbox);
  vm.runInContext(CODE, env.sandbox, { filename: "tonari-native.js" });
  await delay(30); // boot() の非同期処理が落ち着くのを待つ
}

/* ------------------------------------------------------------------ */
/* テストデータ                                                        */
/* ------------------------------------------------------------------ */

function state({ reminderOn = true, time = "21:00", recordedToday = false } = {}) {
  const day = {
    sleep: { bed: null, wake: null, awak: 0 },
    meals: {
      breakfast: { skipped: false, time: 7 },
      lunch: { skipped: false, time: 12 },
      dinner: { skipped: false, time: 19 }
    },
    sv: recordedToday
      ? { 主食: 2, 副菜: 1, 主菜: 1, 乳製品: 0, 果物: 0 }
      : { 主食: 0, 副菜: 0, 主菜: 0, 乳製品: 0, 果物: 0 },
    dvs: {},
    snackKinds: {},
    snacks: 0,
    weight: ""
  };
  return JSON.stringify({
    consent: { version: "1.1", at: "2026-07-01" },
    profile: { name: "よしざき", age: 42, targets: {} },
    reminder: { on: reminderOn, time },
    days: { [TODAY]: day }
  });
}

/* ------------------------------------------------------------------ */
/* テスト本体                                                          */
/* ------------------------------------------------------------------ */

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("1. リマインダーOFFなら通知を予約しない", async () => {
  const env = makeEnv({ stored: state({ reminderOn: false }) });
  await run(env);
  assert.equal(env.calls.scheduled.length, 0);
  assert.deepEqual(env.calls.badge, [0], "バッジは消える");
});

test("2. ON・今日未記録なら今日を含め14日ぶん予約する", async () => {
  const env = makeEnv({ stored: state({ reminderOn: true, time: "21:00" }) });
  await run(env);
  const ids = env.calls.scheduled.map((n) => n.id);
  assert.equal(ids.length, 14, `14件のはずが ${ids.length} 件`);
  assert.deepEqual(ids, Array.from({ length: 14 }, (_, i) => 4200 + i));

  const first = env.calls.scheduled[0].schedule.at;
  assert.equal(first.getFullYear(), 2026);
  assert.equal(first.getMonth(), 6);
  assert.equal(first.getDate(), 25, "1件目は今日");
  assert.equal(first.getHours(), 21);
  assert.equal(first.getMinutes(), 0);

  const last = env.calls.scheduled[13].schedule.at;
  assert.equal(last.getDate(), 7, "14件目は8/7");
  assert.equal(last.getMonth(), 7);

  assert.match(env.calls.scheduled[0].body, /^よしざきさん、/, "名前で呼びかける");
  assert.deepEqual(env.calls.badge, [0], "21時前なのでバッジはまだ出さない");
});

test("3. ON・今日は記録済みなら今日だけ飛ばす", async () => {
  const env = makeEnv({ stored: state({ reminderOn: true, recordedToday: true }) });
  await run(env);
  const ids = env.calls.scheduled.map((n) => n.id);
  assert.equal(ids.length, 13, `13件のはずが ${ids.length} 件`);
  assert.equal(ids[0], 4201, "今日ぶん(4200)は予約されない");
  assert.equal(env.calls.scheduled[0].schedule.at.getDate(), 26, "1件目は明日");
});

test("4. 時刻を過ぎた当日ぶんは予約しない（8:00 時点で 07:30 設定）", async () => {
  const env = makeEnv({ stored: state({ reminderOn: true, time: "07:30" }) });
  await run(env);
  const ids = env.calls.scheduled.map((n) => n.id);
  assert.equal(ids.length, 13);
  assert.equal(ids[0], 4201);
  assert.deepEqual(env.calls.badge, [1], "時刻を過ぎて未記録なのでバッジが出る");
});

test("5. 記録を保存すると自動バックアップが書かれる", async () => {
  const env = makeEnv({ stored: state() });
  await run(env);
  env.calls.written.length = 0;

  const next = JSON.parse(state({ recordedToday: true }));
  env.sandbox.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  await delay(1800); // デバウンス(1.5秒)待ち

  assert.ok(
    env.calls.written.includes("LIBRARY/tonari-backup.json"),
    "Library にバックアップが書かれる"
  );
  const saved = JSON.parse(env.files.get("LIBRARY/tonari-backup.json"));
  assert.equal(saved.days[TODAY].sv["主食"], 2, "最新の内容が保存されている");
});

test("6. localStorage が空でバックアップがあれば書き戻して再読み込みする", async () => {
  const backup = state({ recordedToday: true });
  const env = makeEnv({ stored: null, backup });
  await run(env);
  assert.equal(env.calls.reloaded, 1, "1回だけ再読み込みする");
  assert.equal(env.sandbox.localStorage.getItem(STORAGE_KEY), backup);
  assert.equal(
    env.sandbox.sessionStorage.getItem("tonari-native-restored"),
    "1",
    "復元済みの印がつき、無限ループしない"
  );
});

test("7. 記録が残っていればバックアップで上書きしない", async () => {
  const live = state({ recordedToday: true });
  const env = makeEnv({ stored: live, backup: state({ reminderOn: false }) });
  await run(env);
  assert.equal(env.calls.reloaded, 0);
  assert.equal(env.sandbox.localStorage.getItem(STORAGE_KEY), live);
});

test("8. ブラウザ（Capacitor 無し）では何も起こさない", async () => {
  const env = makeEnv({ stored: state(), native: false });
  await run(env);
  assert.equal(env.calls.scheduled.length, 0);
  assert.equal(env.calls.written.length, 0);
  assert.equal(env.calls.badge.length, 0);
});

/* ------------------------------------------------------------------ */

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log("  OK  " + name);
  } catch (e) {
    failed++;
    console.error("  NG  " + name);
    console.error("      " + (e && e.message ? e.message : e));
  }
}
console.log(`\n${tests.length - failed} / ${tests.length} 件合格`);
process.exit(failed ? 1 : 0);
