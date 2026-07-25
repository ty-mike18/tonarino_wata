# ios/native — 自作ネイティブ拡張（任意）

このフォルダの中身は **使わなくてもアプリは完成します**。

アプリアイコンのバッジ（未記録の日にアイコンの右上へ出る印）は、通常
`@capawesome/capacitor-badge` という npm のプラグインで動きます。これは
`package.json` にすでに入っているので、`npm install` すれば自動で有効になります。

「外部のプラグインを一切使いたくない」「ネイティブのコードを自分で持っておきたい」
という場合だけ、以下の手順で自作版に差し替えられます。

---

## 差し替え手順

### 1. npm プラグインを外す

```bash
cd ios
npm uninstall @capawesome/capacitor-badge
npm run ios:sync
```

### 2. 2つの Swift ファイルを Xcode に追加する

1. `npx cap open ios` で Xcode を開く
2. 左のファイル一覧で **App**（青いアイコンの下にある黄色い App フォルダ）を右クリック
3. **Add Files to "App"...** を選ぶ
4. `ios/native/TonariBadgePlugin.swift` と `ios/native/TonariViewController.swift` を選ぶ
5. **Copy items if needed** に **チェックを入れる**、Add to targets の **App** に **チェックが入っていること** を確認して **Add**

### 3. 画面のクラスを差し替える

1. Xcode の左一覧で `App > Base.lproj > Main.storyboard` を開く
2. 画面（Bridge View Controller）を選択
3. 右側パネルの上のアイコン列から **Identity inspector**（□に⌐のマーク／左から4番目）を開く
4. **Custom Class** の **Class** 欄が `CAPBridgeViewController` になっているので、
   `TonariViewController` に書き換えて Enter
5. すぐ下の **Module** 欄が空（または `App`）になっていることを確認

> Module が `Capacitor` のままだと「クラスが見つからない」と言われて
> 起動時に真っ白になります。空欄にするか `App` にしてください。

### 4. 実行して確認

実機で「記録」タブのリマインダーを ON にし、設定時刻を過ぎた状態でアプリを
ホーム画面に戻すと、アイコンの右上に **1** が付けば成功です。

---

## うまくいかないときの見分け方

Safari の Web インスペクタ（Mac の Safari →「開発」メニュー → 接続した iPhone →
アプリ）でコンソールを開き、次を実行してください。

```js
window.__tonariDebug = true;
Object.keys(Capacitor.Plugins);
```

一覧に `TonariBadge`（自作版）または `Badge`（npm 版）が出ていれば登録できています。
どちらも無い場合は、バッジだけが動かず、通知や記録など他の機能はそのまま動きます。
