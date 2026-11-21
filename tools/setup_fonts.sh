#!/bin/bash
# 字幕用のフォント（Google Fonts・SIL OFL）を <SS_HOME>/fonts に入れる。render_draft.py の --subfont で選ぶ
# 置き場所：この作業場なら /home/claude/vv/fonts、Mac などなら ~/.seisaku/fonts（tools/vis/sspaths.py と同じ決まり）
if [ -n "$SS_HOME" ]; then H="$SS_HOME"; elif [ -d /home/claude ]; then H=/home/claude/vv; else H="$HOME/.seisaku"; fi
mkdir -p "$H/fonts" && cd "$H/fonts" || exit 1
for f in "Zen+Maru+Gothic:wght@700" "M+PLUS+Rounded+1c:wght@800" "BIZ+UDPGothic:wght@700" "Zen+Kaku+Gothic+New:wght@700" "Noto+Serif+JP:wght@700" "RocknRoll+One" "Murecho:wght@700" "Kiwi+Maru:wght@500" "Dela+Gothic+One"; do
  n=$(echo $f | sed 's/[:+@]/_/g'); [ -s $n.ttf ] && continue
  u=$(curl -s -m 15 -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=$f" | grep -o 'https://[^)]*\.ttf' | head -1); [ -n "$u" ] && curl -s -m 60 -o $n.ttf "$u"
done
# 図解・字幕の土台の文字（Noto Sans）：Linux の Noto Sans CJK が無いとき（Mac など）は、同じ形の Noto Sans JP を入れる
if [ ! -e /usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc ]; then
  for w in "400 Regular" "500 Medium" "700 Bold" "900 Black"; do
    set -- $w; [ -s NotoSansJP-$2.ttf ] && continue
    u=$(curl -s -m 15 -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@$1" | grep -o 'https://[^)]*\.ttf' | head -1); [ -n "$u" ] && curl -s -m 120 -o NotoSansJP-$2.ttf "$u"
  done
fi
