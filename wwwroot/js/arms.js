window.armsTheme={apply:function(t){let e=t;if(t==='system')e=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',e)},init:function(){this.apply(localStorage.getItem('arms-theme')||'light')},set:function(t){localStorage.setItem('arms-theme',t);this.apply(t)},getUser:function(){return localStorage.getItem('arms-user')||null},setUser:function(u){localStorage.setItem('arms-user',u)},clearUser:function(){localStorage.removeItem('arms-user')}};
window.armsTableSort={
  init:function(){
    if(!window.__armsTableSortDelegated){
      window.__armsTableSortDelegated=true;
      document.addEventListener('click',function(ev){
        const th=ev.target.closest('table thead th');
        if(!th)return;
        const table=th.closest('table');
        if(!table || table.classList.contains('no-sort'))return;
        const tbody=table.tBodies && table.tBodies[0];
        if(!tbody)return;
        const headers=Array.from(table.tHead?.rows?.[0]?.cells||[]);
        const index=headers.indexOf(th);
        if(index<0)return;
        const rows=Array.from(tbody.rows).map((row,i)=>({row,i}));
        const asc=th.getAttribute('aria-sort')!=='ascending';
        headers.forEach(h=>{h.removeAttribute('aria-sort');h.classList.remove('sortable-active');});
        th.setAttribute('aria-sort',asc?'ascending':'descending');
        th.classList.add('sortable-active');
        const normalize=(v)=>String(v||'').replace(/\s+/g,' ').trim().replace(/,/g,'')
          .replace(/\u0660/g,'0').replace(/\u0661/g,'1').replace(/\u0662/g,'2').replace(/\u0663/g,'3').replace(/\u0664/g,'4')
          .replace(/\u0665/g,'5').replace(/\u0666/g,'6').replace(/\u0667/g,'7').replace(/\u0668/g,'8').replace(/\u0669/g,'9');
        const value=(row)=>normalize(row.cells[index]?.innerText);
        const classify=(v)=>{
          if(v==='')return {t:'empty',v:''};
          if(/^[-+]?\d+(?:\.\d+)?$/.test(v))return {t:'number',v:Number(v)};
          if(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}(?:[ T]\d{1,2}:\d{2})?$/.test(v)){const d=Date.parse(v.replace(' ','T'));if(!Number.isNaN(d))return {t:'date',v:d};}
          return {t:'text',v:v};
        };
        rows.sort((a,b)=>{
          const av=classify(value(a)),bv=classify(value(b));
          let c;
          if(av.t==='empty'&&bv.t!=='empty') c=-1;
          else if(av.t!=='empty'&&bv.t==='empty') c=1;
          else if(av.t===bv.t&&(av.t==='number'||av.t==='date')) c=av.v-bv.v;
          else c=String(av.v).localeCompare(String(bv.v),'ar',{numeric:true,sensitivity:'base'});
          return (c===0?a.i-b.i:(asc?c:-c));
        });
        rows.forEach(x=>tbody.appendChild(x.row));
      },true);
    }
    this.decorate();
  },
  decorate:function(){
    document.querySelectorAll('table thead th').forEach(function(th){
      const table=th.closest('table');
      if(!table || table.classList.contains('no-sort'))return;
      th.style.cursor='pointer';
      th.title='اضغط للترتيب تصاعديًا ثم تنازليًا';
    });
  }
};
document.addEventListener('DOMContentLoaded',function(){window.armsTableSort.init();});
new MutationObserver(function(){if(window.armsTableSort)window.armsTableSort.decorate();}).observe(document.documentElement,{childList:true,subtree:true});

window.armsDownload = window.armsDownload || {
  downloadBase64: function(fileName, contentType, base64){
    const a=document.createElement('a'); a.href='data:'+contentType+';base64,'+base64; a.download=fileName; document.body.appendChild(a); a.click(); a.remove();
  }
};
