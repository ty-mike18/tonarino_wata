/**
 * www/ を組み立てるスクリプト。
 *
 *   実行:  npm run build      (= node scripts/build-www.mjs)
 *
 * やっていること
 *   1. リポジトリ直下（GitHub Pages で公開しているのと同じファイル）を www/ にコピー
 *   2. index.html の </head> の直前に <script src="tonari-native.js"></script> を1行だけ挿入
 *   3. www/tonari-native.js（iOS 側の橋渡し）を src/ からコピー
 *
 * 方針
 *   index.html の中身そのものは、この1行の追加を除いて一切書き換えません。
 *   GitHub 上の index.html を更新したら、このスクリプトを再実行するだけで
 *   iOS アプリの中身も最新になります（アプリのロジックを二重管理しない）。
 *
 *   sw.js（Service Worker）はコピーしません。iOS アプリでは画面が
 *   capacitor:// スキームで開かれ、index.html 側の登録処理が
 *   「http/https のときだけ登録する」と条件分岐しているため使われないからです。
 *   アプリの中身はすべて端末内に同梱されるので、オフライン動作にも影響しません。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IOS_DIR = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(IOS_DIR, "..");
const WWW = path.join(IOS_DIR, "www");
const SRC = path.join(IOS_DIR, "src");

const BRIDGE_FILE = "tonari-native.js";
const BRIDGE_TAG = `<script src="${BRIDGE_FILE}"></script>`;

/** www/ にコピーする、リポジトリ直下のファイル。 */
const COPY_FILES = ["index.html", "manifest.json"];
/** 画像は拡張子でまとめて拾う（新しい素材を足しても取りこぼさないため）。 */
const COPY_EXT = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".woff2"];

async function listRootAssets() {
  const entries = await fs.readdir(REPO_ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && COPY_EXT.includes(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);
}

async function reset() {
  await fs.rm(WWW, { recursive: true, force: true });
  await fs.mkdir(WWW, { recursive: true });
}

/** index.html に橋渡し script を1行だけ挿し込む。 */
function injectBridge(html) {
  if (html.includes(BRIDGE_TAG)) return html; // 二重挿入はしない
  const idx = html.indexOf("</head>");
  if (idx < 0) throw new Error("index.html に </head> が見つかりません。処理を中止します。");
  return html.slice(0, idx) + BRIDGE_TAG + "\n" + html.slice(idx);
}

async function main() {
  await reset();

  const assets = await listRootAssets();
  const targets = [...COPY_FILES, ...assets];

  for (const name of targets) {
    const from = path.join(REPO_ROOT, name);
    const to = path.join(WWW, name);
    if (name === "index.html") {
      const html = await fs.readFile(from, "utf8");
      await fs.writeFile(to, injectBridge(html), "utf8");
    } else {
      await fs.copyFile(from, to);
    }
  }

  await fs.copyFile(path.join(SRC, BRIDGE_FILE), path.join(WWW, BRIDGE_FILE));

  console.log(`www/ を作成しました: ${targets.length + 1} ファイル`);
  console.log(`  - index.html に ${BRIDGE_TAG} を1行追加`);
  console.log(`  - 画像 ${assets.length} 点、${BRIDGE_FILE} を同梱`);
  console.log("次は `npx cap sync ios` を実行してください。");
}

main().catch((err) => {
  console.error("build-www に失敗しました:", err.message);
  process.exit(1);
});
