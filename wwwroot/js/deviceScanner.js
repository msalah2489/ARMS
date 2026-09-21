window.armsDeviceScanner = (function () {
  let stream=null,timer=null,dotnet=null,video=null,canvas=null,ctx=null,running=false,reader=null;
  async function start(dotnetRef,videoId,canvasId){
    stop(); dotnet=dotnetRef; video=document.getElementById(videoId); canvas=document.getElementById(canvasId);
    if(!video||!canvas) throw new Error('تعذر تجهيز الكاميرا.');
    if(!window.isSecureContext && location.hostname!=='localhost' && location.hostname!=='127.0.0.1') throw new Error('الكاميرا في المتصفح تحتاج اتصال HTTPS. افتح النظام عبر HTTPS على الموبايل/الأجهزة الأخرى، أو استخدم إدخال الكود/قارئ USB.');
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('المتصفح لا يدعم الوصول إلى الكاميرا.');
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream; video.setAttribute('playsinline','true'); await video.play(); running=true;
    if('BarcodeDetector' in window){
      let detector; try{detector=new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e']});}catch(_){detector=new BarcodeDetector();}
      const scan=async()=>{if(!running||!video||video.readyState<2)return;try{const w=video.videoWidth||640,h=video.videoHeight||480;canvas.width=w;canvas.height=h;ctx=ctx||canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,w,h);const codes=await detector.detect(canvas);if(codes?.length){const value=(codes[0].rawValue||'').trim();if(value){running=false;await dotnet.invokeMethodAsync('OnDeviceCodeScanned',value);stop();return;}}}catch(_){}if(running)timer=requestAnimationFrame(scan);};
      timer=requestAnimationFrame(scan); return;
    }
    if(window.ZXingBrowser){
      reader=new ZXingBrowser.BrowserMultiFormatReader();
      try{await reader.decodeFromVideoDevice(undefined,video,async(result)=>{if(!running||!result)return;const value=(result.getText?.()||'').trim();if(value){running=false;await dotnet.invokeMethodAsync('OnDeviceCodeScanned',value);stop();}});return;}catch(e){stop();throw new Error('تعذر تشغيل قارئ QR/Barcode بالكاميرا: '+(e?.message||e));}
    }
    stop(); throw new Error('لا توجد آلية قراءة QR/Barcode متاحة في هذا المتصفح.');
  }
  function stop(){running=false;if(timer)cancelAnimationFrame(timer);timer=null;if(reader?.reset)try{reader.reset();}catch(_){}reader=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(video)video.srcObject=null;dotnet=null;}
  return {start,stop};
})();
