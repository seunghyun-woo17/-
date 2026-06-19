/* ============================================================
   qr.js  —  QR 코드 생성 엔진 (커스텀 구현)
   역할: renderQRTo(containerId, text, pixelSize) 함수 제공
         외부 CDN 없이 브라우저에서 QR 이미지 생성
   ──────────────────────────────────────────────────────────
   사용처:
     - phase1.js : PO QR 생성
     - phase23.js: 제품 QR 생성
   참조: ECL-M, Version 1~10, Byte Mode, UTF-8 지원
   ============================================================ */
(function(global){
  var EXP=new Array(512),LOG=new Array(256);
  (function(){var x=1;for(var i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&0x100)x^=0x11d;}for(var i=255;i<512;i++)EXP[i]=EXP[i-255];})();
  function gfMul(a,b){return(a&&b)?EXP[LOG[a]+LOG[b]]:0;}
  function gfExp(n){while(n<0)n+=255;while(n>=256)n-=255;return EXP[n];}
  function getECPoly(ec){var p=[1];for(var i=0;i<ec;i++){var np=new Array(p.length+1);for(var j=0;j<np.length;j++)np[j]=0;var b=gfExp(i);for(var j=0;j<p.length;j++){np[j]^=gfMul(p[j],b);np[j+1]^=p[j];}p=np;}return p;}
  function rsEncode(data,ecLen){var gen=getECPoly(ecLen);var buf=data.concat(new Array(ecLen).fill(0));for(var i=0;i<data.length;i++){var c=buf[i];if(!c)continue;for(var j=0;j<gen.length;j++)buf[i+j]^=gfMul(gen[j],c);}return buf.slice(data.length);}
  var RS_M=[null,[[1,26,16]],[[1,44,28]],[[1,70,44]],[[2,50,32]],[[2,67,43]],[[4,43,27]],[[4,49,31]],[[2,60,38],[2,61,39]],[[3,58,36],[2,59,37]],[[4,69,43],[1,70,44]]];
  var CAP_M=[0,16,28,44,64,86,108,124,154,182,216];
  function bchDigit(n){var d=0;while(n){d++;n>>>=1;}return d;}
  function bchTypeInfo(data){var d=data<<10;while(bchDigit(d)-bchDigit(0x537)>=0)d^=0x537<<(bchDigit(d)-bchDigit(0x537));return((data<<10)|d)^0x5412;}
  var MASK=[function(r,c){return(r+c)%2===0;},function(r,c){return r%2===0;},function(r,c){return c%3===0;},function(r,c){return(r+c)%3===0;},function(r,c){return(Math.floor(r/2)+Math.floor(c/3))%2===0;},function(r,c){return(r*c)%2+(r*c)%3===0;},function(r,c){return((r*c)%2+(r*c)%3)%2===0;},function(r,c){return((r+c)%2+(r*c)%3)%2===0;}];
  var ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54]];
  function buildMatrix(ver,data8bits,maskId){
    var N=ver*4+17;var m=[];for(var i=0;i<N;i++){m[i]=new Array(N);for(var j=0;j<N;j++)m[i][j]=null;}
    function finder(row,col){for(var r=-1;r<=7;r++)for(var c=-1;c<=7;c++){if(row+r<0||N<=row+r||col+c<0||N<=col+c)continue;m[row+r][col+c]=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4);}}
    finder(0,0);finder(N-7,0);finder(0,N-7);
    for(var i=8;i<N-8;i++){if(m[6][i]===null)m[6][i]=i%2===0;if(m[i][6]===null)m[i][6]=i%2===0;}
    var ap=ALIGN[ver];for(var pi=0;pi<ap.length;pi++)for(var pj=0;pj<ap.length;pj++){var row=ap[pi],col=ap[pj];if(m[row][col]!==null)continue;for(var r=-2;r<=2;r++)for(var c=-2;c<=2;c++)m[row+r][col+c]=(r===-2||r===2||c===-2||c===2||(r===0&&c===0));}
    var fmt=bchTypeInfo((0<<3)|maskId);function fmtBit(i){return!!((fmt>>(14-i))&1);}
    var C1R=[0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];var C1C=[8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];for(var i=0;i<15;i++)m[C1R[i]][C1C[i]]=fmtBit(i);
    var C2R=[8,8,8,8,8,8,8,8,N-7,N-6,N-5,N-4,N-3,N-2,N-1];var C2C=[N-1,N-2,N-3,N-4,N-5,N-6,N-7,N-8,8,8,8,8,8,8,8];for(var i=0;i<15;i++)m[C2R[i]][C2C[i]]=fmtBit(i);
    m[N-8][8]=true;
    var bits=data8bits;var bit=0,inc=-1,row=N-1;
    for(var col=N-1;col>0;col-=2){if(col===6)col--;while(true){for(var dc=0;dc<2;dc++){var c=col-dc,r=row;if(m[r][c]===null){var dark=bit<bits.length?bits[bit++]:false;if(MASK[maskId](r,c))dark=!dark;m[r][c]=dark;}}row+=inc;if(row<0||N<=row){row-=inc;inc=-inc;break;}}}
    return m;
  }
  function penalty(m,N){var p=0;for(var r=0;r<N;r++){var run=1;for(var c=1;c<N;c++){if(m[r][c]===m[r][c-1])run++;else{if(run>=5)p+=run-2;run=1;}}if(run>=5)p+=run-2;}for(var c=0;c<N;c++){var run=1;for(var r=1;r<N;r++){if(m[r][c]===m[r-1][c])run++;else{if(run>=5)p+=run-2;run=1;}}if(run>=5)p+=run-2;}for(var r=0;r<N-1;r++)for(var c=0;c<N-1;c++){var b=0;if(m[r][c])b++;if(m[r+1][c])b++;if(m[r][c+1])b++;if(m[r+1][c+1])b++;if(b===0||b===4)p+=3;}var dark=0;for(var r=0;r<N;r++)for(var c=0;c<N;c++)if(m[r][c])dark++;p+=Math.abs(Math.floor(100*dark/N/N)-50)/5*10;return p;}
  function encodeText(text,ver){
    var bytes=[];for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c<128)bytes.push(c);else if(c<2048){bytes.push(0xC0|(c>>6));bytes.push(0x80|(c&0x3f));}else{bytes.push(0xE0|(c>>12));bytes.push(0x80|((c>>6)&0x3f));bytes.push(0x80|(c&0x3f));}}
    var bits=[];function pushBits(v,n){for(var i=n-1;i>=0;i--)bits.push((v>>i)&1);}
    pushBits(4,4);var lenBits=ver<10?8:16;pushBits(bytes.length,lenBits);for(var i=0;i<bytes.length;i++)pushBits(bytes[i],8);
    var rsTable=RS_M[ver];var totalData=0;for(var i=0;i<rsTable.length;i++)totalData+=rsTable[i][0]*rsTable[i][2];
    for(var i=0;i<4&&bits.length<totalData*8;i++)bits.push(0);while(bits.length%8!==0)bits.push(0);var pad=0;while(bits.length<totalData*8){pushBits(pad?0x11:0xEC,8);pad=1-pad;}
    var cw=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|(bits[i+j]||0);cw.push(b);}
    var dcBlocks=[],ecBlocks=[],off=0;for(var bi=0;bi<rsTable.length;bi++){var cnt=rsTable[bi][0],ecLen=rsTable[bi][1]-rsTable[bi][2],dcLen=rsTable[bi][2];for(var k=0;k<cnt;k++){var dc=cw.slice(off,off+dcLen);off+=dcLen;dcBlocks.push(dc);ecBlocks.push(rsEncode(dc,ecLen));}}
    var result=[];var maxDC=Math.max.apply(null,dcBlocks.map(function(b){return b.length;}));for(var i=0;i<maxDC;i++)for(var b=0;b<dcBlocks.length;b++)if(i<dcBlocks[b].length)result.push(dcBlocks[b][i]);
    var maxEC=Math.max.apply(null,ecBlocks.map(function(b){return b.length;}));for(var i=0;i<maxEC;i++)for(var b=0;b<ecBlocks.length;b++)if(i<ecBlocks[b].length)result.push(ecBlocks[b][i]);
    return result;
  }
  function cwToBits(cw){var bits=[];for(var i=0;i<cw.length;i++)for(var j=7;j>=0;j--)bits.push((cw[i]>>j)&1);return bits;}

  global.renderQRTo = function(containerId, text, pixelSize) {
    pixelSize = pixelSize || 140;
    var wrap = document.getElementById(containerId);
    if (!wrap) return '';
    wrap.innerHTML = '';
    try {
      var textBytes=[];for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c<128)textBytes.push(c);else if(c<2048){textBytes.push(0xC0|(c>>6));textBytes.push(0x80|(c&0x3f));}else{textBytes.push(0xE0|(c>>12));textBytes.push(0x80|((c>>6)&0x3f));textBytes.push(0x80|(c&0x3f));}}
      var ver=1;for(var v=1;v<=10;v++){if(CAP_M[v]>=textBytes.length){ver=v;break;}ver=10;}
      if(textBytes.length>CAP_M[10])throw new Error('QR 데이터 초과 (최대 ~174 bytes)');
      var cw=encodeText(text,ver);var bits=cwToBits(cw);var N=ver*4+17;var bestMask=0,bestPen=Infinity;
      for(var mp=0;mp<8;mp++){var mat=buildMatrix(ver,bits,mp);var pen=penalty(mat,N);if(pen<bestPen){bestPen=pen;bestMask=mp;}}
      var matrix=buildMatrix(ver,bits,bestMask);var BORDER=4;var CELL=Math.max(2,Math.floor(pixelSize/(N+BORDER*2)));var SZ=(N+BORDER*2)*CELL;
      var canvas=document.createElement('canvas');canvas.width=SZ;canvas.height=SZ;var ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,SZ,SZ);ctx.fillStyle='#000000';
      for(var r=0;r<N;r++)for(var c=0;c<N;c++)if(matrix[r][c])ctx.fillRect((c+BORDER)*CELL,(r+BORDER)*CELL,CELL,CELL);
      var dataUrl=canvas.toDataURL('image/png');global._lastQRSrc=dataUrl;global._lastQRData=text;
      var img=document.createElement('img');img.src=dataUrl;img.alt='QR Code';img.style.cssText='width:'+pixelSize+'px;height:'+pixelSize+'px;display:block;border-radius:4px;';
      wrap.appendChild(img);return dataUrl;
    } catch(err) {
      console.error('QR 생성 오류:', err);
      wrap.innerHTML='<div style="width:'+pixelSize+'px;height:'+pixelSize+'px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--danger);text-align:center;padding:8px;">QR 오류<br>'+err.message+'</div>';
      global._lastQRSrc='';return '';
    }
  };
})(window);
