//
//  TonariBadgePlugin.swift
//  となりの栄養士
//
//  【このファイルは「任意」です】
//  通常は npm の @capawesome/capacitor-badge を使えばバッジは動きます。
//  外部プラグインを一切使いたくない場合だけ、このファイルを使ってください。
//  導入手順は ios/native/README.md を参照。
//
//  アプリアイコンの右上に出る数字（バッジ）を操作するだけの、最小のプラグインです。
//

import Foundation
import UIKit
import Capacitor
import UserNotifications

@objc(TonariBadgePlugin)
public class TonariBadgePlugin: CAPPlugin, CAPBridgedPlugin {

    // JavaScript からは Capacitor.Plugins.TonariBadge で呼び出せる
    public let identifier = "TonariBadgePlugin"
    public let jsName = "TonariBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        apply(count: max(0, call.getInt("count") ?? 0), call: call)
    }

    @objc func clear(_ call: CAPPluginCall) {
        apply(count: 0, call: call)
    }

    /// バッジの表示には通知の許可（badge）が必要。許可が無いときは何もせず成功扱いにする。
    private func apply(count: Int, call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(count) { error in
                    if let error = error {
                        call.reject("バッジを更新できませんでした: \(error.localizedDescription)")
                    } else {
                        call.resolve()
                    }
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = count
                call.resolve()
            }
        }
    }
}
