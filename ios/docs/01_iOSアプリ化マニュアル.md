# となりの栄養士 — iOS アプリ化マニュアル（初学者向け・全手順）

このマニュアルは、**プログラミングの経験がない方でも最後まで進められる**ように書いています。
上から順に、書いてあるとおりに実行してください。

- 所要時間の目安: **手を動かす時間 約4〜6時間** ＋ Apple の審査待ち **1〜3日**
- ゴール: いま GitHub Pages で公開している PWA が、App Store で配布できる iPhone アプリになる

---

## 目次

| STEP | やること | 目安時間 |
|---|---|---|
| [STEP 0](#step-0-全体像を理解する) | 全体像を理解する | 10分 |
| [STEP 1](#step-1-必要なものをそろえる) | 必要なものをそろえる | 30分〜 |
| [STEP 2](#step-2-開発ツールを入れる) | 開発ツールを入れる | 60分 |
| [STEP 3](#step-3-このフォルダを取り込んで下ごしらえをする) | プロジェクトの下ごしらえ | 10分 |
| [STEP 4](#step-4-ios-プロジェクトを作る) | iOS プロジェクトを作る | 10分 |
| [STEP 5](#step-5-シミュレータで動かしてみる) | シミュレータで動かす | 15分 |
| [STEP 6](#step-6-アイコンと起動画面を入れ替える) | アイコン・起動画面 | 15分 |
| [STEP 7](#step-7-アプリの設定を整える) | アプリの設定を整える | 30分 |
| [STEP 8](#step-8-実機で動作確認する) | 実機で確認する | 30分 |
| [STEP 9](#step-9-apple-developer-program-に登録する) | Apple に登録する | 30分＋審査 |
| [STEP 10](#step-10-app-store-connect-にアプリ枠を作る) | App Store Connect の準備 | 60分 |
| [STEP 11](#step-11-アーカイブしてアップロードする) | アップロード | 30分 |
| [STEP 12](#step-12-審査に出す) | 審査に出す | 20分＋1〜3日 |
| [STEP 13](#step-13-公開後の更新のしかた) | 公開後の更新 | — |

---

## STEP 0. 全体像を理解する

### いま起きていること

いまのアプリは **PWA（Progressive Web App）** という形式です。
`index.html` という1つのファイルの中に、画面もデータ処理も全部入っていて、
Safari で開いて「ホーム画面に追加」するとアプリのように使えます。

これを App Store で配れるようにするには、**この HTML を iPhone アプリの「箱」に入れる**
必要があります。その箱を作る道具が **Capacitor（キャパシター）** です。

```
┌─────────────────────────────────────┐
│  iPhone アプリ（App Store で配れる箱）  │
│  ┌───────────────────────────────┐  │
│  │  いまの index.html（そのまま）   │  │  ← 中身は1文字も変えない
│  └───────────────────────────────┘  │
│  ＋ 通知・共有・バックアップの部品      │  ← tonari-native.js が橋渡し
└─────────────────────────────────────┘
```

### なぜ「そのまま入れるだけ」ではダメなのか

WKWebView（iPhone アプリの中の Safari）には、いくつか制限があります。
このプロジェクトでは、その4つを **`index.html` を書き換えずに** 解決してあります。

| Web 版でできないこと | iOS アプリでの解決 |
|---|---|
| アプリを閉じている間に通知が出せない | 端末内で予約する通知に差し替え（**閉じていても届く**） |
| アイコンにバッジが付かない | iOS のバッジ API に差し替え |
| CSV を保存できない（`<a download>` が効かない） | iOS の共有シート（メール送信・「ファイル」に保存）に差し替え |
| ブラウザのデータ削除で記録が消える | アプリ内に自動バックアップ、消えていたら起動時に書き戻す |

これらは `ios/src/tonari-native.js` という1つのファイルにまとまっています。

> **重要**: `index.html` は書き換えません。ビルド時に
> `<script src="tonari-native.js"></script>` という **1行だけ** が自動で足されます。
> GitHub 側の `index.html` を更新したら、コマンド1つで iOS アプリの中身も最新になります。

### 審査で最も気をつけるポイント（先に知っておいてください）

App Store の審査基準 **4.2「Minimum Functionality」** には、
「Web サイトをそのまま包んだだけのアプリは認めない」という項目があります。
このプロジェクトは、その対策として次を最初から備えています。

- 端末内スケジュールの**ローカル通知**（Web ではできない機能）
- **完全オフライン動作**（全データを端末に同梱、通信ゼロ）
- **共有シート**によるデータ書き出し、**「ファイル」アプリ**連携
- **触覚フィードバック**、**アイコンバッジ**

それでも指摘される可能性はゼロではありません。返答の文例は
[`ios/appstore/04_審査への注記.md`](../appstore/04_審査への注記.md) に用意してあります。

---

## STEP 1. 必要なものをそろえる

### 1-1. どうしても必要なもの

| もの | 必須か | 備考 |
|---|---|---|
| **Mac**（macOS 14 Sonoma 以降） | **必須** | Windows では iPhone アプリを作れません。詳細は [費用の見積り](02_費用の見積り.md) |
| **Apple ID** | **必須** | ふだん使っているもので構いません |
| **Apple Developer Program** | **必須**（配布時） | 年 US$99。STEP 9 で登録します |
| インターネット回線 | 必須 | 初回のダウンロードが 10GB 以上あります |
| 空きディスク容量 | 必須 | **40GB 以上**（Xcode が重いため） |

### 1-2. あった方がよいもの

| もの | 理由 |
|---|---|
| **iPhone 実機** | シミュレータでは通知・バッジ・共有シートが正しく確認できません |
| Lightning / USB-C ケーブル | 実機に転送するため |

> **Mac を持っていない場合**
> 「Mac レンタル」「クラウド Mac（MacStadium・MacinCloud など）」を月単位で借りられます。
> 費用感は [費用の見積り](02_費用の見積り.md) にまとめました。
> なお **Apple Developer Program の登録と App Store Connect の入力は Windows でもできます**。
> Mac が要るのは「ビルドしてアップロードするとき」だけです。

---

## STEP 2. 開発ツールを入れる

Mac の **ターミナル**（Launchpad →「その他」→「ターミナル」）を開いて進めます。

### 2-1. Xcode を入れる（一番時間がかかります）

1. Mac の **App Store** アプリを開く
2. 「**Xcode**」で検索して**入手**（無料・約 10GB）
3. ダウンロードが終わったら Xcode を一度起動し、追加コンポーネントのインストールを許可
4. ターミナルで次を実行し、Xcode の場所を登録する

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

`sudo` を打つと Mac のパスワードを聞かれます（画面には何も表示されませんが入力できています）。

**確認**:

```bash
xcodebuild -version
```

`Xcode 16.x`（またはそれ以上）と出れば OK です。

### 2-2. Homebrew を入れる（他のツールを入れる道具）

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

インストール後、画面の最後に「Next steps」として2〜3行のコマンドが表示されます。
**その行をそのままコピーして実行**してください（PATH の設定です）。

**確認**:

```bash
brew --version
```

### 2-3. Node.js を入れる

```bash
brew install node
```

**確認**（v20 以上であること）:

```bash
node -v
npm -v
```

### 2-4. CocoaPods を入れる（iOS の部品管理ツール）

```bash
brew install cocoapods
```

**確認**:

```bash
pod --version
```

### 2-5. Git を確認する

```bash
git --version
```

入っていなければ `xcode-select --install` を実行してください。

---

## STEP 3. このフォルダを取り込んで下ごしらえをする

### 3-1. リポジトリを手元に持ってくる

```bash
cd ~/Desktop
git clone https://github.com/ty-mike18/tonarino_wata.git
cd tonarino_wata
```

すでに ZIP でダウンロードしている場合は、展開したフォルダに `cd` で移動するだけで構いません。

### 3-2. iOS 用のフォルダに移動して、部品を入れる

```bash
cd ios
npm install
```

`node_modules` というフォルダができ、Capacitor と各プラグインが入ります（2〜3分）。

### 3-3. 動作テストを流しておく（任意ですが推奨）

```bash
npm test
```

`8 / 8 件合格` と出れば、通知の予約ルールとバックアップの仕組みが正しく動いています。

### 3-4. アプリの中身（www）を組み立てる

```bash
npm run build
```

こう表示されれば成功です。

```
www/ を作成しました: 23 ファイル
  - index.html に <script src="tonari-native.js"></script> を1行追加
  - 画像 20 点、tonari-native.js を同梱
```

> このコマンドは、リポジトリ直下の `index.html` と画像を `ios/www/` にコピーし、
> `</head>` の直前に橋渡し用の script を1行だけ足します。
> **`index.html` の中身そのものは変更されません。**

### 3-5. アプリ ID を決める

`ios/capacitor.config.json` をテキストエディタで開き、`appId` を確認します。

```json
{
  "appId": "jp.toyo.tonarino",
  "appName": "となりの栄養士",
```

`appId`（Bundle ID）は **世界で1つだけの識別子**で、あとから変更できません。
自分のドメインを逆さまにした形にします。

| 持っているドメイン | おすすめの appId |
|---|---|
| `toyo.jp` | `jp.toyo.tonarino` ← 初期値 |
| ドメインが無い場合 | `com.（GitHubのユーザー名）.tonarino` 例: `com.tymike18.tonarino` |

決めたら保存します。**この時点で決め切ってください。**

---

## STEP 4. iOS プロジェクトを作る

```bash
npx cap add ios
```

`ios/App/` というフォルダができ、その中に Xcode のプロジェクトが生成されます。
CocoaPods が部品をダウンロードするので 1〜3分かかります。

続いて、`www` の中身と設定をプロジェクトに反映します。

```bash
npx cap sync ios
```

> **エラーが出たら**
> `pod install` 関連のエラーが出た場合は、次を順に試してください。
> ```bash
> cd App && pod repo update && pod install && cd ..
> ```

---

## STEP 5. シミュレータで動かしてみる

```bash
npx cap open ios
```

Xcode が開きます。初回は画面上部に「Indexing...」と出るので、止まるまで1〜2分待ちます。

1. Xcode の画面上部中央にある機種名（例: `App > iPhone 16 Pro`）をクリック
2. 一覧から **iPhone 16**（または任意の iPhone シミュレータ）を選ぶ
3. 左上の **▶（再生）ボタン**を押す

シミュレータが立ち上がり、「となりの栄養士」の同意画面が表示されれば成功です。

### この時点で確認すること

- [ ] 同意画面 → 初回アセスメント → 記録タブ、と進める
- [ ] 5つのタブ（ホーム・記録・経過・レシピ・案内）が切り替わる
- [ ] 猫のマスコットのしっぽが動いている
- [ ] 画像（食品グループのイラスト）が表示されている

> **画面が真っ白なとき**
> `npm run build && npx cap sync ios` をもう一度実行してから、Xcode で再実行してください。

> **通知やバッジはシミュレータでは正しく確認できません。** STEP 8 の実機確認で見ます。

---

## STEP 6. アイコンと起動画面を入れ替える

`ios/resources/ios/` に、そのまま使える画像を用意してあります。

| ファイル | 用途 | サイズ |
|---|---|---|
| `AppIcon-512@2x.png` | アプリアイコン | 1024×1024（透過なし・角丸なし） |
| `splash-2732x2732.png`（他2枚も同じ絵） | 起動画面 | 2732×2732 |

### 6-1. Finder でコピーする（一番確実）

ターミナルで次を実行すれば、正しい場所に一括コピーされます。

```bash
cd ~/Desktop/tonarino_wata/ios

cp resources/ios/AppIcon-512@2x.png \
   App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png

cp resources/ios/splash-2732x2732.png \
   resources/ios/splash-2732x2732-1.png \
   resources/ios/splash-2732x2732-2.png \
   App/App/Assets.xcassets/Splash.imageset/
```

### 6-2. 確認する

Xcode の左の一覧から `App > Assets.xcassets` を開き、
`AppIcon` に緑色の「栄」アイコン、`Splash` に猫のマスコットが表示されていれば OK です。

シミュレータでアプリを一度削除（アイコン長押し → App を削除）してから
再度 ▶ を押すと、新しいアイコンで入り直します。

> **画像を自分で作り直したいとき**
> ```bash
> pip3 install pillow
> python3 scripts/make-assets.py
> ```
> リポジトリ直下の `icon-512.png` と `wata-body.png` / `wata-tail.png` から
> 再生成されます。

---

## STEP 7. アプリの設定を整える

ここが App Store 提出前の要となる作業です。

### 7-1. Info.plist を差し替える

用意済みのファイルで上書きします。

```bash
cd ~/Desktop/tonarino_wata/ios
cp xcode/Info.plist App/App/Info.plist
```

この差し替えで次が設定されます（詳しくはファイル冒頭のコメントに書いてあります）。

- ホーム画面の表示名を「となりの栄養士」に
- 既定の言語を日本語に
- 縦向き固定
- 書き出した CSV を iPhone の「ファイル」アプリから取り出せるように
- **輸出コンプライアンスの申告**（`ITSAppUsesNonExemptEncryption = false`）
  → これを書いておくと、提出のたびに聞かれる暗号化の質問が出なくなります

### 7-2. プライバシーマニフェストを追加する

2024年春以降、App Store のアプリには **プライバシーマニフェスト** の同梱が必要です。

```bash
cp xcode/PrivacyInfo.xcprivacy App/App/PrivacyInfo.xcprivacy
```

コピーしただけでは Xcode のプロジェクトに登録されないので、**Xcode 側でも追加**します。

1. Xcode の左一覧で **App**（黄色いフォルダ）を右クリック
2. **Add Files to "App"...**
3. `App/App/PrivacyInfo.xcprivacy` を選ぶ
4. **Copy items if needed の チェックを外す**（もうコピー済みのため）
5. **Add to targets** の **App** に **チェックが入っていること**を確認して **Add**

### 7-3. 署名（Signing）を設定する

1. Xcode 左一覧の一番上、青いアイコンの **App** をクリック
2. 中央の **TARGETS** から **App** を選ぶ
3. 上のタブから **Signing & Capabilities** を開く

以下を設定します。

| 項目 | 設定 |
|---|---|
| **Automatically manage signing** | **チェックを入れる** |
| **Team** | 自分の Apple ID（STEP 9 の登録後は「(組織名)」が出ます） |
| **Bundle Identifier** | STEP 3-5 で決めた `appId` と**完全に一致**していること |

Team のプルダウンに何も出ないときは、
Xcode メニュー → **Settings** → **Accounts** → 左下の **＋** から Apple ID を追加してください。

### 7-4. 通知の許可（Capability）を追加する

同じ **Signing & Capabilities** タブの左上 **＋ Capability** をクリックし、
**Push Notifications** ではなく、次を確認してください。

- ローカル通知（端末内で予約する通知）に **Capability の追加は不要**です。
  `@capacitor/local-notifications` が自動で処理します。
- **Push Notifications は追加しないでください。** サーバーからの配信は使わないため、
  追加すると「使っていない権限がある」として審査で聞かれることがあります。

### 7-5. バージョン番号を設定する

**General** タブで次を設定します。

| 項目 | 値 | 意味 |
|---|---|---|
| **Version**（Marketing Version） | `3.31.0` | 利用者に見えるバージョン |
| **Build**（Current Project Version） | `1` | アップロードのたびに +1 する内部番号 |
| **Minimum Deployments** | `iOS 15.0` | 対応する一番古い iOS |

> **Build 番号のルール**: 同じ Version で再アップロードするときは、
> Build を `1` → `2` → `3` と必ず上げてください。同じ番号は拒否されます。

### 7-6. iPad 対応を外す（推奨）

**General** タブ → **Supported Destinations**。
`iPad` の行を選んで **−（マイナス）** で削除します。

iPad を残すと、App Store 提出時に **iPad 用のスクリーンショットも必須**になり、
レイアウト崩れの審査リスクも増えます。iPhone だけに絞るのが最短です。
（このアプリは横幅 560px 上限のデザインなので、iPad では余白が目立ちます。）

### 7-7. ここで一度ビルドし直す

```bash
npx cap sync ios
```

Xcode に戻って ▶ を押し、シミュレータで動くことを確認します。

---

## STEP 8. 実機で動作確認する

**通知・バッジ・共有シートは、実機でしか正しく確認できません。** 必ず実施してください。

### 8-1. iPhone を Mac につなぐ

1. ケーブルで接続し、iPhone 側で「このコンピュータを信頼しますか？」→ **信頼**
2. iPhone の **設定 → プライバシーとセキュリティ → デベロッパモード** を **オン**（再起動します）
3. Xcode 上部の機種選択で、自分の iPhone を選ぶ
4. ▶ を押す

初回は iPhone 側で
**設定 → 一般 → VPN とデバイス管理 → デベロッパApp** から自分を「信頼」する必要があります。

### 8-2. 実機チェックリスト

順番に確認してください。

- [ ] **起動**: 猫の起動画面のあと、同意画面が出る
- [ ] **記録**: 初回アセスメントを終え、記録タブで皿数を入力 → ホームにスコアが出る
- [ ] **リマインダー（要）**:
      1. 記録タブのリマインダーを **オン** にする
      2. 通知の許可ダイアログが出る → **許可**
      3. 時刻を **数分後** に設定する
      4. **アプリを完全に終了する**（アプリスイッチャーで上にスワイプ）
      5. 設定時刻に **通知が届く** ← ここが Web 版との決定的な違い
- [ ] **バッジ**: 未記録のまま設定時刻を過ぎると、ホーム画面のアイコンに **1** が付く
- [ ] **記録するとバッジが消える**: 記録タブで入力すると、アイコンのバッジが消える
- [ ] **CSV 書き出し**: 経過タブ →「CSVを書き出す」→ **共有シートが開く**
      →「"ファイル"に保存」でファイルアプリに保存できる
- [ ] **CSV 復元**: 経過タブ →「CSVから復元する」→ 保存したファイルを選んで戻せる
- [ ] **オフライン**: 機内モードにしても全機能が動く
- [ ] **バックアップ**: アプリを削除せずに再起動しても記録が残っている
- [ ] **触覚**: ボタンを押すと軽く「コッ」と震える

### 8-3. うまく動かないときの調べ方

Mac の Safari から iPhone の中を覗けます。

1. Mac の Safari → **設定** → **詳細** → 「**Web デベロッパ用の機能を表示**」にチェック
2. iPhone の **設定 → Safari → 詳細 → Web インスペクタ** を **オン**
3. アプリを iPhone で開いた状態で、Mac の Safari → **開発** メニュー → 自分の iPhone → **App**

開いたコンソールで次を打つと、橋渡しの動きがログに出ます。

```js
window.__tonariDebug = true;
Object.keys(Capacitor.Plugins);   // LocalNotifications, Badge, Filesystem ... が並ぶ
```

よくある症状と対処は [`05_トラブルシューティング.md`](05_トラブルシューティング.md) にまとめました。

---

## STEP 9. Apple Developer Program に登録する

**費用: 年 US$99（日本円で約 15,000 円前後・為替により変動）**

1. iPhone に **Apple Developer** アプリを入れる（App Store で「Apple Developer」を検索）
   → **iPhone から申し込むのが最も速い**です（本人確認が Face ID で済みます）
2. アプリを開き、**Account** タブ → **Enroll**
3. 登録種別を選ぶ

| 種別 | 費用 | 販売者名の表示 | 必要なもの |
|---|---|---|---|
| **Individual（個人）** | 年 US$99 | **本名**が表示される | Apple ID のみ |
| **Organization（法人）** | 年 US$99 | **法人名**が表示される | **D-U-N-S番号**（無料・取得に1〜2週間） |

> **どちらを選ぶか**
> 医療・健康分野のアプリは、提供者が誰かはっきりしている方が利用者の信頼を得やすく、
> 審査もスムーズです。法人（東洋工業株式会社等）で出せるなら **Organization** を推奨します。
> ただし D-U-N-S 番号の取得に時間がかかるため、
> **急ぐ場合は Individual で出し、あとから法人へ移管**することもできます。

4. 支払いを済ませる
5. **承認まで 24〜48時間**（法人は D-U-N-S の確認で1〜2週間かかることがあります）

承認メールが届いたら、Xcode の **Settings → Accounts** で
Apple ID を再度サインインし直し、Team が選べるようになったことを確認してください。

---

## STEP 10. App Store Connect にアプリ枠を作る

[https://appstoreconnect.apple.com](https://appstoreconnect.apple.com) にサインインします。

### 10-1. 有料アプリにする場合の契約（有料で売るときだけ）

**ビジネス** → **契約** →「有料アプリケーション」契約を締結します。
あわせて次を登録します。**これを済ませないと有料アプリを公開できません。**

- **銀行口座**（売上の受取先）
- **税務情報**（日本の居住者情報・マイナンバー等）
- **連絡先**（財務担当・技術担当・法務担当）

> 無料アプリのみなら、この手続きは不要です。

### 10-2. アプリを新規作成する

**マイ App** → 左上の **＋** → **新規 App**

| 項目 | 入力内容 |
|---|---|
| プラットフォーム | **iOS** |
| 名前 | **となりの栄養士** |
| プライマリ言語 | **日本語** |
| バンドル ID | STEP 3-5 で決めた `appId` を選ぶ |
| SKU | `tonarino-eiyoshi-001`（社内管理用の好きな文字列） |
| ユーザアクセス | フルアクセス |

> **「名前」はすでに使われていると登録できません。**
> その場合は「となりの栄養士 - 食事バランス記録」のように少し足してください。

### 10-3. アプリ情報を入力する

[`ios/appstore/01_アプリ情報.md`](../appstore/01_アプリ情報.md) に、
**そのままコピーして貼れる文章**を用意してあります。次の欄を埋めてください。

- サブタイトル / プロモーション用テキスト / 概要 / キーワード
- サポート URL / プライバシーポリシー URL
- カテゴリ（**ヘルスケア/フィットネス**）
- 年齢制限（アンケートに答える）

### 10-4. プライバシーポリシーとサポートページを公開する

[`ios/appstore/`](../appstore/) にある2つの HTML を、いま使っている GitHub Pages に置くだけです。

```bash
cd ~/Desktop/tonarino_wata
mkdir -p docs-site
cp ios/appstore/privacy.html  privacy.html
cp ios/appstore/support.html  support.html
git add privacy.html support.html
git commit -m "App Store 用のプライバシーポリシーとサポートページを追加"
git push
```

公開後、次の URL でアクセスできることを確認してください。

- プライバシーポリシー: `https://ty-mike18.github.io/tonarino_wata/privacy.html`
- サポート: `https://ty-mike18.github.io/tonarino_wata/support.html`

**この2つの URL は App Store Connect の必須入力項目です。**

### 10-5. App のプライバシー（Nutrition Label）に答える

**App のプライバシー** → **開始** で、データ収集についてのアンケートに答えます。

このアプリの答えは **1問だけ**です。

> 「このAppはユーザーからデータを収集しますか？」
> → **いいえ**

理由: 記録はすべて端末内（localStorage とアプリ内ファイル）に保存され、
外部サーバーへの送信・解析ツール・広告 SDK を一切使っていないためです。
`index.html` には外部 URL が1つも含まれていません（フォントも端末内蔵のもののみ）。

### 10-6. スクリーンショットを用意する

必要なのは **6.9インチ（iPhone 16 Pro Max 等）1種類だけ**で、他のサイズには自動適用されます。

| サイズ | 枚数 |
|---|---|
| **1320 × 2868 px**（6.9インチ・縦） | **3〜10枚**（最低3枚） |

撮り方と、どの画面を撮るべきかは
[`ios/appstore/03_スクリーンショット撮影ガイド.md`](../appstore/03_スクリーンショット撮影ガイド.md) を見てください。

---

## STEP 11. アーカイブしてアップロードする

### 11-1. 提出用のビルドを作る

1. Xcode の上部、機種選択のところを **Any iOS Device (arm64)** に変更する
   （シミュレータのままだとアーカイブできません）
2. メニュー **Product** → **Archive**
3. 3〜10分待つ。終わると **Organizer** ウインドウが自動で開く

> **Archive がグレーで押せないとき**: 機種選択が「Any iOS Device」になっているか確認してください。

### 11-2. アップロードする

Organizer で、いま作られたアーカイブを選び:

1. 右の **Distribute App** をクリック
2. **App Store Connect** → **Next**
3. **Upload** → **Next**
4. 署名は **Automatically manage signing** のまま → **Next**
5. 内容を確認して **Upload**

アップロード完了後、App Store Connect 側で処理されるまで **10〜30分**かかります。
処理が終わると Apple からメールが届きます。

> **「輸出コンプライアンス」を聞かれたら**
> STEP 7-1 で `ITSAppUsesNonExemptEncryption = false` を設定していれば聞かれません。
> もし聞かれたら「いいえ（暗号化を使用していない）」を選んでください。

---

## STEP 12. 審査に出す

App Store Connect の該当バージョンのページで:

1. **ビルド** の欄で **＋** を押し、アップロードしたビルドを選ぶ
2. **App Review に関する情報** に、
   [`ios/appstore/04_審査への注記.md`](../appstore/04_審査への注記.md) の
   「審査メモ」の文章をコピーして貼る
3. **サインイン情報が必要** → **いいえ**（ログイン機能が無いため）
4. **バージョンのリリース** → 「手動でリリース」を推奨
   （承認後、自分の好きなタイミングで公開できます）
5. 右上の **審査へ提出**

### 審査の流れ

| 状態 | 意味 | 目安 |
|---|---|---|
| 審査待ち | 順番待ち | 数時間〜1日 |
| 審査中 | 担当者が確認中 | 数時間〜1日 |
| **承認済み** | 通った | — |
| **却下（Rejected）** | 修正が必要 | 返答して再提出 |

**却下は珍しいことではありません。** 落ち着いて、
[`ios/appstore/04_審査への注記.md`](../appstore/04_審査への注記.md) の
「却下されたときの返答文例」を使ってください。
このアプリで指摘されうるのは主に次の3点です。

1. **4.2 Minimum Functionality** — Web の包み直しではないか
2. **1.4.1 / 5.1.1 健康関連** — 医療行為との線引き、免責の明示
3. **2.1 完全性** — 通知の許可を求める理由が分かりにくい

---

## STEP 13. 公開後の更新のしかた

`index.html` を更新したときの手順は **4行だけ**です。

```bash
cd ~/Desktop/tonarino_wata
git pull                       # GitHub 側の最新を取り込む

cd ios
npm run build && npx cap sync ios    # www を作り直して反映
```

そのあと:

1. Xcode の **General** タブで **Build** 番号を +1（`1` → `2`）
   - 機能追加なら **Version** も上げる（`3.31.0` → `3.32.0`）
2. **Product → Archive** → **Distribute App** → アップロード
3. App Store Connect で「**＋ バージョンまたはプラットフォーム**」から新バージョンを作り、
   「このバージョンの新機能」を書いて審査へ提出

> **重要**: iOS アプリの中身は端末に同梱されているため、
> GitHub 側の `index.html` を更新しても **App Store のアプリは自動では変わりません**。
> 必ず上記の再アップロードが必要です（Web 版はこれまでどおり即時反映されます）。

---

## 付録: よく使うコマンド一覧

```bash
cd ~/Desktop/tonarino_wata/ios

npm install                     # 部品を入れる（初回のみ）
npm test                        # 橋渡し部分の動作テスト
npm run build                   # index.html と画像を www/ にまとめる
npx cap sync ios                # www と設定を Xcode プロジェクトへ反映
npx cap open ios                # Xcode を開く

npm run ios:sync                # build + sync をまとめて実行
python3 scripts/make-assets.py  # アイコンと起動画面を作り直す
```

---

## 次に読むもの

- [02_費用の見積り.md](02_費用の見積り.md) — いくらかかるか、いくら残るか
- [03_申請チェックリスト.md](03_申請チェックリスト.md) — 提出前の確認表
- [05_トラブルシューティング.md](05_トラブルシューティング.md) — つまずいたとき
- [`ios/appstore/`](../appstore/) — App Store に貼り付ける文章一式
