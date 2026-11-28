/* tools/make_frames.py が作る。手で直さない */
window.HYOKA_MANIFEST = {
 "made": "tools/make_frames.py",
 "docSize": [
  1600,
  900
 ],
 "crop": [
  160,
  150,
  1440,
  870
 ],
 "frameSize": [
  1280,
  720
 ],
 "bigSize": [
  1600,
  900
 ],
 "walkN": 24,
 "headN": 36,
 "versions": [
  {
   "key": "P4_AI",
   "set": "P4",
   "label": "P4 の AI のみ",
   "code": "a28",
   "frames": {
    "walk": 24,
    "head": 36
   },
   "src": "lab/hyoka/src/e5/P4.json",
   "measured": {
    "area": 475713,
    "left": 180,
    "right": 1377,
    "top": 214,
    "bottom": 772
   },
   "bytes": 708966,
   "sha": "324f0473f8c8"
  },
  {
   "key": "E5_A",
   "set": "E5",
   "label": "E5 の A 通常",
   "code": "r16",
   "frames": {
    "walk": 24,
    "head": 36
   },
   "src": "lab/hyoka/src/e5/A.json",
   "measured": {
    "area": 469826,
    "left": 200,
    "right": 1398,
    "top": 232,
    "bottom": 770
   },
   "bytes": 770948,
   "sha": "f434136fdad9"
  },
  {
   "key": "E5_D",
   "set": "E5",
   "label": "E5 の D 関節の丸み",
   "code": "m40",
   "frames": {
    "walk": 24,
    "head": 36
   },
   "src": "lab/hyoka/src/e5/D.json",
   "measured": {
    "area": 469777,
    "left": 200,
    "right": 1398,
    "top": 232,
    "bottom": 770
   },
   "bytes": 770630,
   "sha": "cbbaa645b379"
  },
  {
   "key": "E5_E",
   "set": "E5",
   "label": "E5 の E 組み合わせ",
   "code": "f58",
   "frames": {
    "walk": 24,
    "head": 36
   },
   "src": "lab/hyoka/src/e5/E.json",
   "measured": {
    "area": 469650,
    "left": 200,
    "right": 1415,
    "top": 231,
    "bottom": 770
   },
   "bytes": 778550,
   "sha": "d2e0c701f7cb"
  },
  {
   "key": "E5_F",
   "set": "E5",
   "label": "E5 の F 脚のすき間なし",
   "code": "b77",
   "frames": {
    "walk": 24,
    "head": 36
   },
   "src": "lab/hyoka/src/e5/F.json",
   "measured": {
    "area": 466222,
    "left": 200,
    "right": 1415,
    "top": 231,
    "bottom": 770
   },
   "bytes": 737660,
   "sha": "4d873e80fb26"
  },
  {
   "key": "E6_L2",
   "set": "E6",
   "label": "E6 の基準（L2）",
   "code": "q75",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/L2.json",
   "measured": {
    "area": 469825,
    "left": 200,
    "right": 1398,
    "top": 232,
    "bottom": 770
   },
   "bytes": 331426,
   "sha": "15fe40afb763"
  },
  {
   "key": "E6_eye2",
   "set": "E6",
   "label": "E6 目を 2 倍",
   "code": "x21",
   "frames": {},
   "src": "lab/hyoka/src/e6/B4目大_2.json",
   "measured": {
    "area": 469825,
    "left": 200,
    "right": 1398,
    "top": 232,
    "bottom": 770
   },
   "bytes": 33212,
   "sha": "336441aa0d65"
  },
  {
   "key": "E6_head121",
   "set": "E6",
   "label": "E6 頭を 1.21 倍",
   "code": "p92",
   "frames": {},
   "src": "lab/hyoka/src/e6/B1頭大_2.json",
   "measured": {
    "area": 469545,
    "left": 188,
    "right": 1409,
    "top": 229,
    "bottom": 770
   },
   "bytes": 33764,
   "sha": "550a555c1dcd"
  },
  {
   "key": "E6_head152",
   "set": "E6",
   "label": "E6 頭を 1.52 倍",
   "code": "u64",
   "frames": {},
   "src": "lab/hyoka/src/e6/B1頭大_4.json",
   "measured": {
    "area": 470427,
    "left": 180,
    "right": 1415,
    "top": 233,
    "bottom": 770
   },
   "bytes": 34070,
   "sha": "3e514e8d6d68"
  },
  {
   "key": "E6_legShort",
   "set": "E6",
   "label": "E6 脚を短く",
   "code": "c88",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A12_脚短.json",
   "measured": {
    "area": 469686,
    "left": 192,
    "right": 1406,
    "top": 254,
    "bottom": 770
   },
   "bytes": 326670,
   "sha": "43d156e51c88"
  },
  {
   "key": "E6_legLong",
   "set": "E6",
   "label": "E6 脚を長く（実物の比）",
   "code": "d10",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A13_脚長.json",
   "measured": {
    "area": 469818,
    "left": 210,
    "right": 1388,
    "top": 202,
    "bottom": 770
   },
   "bytes": 337524,
   "sha": "c1977d16bdc2"
  },
  {
   "key": "E6_pillar",
   "set": "E6",
   "label": "E6 柱",
   "code": "n88",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A01_柱.json",
   "measured": {
    "area": 469921,
    "left": 201,
    "right": 1397,
    "top": 232,
    "bottom": 770
   },
   "bytes": 331444,
   "sha": "8cf41d167d24"
  },
  {
   "key": "E6_zou",
   "set": "E6",
   "label": "E6 ゾウ足",
   "code": "z82",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A05_ゾウ足.json",
   "measured": {
    "area": 469769,
    "left": 206,
    "right": 1392,
    "top": 237,
    "bottom": 770
   },
   "bytes": 331768,
   "sha": "58e9e446060f"
  },
  {
   "key": "E6_momo",
   "set": "E6",
   "label": "E6 丸いもも",
   "code": "v89",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A06_丸いもも.json",
   "measured": {
    "area": 470143,
    "left": 197,
    "right": 1401,
    "top": 229,
    "bottom": 770
   },
   "bytes": 339840,
   "sha": "21da3668a857"
  },
  {
   "key": "E6_hiza",
   "set": "E6",
   "label": "E6 ひざと足首",
   "code": "h16",
   "frames": {
    "walk": 24
   },
   "src": "lab/hyoka/src/e6/A03_ひざと足首.json",
   "measured": {
    "area": 470026,
    "left": 200,
    "right": 1398,
    "top": 231,
    "bottom": 770
   },
   "bytes": 336680,
   "sha": "0447ac8cb903"
  }
 ],
 "bytes": 6203152
};
