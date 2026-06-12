(function(){
  const hamb=document.getElementById('hamb');
  const mobile=document.getElementById('mobile');
  if(hamb&&mobile){hamb.addEventListener('click',()=>{const open=mobile.classList.toggle('open');hamb.setAttribute('aria-expanded',String(open));});mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobile.classList.remove('open');hamb.setAttribute('aria-expanded','false');}));}

  document.querySelectorAll('.hero-media').forEach(hero=>{
    const video=hero.querySelector('.hero-bg-video');
    if(!video) return;
    const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let warmed=false;
    const warmVideo=()=>{
      if(reduced || warmed) return;
      warmed=true;
      video.preload='auto';
      try{video.load();}catch(err){}
    };
    if(!reduced){
      if('requestIdleCallback' in window){
        requestIdleCallback(warmVideo,{timeout:1800});
      }else{
        setTimeout(warmVideo,1200);
      }
    }
    const playVideo=()=>{
      if(reduced) return;
      warmVideo();
      const p=video.play();
      hero.classList.add('is-video-active');
      if(p && typeof p.catch==='function'){p.catch(()=>{});}
    };
    const stopVideo=()=>{
      hero.classList.remove('is-video-active');
      try{video.pause();video.currentTime=0;}catch(err){}
    };
    hero.addEventListener('pointerenter',warmVideo,{once:true});
    hero.addEventListener('mouseenter',playVideo);
    hero.addEventListener('mouseleave',stopVideo);
    hero.addEventListener('focusin',playVideo);
    hero.addEventListener('focusout',e=>{ if(!hero.contains(e.relatedTarget)) stopVideo(); });
  });
  document.querySelectorAll('form[data-script-form="true"]').forEach(form=>{
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(form.querySelector('[name="website_hp"]')?.value) return;
      if(!form.checkValidity()){form.reportValidity();return;}
      const btn=form.querySelector('button[type="submit"]');
      const original=btn?btn.textContent:'';
      if(btn){btn.disabled=true;btn.textContent=btn.dataset.loading||'Küldés…';}
      const data=new FormData(form);
      const submittedAt=new Date().toISOString();
      data.append('page',location.href);
      data.append('page_url',location.href);
      data.append('submitted_at',submittedAt);
      data.append('userAgent',navigator.userAgent||'');
      data.append('processing_context','GitHub Pages static hosting; Google Apps Script / Google Workspace form relay; privacy version '+(form.querySelector('[name="privacy_version"]')?.value||''));
      if(data.get('gdpr')){
        data.append('gdpr_accepted_at',submittedAt);
        data.append('gdpr_acceptance_text',(form.querySelector('[data-gdpr-text="true"]')?.textContent||'').trim());
      }
      try{await fetch(form.action,{method:'POST',body:data,mode:'no-cors'});}
      catch(err){console.warn('Form relay warning',err);}
      const ok=form.querySelector('.success-banner');
      if(ok) ok.classList.add('show');
      form.reset();
      if(btn){btn.disabled=false;btn.textContent=original;}
      const redirect=form.dataset.redirect;
      if(redirect) setTimeout(()=>{location.href=redirect;},900);
    });
  });
})();
