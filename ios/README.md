# となりの栄養士 — iOS アプリ化キット

いま GitHub Pages で公開している PWA を、**App Store で配布できる iPhone アプリ**に
するための一式です。必要なファイル・設定・提出用の文章がすべて入っています。

---

## まず、これを読んでください

### → [docs/01_iOSアプリ化マニュアル.md](docs/01_iOSアプリ化マニュアル.md)

初学者向けに、STEP 0 から STEP 13 まで、**打つコマンドと押すボタンをすべて**書いた手順書です。
まずこれを上から順に進めてください。

### → [docs/02_費用の見積り.md](docs/02_費用の見積り.md)

かかるお金と、有料で売ったときに手元に残る金額の試算です。
**Mac を持っていれば、初期費用・年間費用ともに約15,000円**で公開できます。

---

## いちばん短い手順（Mac で）

```bash
cd ios
npm install                 # 部品を入れる
npm test                    # 動作テスト（8/8 合格すればOK）
npm run build               # index.html と画像を www/ にまとめる
npx cap add ios             # Xcode プロジェクトを作る（初回のみ）
npx cap open ios            # Xcode を開く → ▶ で実行
```

そのあと、マニュアルの STEP 6 以降（アイコン差し替え・設定・提出）へ進みます。

---

## この一式の考え方

**`index.html` は1文字も書き換えません。**

ビルド時に `</head>` の直前へ `<script src="tonari-native.js"></script>` という
**1行だけ**が自動で挿入されます。アプリのロジックは GitHub 上の `index.html` が唯一の正本のままで、
iOS 固有の処理はすべて `src/tonari-native.js` に閉じ込めてあります。

```
GitHub 直下の index.html ─┐
                          ├─→ ios/www/ ─→ Xcode プロジェクト ─→ App Store
ios/src/tonari-native.js ─┘
```

`index.html` を更新したら、次の2行で iOS アプリの中身も最新になります。

```bash
npm run build && npx cap sync ios
```

### Web でできないことを、どう置き換えているか

| Web 版の制限 | iOS アプリでの解決 | 担当ファイル |
|---|---|---|
| アプリを閉じている間は通知できない | 端末内で14日先まで予約する通知（**閉じていても届く**） | `src/tonari-native.js` |
| アイコンにバッジが付かない | iOS のバッジ API | 同上 |
| `<a download>` が効かず CSV を保存できない | iOS の共有シート／「ファイル」App 連携 | 同上 |
| ブラウザのデータ削除で記録が消える | アプリ内へ自動バックアップ、空なら起動時に書き戻し | 同上 |
| 触覚フィードバックがない | Haptics | 同上 |

`index.html` 側は `"setAppBadge" in navigator` や `"Notification" in window` を見てから
呼ぶ作りになっているため、**アプリ側のコードを変えずに** 差し替えができています。

---

## フォルダの中身

```
ios/
├── README.md                     ← いま読んでいるファイル
│
├── docs/                         【読むもの】
│   ├── 01_iOSアプリ化マニュアル.md   全手順（STEP 0〜13）
│   ├── 02_費用の見積り.md            費用と収支シミュレーション
│   ├── 03_申請チェックリスト.md      提出前の確認表
│   └── 05_トラブルシューティング.md  つまずいたときの対処集
│
├── appstore/                     【App Store に貼る／公開するもの】
│   ├── 01_アプリ情報.md              名前・概要・キーワード（コピー用）
│   ├── 03_スクリーンショット撮影ガイド.md
│   ├── 04_審査への注記.md            審査メモ／却下時の返答文例
│   ├── privacy.html                 プライバシーポリシー ★要編集
│   └── support.html                 サポートページ       ★要編集
│
├── src/
│   └── tonari-native.js          iOS ネイティブ機能への橋渡し（本体）
│
├── scripts/
│   ├── build-www.mjs             www/ を組み立てる
│   └── make-assets.py            アイコン・起動画面を生成する
│
├── xcode/                        【Xcode にコピーするもの】
│   ├── Info.plist                差し替え用（提出に必要な設定入り）
│   └── PrivacyInfo.xcprivacy     プライバシーマニフェスト（提出に必須）
│
├── resources/                    【生成済みの画像】
│   ├── AppIcon-1024.png          App Store 用アイコン
│   ├── Splash-2732.png           起動画面
│   └── ios/                      Xcode へそのままコピーできる名前で用意
│
├── native/                       【任意】自作ネイティブ拡張
│   ├── README.md
│   ├── TonariBadgePlugin.swift
│   └── TonariViewController.swift
│
├── test/
│   └── bridge.test.mjs           橋渡し部分の自動テスト（Mac 不要）
│
├── package.json
└── capacitor.config.json         appId をここで設定する
```

---

## ★ 提出前に必ず編集するもの

| ファイル | 直すところ |
|---|---|
| `capacitor.config.json` | `appId` を自分のものに（**あとから変更できません**） |
| `appstore/privacy.html` | `〇〇〇〇` → 提供者名、`your@example.com` → 連絡先 |
| `appstore/support.html` | 同上（連絡先は2か所あります） |

---

## 動作確認

Mac が無くても、橋渡し部分のロジックはテストできます。

```bash
npm install
npm test
```

```
  OK  1. リマインダーOFFなら通知を予約しない
  OK  2. ON・今日未記録なら今日を含め14日ぶん予約する
  OK  3. ON・今日は記録済みなら今日だけ飛ばす
  OK  4. 時刻を過ぎた当日ぶんは予約しない（8:00 時点で 07:30 設定）
  OK  5. 記録を保存すると自動バックアップが書かれる
  OK  6. localStorage が空でバックアップがあれば書き戻して再読み込みする
  OK  7. 記録が残っていればバックアップで上書きしない
  OK  8. ブラウザ（Capacitor 無し）では何も起こさない

8 / 8 件合格
```

---

## 前提バージョン

| ツール | バージョン | 備考 |
|---|---|---|
| macOS | 14 Sonoma 以降 | **Windows では作れません** |
| Xcode | 16 以降 | App Store から無料 |
| Node.js | 20 以降 | `brew install node` |
| CocoaPods | 1.15 以降 | `brew install cocoapods` |
| Capacitor | 8.x | `npm install` で自動 |
| 対応 iOS | 15.0 以降 | |

---

## Web 版への影響

**ありません。** `tonari-native.js` は冒頭で「Capacitor 上で動いているか」を確認し、
ブラウザではその場で処理を終えます。GitHub Pages の PWA はこれまでどおり動作します。
`ios/` フォルダを追加しても、Web 版のファイルは1つも変わっていません。
