(function(){
  const hamb=document.getElementById('hamb');
  const mobile=document.getElementById('mobile');
  if(hamb&&mobile){hamb.addEventListener('click',()=>{const open=mobile.classList.toggle('open');hamb.setAttribute('aria-expanded',String(open));});mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobile.classList.remove('open');hamb.setAttribute('aria-expanded','false');}));}

  document.querySelectorAll('.hero-media').forEach(hero=>{
    const video=hero.querySelector('.hero-bg-video');
    if(!video) return;
    const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile=()=>window.matchMedia && window.matchMedia('(max-width: 920px)').matches;
    video.muted=true;
    video.playsInline=true;
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    const activate=()=>hero.classList.add('is-video-active');
    const playVideo=()=>{
      if(reduced) return;
      try{video.load();}catch(err){}
      const p=video.play();
      if(p && typeof p.then==='function'){
        p.then(activate).catch(()=>hero.classList.remove('is-video-active'));
      }else{
        activate();
      }
    };
    const stopVideo=()=>{
      if(isMobile()) return;
      hero.classList.remove('is-video-active');
      try{video.pause();video.currentTime=0;}catch(err){}
    };
    const startMobileAutoplay=()=>{
      if(!isMobile() || reduced) return;
      playVideo();
    };
    hero.addEventListener('mouseenter',playVideo);
    hero.addEventListener('mouseleave',stopVideo);
    hero.addEventListener('focusin',playVideo);
    hero.addEventListener('focusout',e=>{ if(!hero.contains(e.relatedTarget)) stopVideo(); });
    hero.addEventListener('touchstart',playVideo,{passive:true,once:true});
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){startMobileAutoplay();observer.disconnect();}
        });
      },{threshold:.28});
      observer.observe(hero);
    }else{
      window.addEventListener('load',startMobileAutoplay,{once:true});
    }
    if(document.readyState==='complete' || document.readyState==='interactive'){
      setTimeout(startMobileAutoplay,350);
    }else{
      document.addEventListener('DOMContentLoaded',()=>setTimeout(startMobileAutoplay,350),{once:true});
    }
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
