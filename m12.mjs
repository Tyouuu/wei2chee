import sharp from "sharp"
const W=640
const a=await sharp(".screenshots/photo/public-before.png").resize({width:W}).extract({left:0,top:0,width:W,height:520}).png().toBuffer()
const b=await sharp(".screenshots/finish/after-1.png").resize({width:W}).extract({left:0,top:0,width:W,height:520}).png().toBuffer()
await sharp({create:{width:W*2+12,height:546,channels:3,background:"#fff"}}).composite([
 {input:Buffer.from('<svg width="640" height="20"><text x="2" y="15" font-family="monospace" font-size="14" fill="#111">before</text></svg>'),left:0,top:0},
 {input:a,left:0,top:24},
 {input:Buffer.from('<svg width="640" height="20"><text x="2" y="15" font-family="monospace" font-size="14" fill="#111">after</text></svg>'),left:W+12,top:0},
 {input:b,left:W+12,top:24},
]).jpeg({quality:88}).toFile(".screenshots/finish/pair.jpg")
console.log("ok")
