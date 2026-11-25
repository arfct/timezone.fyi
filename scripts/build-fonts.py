import json, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
# Builds the two static Inter faces the link-preview image uses, and their
# advance widths (for fitting text), from Inter's variable font.
# Usage: python scripts/build-fonts.py path/to/InterVariable.ttf
# Needs fonttools. Inter is under the SIL Open Font License (src/fonts/OFL.txt).
src=sys.argv[1]
out=os.path.join(os.path.dirname(__file__),"..","src","fonts","")
f=TTFont(src); print([ (a.axisTag,a.minValue,a.defaultValue,a.maxValue) for a in f['fvar'].axes])
uni=list(range(0x20,0x7f))+list(range(0xa0,0x180))+[0x2013,0x2014,0x2212,0x2018,0x2019,0x201c,0x201d,0x2026,0x2022,0x00b7,0x2192,0x2190,0x2032,0x2033,0x20ac]
metrics={}
for w,name in ((500,"Medium"),(700,"Bold")):
    f=TTFont(src)
    inst=instancer.instantiateVariableFont(f,{"wght":w,"opsz":32})
    opts=subset.Options(); opts.layout_features=["kern","liga","calt","ccmp","locl","mark","mkmk"]; opts.name_IDs=[1,2,3,4,6]; opts.notdef_outline=True
    s=subset.Subsetter(opts); s.populate(unicodes=uni); s.subset(inst)
    # name the family plainly so resvg matches font-family="Inter" + weight
    for rec in inst['name'].names:
        if rec.nameID==1: rec.string="Inter"
        if rec.nameID==2: rec.string=name if name!="Medium" else "Medium"
    inst['OS/2'].usWeightClass=w
    p=out+f"Inter-{name}.subset.ttf"; inst.save(p)
    cmap=inst.getBestCmap(); hm=inst['hmtx']; upm=inst['head'].unitsPerEm
    metrics[str(w)]={chr(c):round(hm[g][0]/upm,4) for c,g in cmap.items()}
    print(p, os.path.getsize(p), len(cmap))
json.dump(metrics,open(out+"inter-metrics.json","w"),ensure_ascii=False,separators=(",",":"))
