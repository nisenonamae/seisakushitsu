#!/bin/bash
# VOICEVOX エンジン（声の調整室と同じもの）を用意して起動する。tools/voice_render.py と render_draft.py --kata が使う
set -e
VER=0.26.2; D=/home/claude/vve
if [ ! -x $D/linux-cpu-x64/run ]; then
  mkdir -p $D && cd $D
  curl -sL -o e.7z.001 "https://github.com/VOICEVOX/voicevox_engine/releases/download/$VER/voicevox_engine-linux-cpu-x64-$VER.7z.001"
  pip install --break-system-packages -q py7zr
  python3 -c "import py7zr;py7zr.SevenZipFile('e.7z.001','r').extractall('.')" && rm e.7z.001
fi
if ! curl -s http://127.0.0.1:50021/version >/dev/null; then
  cd $D/linux-cpu-x64 && (nohup ./run --host 127.0.0.1 --port 50021 --cpu_num_threads 4 > /tmp/vve.log 2>&1 &)
  for i in $(seq 1 90); do curl -s http://127.0.0.1:50021/version >/dev/null && break; sleep 2; done
fi
curl -s http://127.0.0.1:50021/version; echo " エンジン起動ずみ"
