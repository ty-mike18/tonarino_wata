#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App Store 提出用のアイコンと起動画面(スプラッシュ)を、リポジトリ直下の
既存画像から生成します。

  実行方法:  python3 ios/scripts/make-assets.py
  必要なもの: Python 3 と Pillow  (pip install pillow)

生成物は ios/resources/ に出力されます。すでに生成済みのファイルが
同梱されているので、通常この script を実行し直す必要はありません。
画像を差し替えたくなったときだけ使ってください。

App Store のアイコン要件:
  - 1024 x 1024 px / PNG / 透過(アルファチャンネル)なし / 角丸を自分で付けない
  ここでは icon-512.png を不透明なブランドカラー(#1C4A3B)の上に重ねることで、
  角丸の外側を同色で埋め、要件どおりの「角のある正方形」にしています。
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "ios", "resources")
OUT_IOS = os.path.join(OUT, "ios")

BRAND_DEEP = (28, 74, 59)      # #1C4A3B  マニフェストの theme_color
BRAND_BG = (243, 247, 244)     # #F3F7F4  マニフェストの background_color


def ensure_dirs():
    os.makedirs(OUT_IOS, exist_ok=True)


def build_app_icon():
    """1024x1024 / 不透明 / 角丸なしのアプリアイコンを作る。"""
    src = Image.open(os.path.join(ROOT, "icon-512.png")).convert("RGBA")
    # ベタ塗り主体の絵柄なので、シャープ処理は輪郭に光の輪(ハロー)を作るだけ。
    # LANCZOS の 2倍拡大のみで、余計な後処理はかけない。
    big = src.resize((1024, 1024), Image.LANCZOS)
    canvas = Image.new("RGB", (1024, 1024), BRAND_DEEP)
    # 角丸の外側はブランドカラーで埋まる。角丸のふちも同じ緑なので継ぎ目は出ない。
    canvas.paste(big, (0, 0), big)
    canvas.save(os.path.join(OUT, "AppIcon-1024.png"), "PNG", optimize=True)
    # Capacitor が生成する Xcode プロジェクトの差し替え先と同じファイル名でも出力
    canvas.save(os.path.join(OUT_IOS, "AppIcon-512@2x.png"), "PNG", optimize=True)
    print("  AppIcon-1024.png / ios/AppIcon-512@2x.png  (1024x1024, 不透明)")


def build_splash():
    """起動画面。2732x2732 の正方形を 1x/2x/3x の3枚に書き出す。

    iOS はこの画像を画面中央に aspect-fill で置くため、正方形の中央付近だけが
    見える。端が切れても問題ないよう、絵柄は中央 50% に収めている。
    """
    body = Image.open(os.path.join(ROOT, "wata-body.png")).convert("RGBA")
    tail = Image.open(os.path.join(ROOT, "wata-tail.png")).convert("RGBA")
    mascot = Image.alpha_composite(tail, body)      # しっぽが下、体が上

    size = 2732
    canvas = Image.new("RGB", (size, size), BRAND_BG)
    target_w = int(size * 0.34)
    target_h = int(target_w * mascot.height / mascot.width)
    mascot = mascot.resize((target_w, target_h), Image.LANCZOS)
    canvas.paste(mascot, ((size - target_w) // 2, (size - target_h) // 2), mascot)

    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        canvas.save(os.path.join(OUT_IOS, name), "PNG", optimize=True)
    canvas.save(os.path.join(OUT, "Splash-2732.png"), "PNG", optimize=True)
    print("  Splash-2732.png / ios/splash-2732x2732*.png  (2732x2732)")


if __name__ == "__main__":
    ensure_dirs()
    print("App Store 提出用の画像を生成します:")
    build_app_icon()
    build_splash()
    print("完了: " + OUT)
