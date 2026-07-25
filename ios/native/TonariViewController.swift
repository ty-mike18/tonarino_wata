//
//  TonariViewController.swift
//  となりの栄養士
//
//  【このファイルは「任意」です】TonariBadgePlugin.swift とセットで使います。
//
//  Capacitor は capacitor.config.json に書かれた npm プラグインを自動登録しますが、
//  アプリ本体の中に自分で書いたプラグインは自動では登録されません。
//  そこで、画面の土台になっている CAPBridgeViewController を継承し、
//  読み込み完了のタイミングで自作プラグインを登録します。
//
//  導入手順は ios/native/README.md を参照。
//

import UIKit
import Capacitor

class TonariViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(TonariBadgePlugin())
    }
}
