#!/bin/bash
# VOICEVOX（声）を用意する。GitHub の API は使えない環境なので、リリースの直リンクで落とす。
# 使い方: bash tools/setup_voice.sh   → /home/claude/vv に入る（2回目以降は何もしない）
set -e
V=/home/claude/vv; mkdir -p $V/models; cd $V
G=https://github.com
if ! python3 -c "import voicevox_core" 2>/dev/null; then
  curl -sL -o core.whl $G/VOICEVOX/voicevox_core/releases/download/0.17.1/voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl
  cp core.whl voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl
  pip install --break-system-packages -q voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl
  pip install --break-system-packages -q fugashi unidic-lite   # 字幕を文節で区切るため
fi
[ -d ort ] || { curl -sL -O $G/VOICEVOX/onnxruntime-builder/releases/download/voicevox_onnxruntime-1.17.3/voicevox_onnxruntime-linux-x64-1.17.3.tgz; mkdir -p ort; tar xzf voicevox_onnxruntime-linux-x64-1.17.3.tgz -C ort; }
[ -d dict ] || { curl -sL -O $G/r9y9/open_jtalk/releases/download/v1.11.1/open_jtalk_dic_utf_8-1.11.tar.gz; mkdir -p dict; tar xzf open_jtalk_dic_utf_8-1.11.tar.gz -C dict; }
# 0.vvm：四国めたん(2=ノーマル)・ずんだもん(3)・春日部つむぎ(8)・雨晴はう(10)。ほかの声が要るときは 1.vvm〜 を足す
[ -f models/0.vvm ] || curl -sL -o models/0.vvm $G/VOICEVOX/voicevox_vvm/releases/download/0.17.0/0.vvm
echo "voice ready: $V"
