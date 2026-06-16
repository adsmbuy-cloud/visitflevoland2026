/**
 * dashboard-core.js — mBuy Campaign Dashboard Engine v1.2
 * ─────────────────────────────────────────────────────────
 * + Refresh button with spinner
 * + Live data indicator
 * + Enhanced Chart.js hover tooltips
 * + Clickable KPI cards → all charts update to selected metric
 */
(function () {
  const C = window.DASH_CONFIG;
  const D = window.DASH_DATA;
  if (!C || !D) { document.body.innerHTML = '<p style="padding:40px;color:red">Missing DASH_CONFIG or DASH_DATA</p>'; return; }

  // ── helpers ──────────────────────────────────────────────
  const fmt  = (n,d=0) => (+n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
  const fmtE = (n,d=2) => '€'+fmt(n,d);
  const fmtP = (n,d=2) => fmt(n,d)+'%';
  const inR  = (d,f,t) => d >= f && d <= t;
  function datesInR(f,t){const ds=[],c=new Date(f+'T00:00:00Z'),e=new Date(t+'T00:00:00Z');while(c<=e){ds.push(c.toISOString().slice(0,10));c.setUTCDate(c.getUTCDate()+1)}return ds}

  const CH = C.channels;
  const enabledChs = Object.keys(CH).filter(k => CH[k].enabled);

  // ── active metric state ───────────────────────────────────
  let activeMetric = 'imp';
  const METRICS = {
    spend:  { key:'cost',   label:'Spend',       unit:'€',  fmt: v => fmtE(v)  },
    imp:    { key:'imp',    label:'Impressions',  unit:'',   fmt: v => fmt(v) },
    clicks: { key:'clicks', label:'Clicks',       unit:'',   fmt: v => fmt(v)   },
    ctr:    { key:'ctr',    label:'CTR',          unit:'%',  fmt: v => fmtP(v)  },
    cpm:    { key:'cpm',    label:'CPM',          unit:'€',  fmt: v => fmtE(v)  },
    cpc:    { key:'cpc',    label:'CPC',          unit:'€',  fmt: v => fmtE(v)  },
    budget: { key:'budgetPct', label:'Budget Used', unit:'%', fmt: v => fmtP(v) },
  };

  // ── count total data rows for live indicator ──────────────
  function countRows(){
    let n=0;
    if(D.google)   n += D.google.length;
    if(D.meta)     n += D.meta.length;
    if(D.tiktok&&D.tiktok.ads)     n += D.tiktok.ads.length;
    if(D.dpg&&D.dpg.formats)       n += D.dpg.formats.length;
    if(D.dooh)     n += D.dooh.length;
    if(D.reddit&&D.reddit.ads)     n += D.reddit.ads.length;
    if(D.readpeak&&D.readpeak.ads)       n += D.readpeak.ads.length;
    if(D.showheroes&&D.showheroes.ads)   n += D.showheroes.ads.length;
    if(D.adalliance&&D.adalliance.publishers) n += D.adalliance.publishers.length;
    if(D.budget)   n += D.budget.length;
    return n;
  }

  // ── accent override ───────────────────────────────────────
  const accentStyle = C.accentColor ? `<style>:root{--accent:${C.accentColor}}</style>` : '';

  // ── build tabs ────────────────────────────────────────────
  const baseTabs = [{ id:'overview', label:'📊 Overview' }];
  if (CH.google   && CH.google.enabled)   baseTabs.push({ id:'google',   label:'🔍 Google' });
  if (CH.meta     && CH.meta.enabled)     baseTabs.push({ id:'meta',     label:'📘 Meta' });
  if (CH.tiktok   && CH.tiktok.enabled)   baseTabs.push({ id:'tiktok',   label:'🎵 TikTok' });
  if (CH.dpg      && CH.dpg.enabled)      baseTabs.push({ id:'dpg',      label:'📰 DPG & Adform' });
  if (CH.adform   && CH.adform.enabled)   baseTabs.push({ id:'adform',   label:'🔶 Adform' });
  if (CH.readpeak && CH.readpeak.enabled) baseTabs.push({ id:'readpeak', label:'📡 Readpeak' });
  if (CH.reddit   && CH.reddit.enabled)   baseTabs.push({ id:'reddit',   label:'🔴 Reddit' });
  if (CH.dooh     && CH.dooh.enabled)     baseTabs.push({ id:'dooh',     label:'🏙️ DOOH' });
  if (CH.showheroes && CH.showheroes.enabled) baseTabs.push({ id:'showheroes', label:'🎬 Showheroes' });
  if (CH.adalliance && CH.adalliance.enabled) baseTabs.push({ id:'adalliance', label:'📺 AdAlliance' });
  if (CH.talpa && CH.talpa.enabled) baseTabs.push({ id:'talpa', label:'📺 Talpa' });
  if (CH.pinterest && CH.pinterest.enabled) baseTabs.push({ id:'pinterest', label:'📌 Pinterest' });
  if (CH.native && CH.native.enabled) baseTabs.push({ id:'native', label:'📰 Native' });
  // baseTabs.push({ id:'vtr', label:'▶️ VTR' }); // tijdelijk verborgen – wacht op echte Meta video completion data
  if (D.ga4 && D.ga4.length)             baseTabs.push({ id:'ga4',         label:'📈 GA4' });
  if (D.ga_conversions && D.ga_conversions.length) baseTabs.push({ id:'conversions', label:'🎯 Conversions' });
  if(D.offline) baseTabs.push({ id:'offline', label:'📰 Offline' });
  baseTabs.push({ id:'budget', label:'💶 Budget' });

  const tabBtns  = baseTabs.map((t,i) => `<button class="tab-btn${i===0?' active':''}" data-tab-id="${t.id}">${t.label}</button>`).join('');
  const tabPanes = baseTabs.map((t,i) => `<div id="pane-${t.id}" class="tab-pane${i===0?' active':''}"></div>`).join('');

  const chCheckboxes = enabledChs.map(k =>
    `<label class="channel-check"><input type="checkbox" checked data-ch="${k}"/>
     <span style="color:${CH[k].color}">● ${CH[k].label}</span></label>`
  ).join('');

  document.head.insertAdjacentHTML('beforeend', accentStyle);
  document.body.innerHTML = `
    <div class="header">
      <div class="header-left">
        <span class="header-logo">${C.logo}</span>
        <div>
          <div class="header-title">${C.clientName} — Campaign Dashboard</div>
          <div class="header-sub">${C.subtitle||''}</div>
        </div>
      </div>
      <div class="header-right">
        <div class="live-indicator">
          <span class="live-dot"></span>
          <span id="liveStatus">Live · ${countRows()} rows · Updated: ${C.lastUpdated||'—'}</span>
        </div>
        <button class="refresh-btn" id="refreshBtn">
          <span class="refresh-icon">↺</span> Refresh
        </button>
      </div>
    </div>
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">Date Range</span>
        <input type="date" class="date-input" id="dateFrom" value="${C.dateStart||''}"/>
        <span style="color:#64748b;font-size:11px">→</span>
        <input type="date" class="date-input" id="dateTo" value="${C.dateEnd||''}"/>
      </div>
      <div class="filter-group" id="presetBtns"></div>
      <div class="divider"></div>
      <div class="filter-group">${chCheckboxes.length ? '<span class="filter-label">Channels</span>'+chCheckboxes+'<button class="ch-all-btn" id="chAllBtn">Deselect all</button>' : ''}</div>
    </div>
    <div class="main">
      <div class="kpi-row">
        <div class="kpi-card active" data-metric="imp">         <div class="kpi-label">Impressions ↗</div>    <div class="kpi-val" id="kpi-imp">0</div>      <div class="kpi-sub" id="kpi-imp-sub">click to focus charts</div></div>
        <div class="kpi-card orange"              data-metric="spend">  <div class="kpi-label">Total Spend ↗</div>    <div class="kpi-val" id="kpi-spend">€0</div>   <div class="kpi-sub" id="kpi-spend-sub">click to focus charts</div></div>
        <div class="kpi-card green"               data-metric="clicks"> <div class="kpi-label">Clicks ↗</div>         <div class="kpi-val" id="kpi-clicks">0</div>   <div class="kpi-sub">click to focus charts</div></div>
        <div class="kpi-card purple"              data-metric="ctr">    <div class="kpi-label">CTR ↗</div>            <div class="kpi-val" id="kpi-ctr">0%</div>     <div class="kpi-sub">click to focus charts</div></div>
        <div class="kpi-card teal"                data-metric="cpm">    <div class="kpi-label">Avg. CPM ↗</div>       <div class="kpi-val" id="kpi-cpm">€0</div>     <div class="kpi-sub">click to focus charts</div></div>
        <div class="kpi-card pink"                data-metric="cpc">    <div class="kpi-label">Avg. CPC ↗</div>       <div class="kpi-val" id="kpi-cpc">€0</div>     <div class="kpi-sub">click to focus charts</div></div>
        <div class="kpi-card red"                 data-metric="budget"> <div class="kpi-label">Budget Used ↗</div>    <div class="kpi-val" id="kpi-budget">0%</div>  <div class="kpi-sub">click to focus charts</div></div>
      </div>
      <div class="chart-row cols-1" style="margin-bottom:14px">
        <div class="chart-card">
          <div class="chart-head">
            <div><div class="chart-title">Daily Performance Trend</div><div class="chart-sub">Hover over chart for details · Select channels and date range</div></div>
            <button class="chart-tag" id="trendToggle" style="border:none">Show Spend</button>
          </div>
          <canvas id="chartTrend" height="85"></canvas>
        </div>
      </div>
      <div class="tab-row">${tabBtns}</div>
      ${tabPanes}
    </div>
    <footer>${C.clientName} Campaign Dashboard · mBuy · ${C.lastUpdated||''}</footer>`;

  // ── event listeners ────────────────────────────────────────
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function(){
      const tabId = this.dataset.tabId;
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      document.getElementById('pane-'+tabId).classList.add('active');
      this.classList.add('active');
      const {from,to}=getF();
      const re={tiktok:()=>renderTikTok(from,to),dpg:()=>renderDPG(from,to),adform:()=>renderAdform(from,to),readpeak:()=>renderReadpeak(from,to),reddit:()=>renderReddit(from,to),dooh:()=>renderDOOH(from,to),google:()=>renderGoogle(from,to),meta:()=>renderMeta(from,to),ga4:()=>renderGA4(from,to),conversions:()=>renderConversions(from,to),budget:()=>renderBudget(),showheroes:()=>renderShowheroes(from,to),adalliance:()=>renderAdAlliance(from,to),talpa:()=>renderTalpa(from,to),vtr:()=>renderVTR(from,to),offline:()=>renderOffline(),pinterest:()=>renderPinterest(from,to),native:()=>renderNative(from,to)};
      if(re[tabId])re[tabId]();
    });
  });

  // KPI cards
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', function(){
      const metric = this.dataset.metric;
      document.querySelectorAll('.kpi-card').forEach(c=>c.classList.remove('active'));
      this.classList.add('active');
      window.selectMetric(metric);
    });
  });

  // Channel checkboxes
  document.querySelectorAll('[data-ch]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      console.log('🔄 Channel checkbox changed:', e.target.dataset.ch, 'Checked:', e.target.checked);
      window.updateDash();
    });
  });

  // Channel "Deselect all" button
  document.getElementById('chAllBtn')?.addEventListener('click', function(){
    window.toggleAllCh();
  });

  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', function(){
    if(window.DASH_REFRESH) window.DASH_REFRESH();
  });

  // Trend toggle
  document.getElementById('trendToggle')?.addEventListener('click', window._toggleTrend);

  // ── preset buttons ────────────────────────────────────────
  const presets = C.datePresets || [
    { label:'All',    from: C.dateStart, to: C.dateEnd },
    { label:'Last 7d',from: offsetDate(C.dateEnd,-6), to: C.dateEnd },
    { label:'Last 3d',from: offsetDate(C.dateEnd,-2), to: C.dateEnd },
  ];
  function offsetDate(base,days){const d=new Date(base+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
  const pb = document.getElementById('presetBtns');
  presets.forEach((p,i) => {
    const b = document.createElement('button');
    b.className = 'preset-btn'+(i===0?' active':'');
    b.textContent = p.label;
    b.dataset.from = p.from;
    b.dataset.to = p.to;
    b.addEventListener('click', function(){
      document.querySelectorAll('.preset-btn').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('dateFrom').value = this.dataset.from;
      document.getElementById('dateTo').value = this.dataset.to;
      window.updateDash();
    });
    pb.appendChild(b);
  });

  // ── refresh button spinner ────────────────────────────────
  window.DASH_REFRESH_START = function(){
    const btn = document.getElementById('refreshBtn');
    if(btn){ btn.classList.add('spinning'); btn.disabled=true; }
  };
  window.DASH_REFRESH_DONE = function(){
    const btn = document.getElementById('refreshBtn');
    if(btn){ btn.classList.remove('spinning'); btn.disabled=false; }
    // Update live status
    const ls = document.getElementById('liveStatus');
    if(ls) ls.textContent = `Live · ${countRows()} rows · Updated: ${C.lastUpdated||'—'}`;
  };

  // ── chart instances ───────────────────────────────────────
  const charts = {};
  let trendMode = 'impressions';
  function dc(id){ if(charts[id]){charts[id].destroy();delete charts[id]} }

  // ── ENHANCED TOOLTIP DEFAULTS ─────────────────────────────
  const tooltipDefaults = {
    backgroundColor: 'rgba(15,23,42,0.95)',
    titleColor: '#ffffff',
    bodyColor: '#94a3b8',
    borderColor: '#334155',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    displayColors: true,
    boxWidth: 10,
    boxHeight: 10,
    usePointStyle: true,
    callbacks: {
      label: function(ctx){
        const v = (ctx.chart.options.indexAxis === 'y' ? ctx.parsed.x : ctx.parsed.y) ?? ctx.parsed;
        const label = ctx.dataset.label || '';
        if(label.includes('€') || label.toLowerCase().includes('spend') || label.toLowerCase().includes('cost') || label.toLowerCase().includes('cpm') || label.toLowerCase().includes('cpc'))
          return ` ${label}: €${(+v).toFixed(2)}`;
        if(label.includes('%') || label.toLowerCase().includes('ctr') || label.toLowerCase().includes('rate'))
          return ` ${label}: ${(+v).toFixed(2)}%`;
        if(v >= 1000000) return ` ${label}: ${(v/1e6).toFixed(2)}M`;
        if(v >= 1000)    return ` ${label}: ${Math.round(v/1000)}K`;
        return ` ${label}: ${(+v).toLocaleString('nl-NL')}`;
      }
    }
  };

  const scaleDefaults = {
    grid:{ color:'#f1f5f9' },
    ticks:{ font:{size:10}, color:'#6b7280' }
  };

  function mc(id,cfg){
    dc(id);
    // Inject tooltip defaults into all datasets
    if(cfg.options && cfg.options.plugins){
      cfg.options.plugins.tooltip = Object.assign({}, tooltipDefaults, cfg.options.plugins.tooltip||{});
    } else if(cfg.options){
      cfg.options.plugins = { tooltip: tooltipDefaults };
    }
    // Add hover animations
    cfg.options = cfg.options || {};
    cfg.options.animation = cfg.options.animation || { duration: 300 };
    cfg.options.hover = { mode:'index', intersect:false };
    charts[id] = new Chart(document.getElementById(id), cfg);
  }

  // ── channel select all / deselect all ────────────────────
  window.toggleAllCh = function(){
    const boxes = document.querySelectorAll('[data-ch]');
    const allChecked = [...boxes].every(b => b.checked);
    boxes.forEach(b => b.checked = !allChecked);
    document.getElementById('chAllBtn').textContent = allChecked ? 'Select all' : 'Deselect all';
    window.updateDash();
  };

  // ── filters ──────────────────────────────────────────────
  function getF(){
    const from=document.getElementById('dateFrom').value, to=document.getElementById('dateTo').value;
    const chs={}; document.querySelectorAll('[data-ch]').forEach(e=>chs[e.dataset.ch]=e.checked);
    return{from,to,chs};
  }

  // ── aggregation ──────────────────────────────────────────
  function aggDaily(rows,f,t){
    return (rows||[]).filter(r=>inR(r.date,f,t))
      .reduce((a,r)=>({imp:a.imp+(r.imp||0),clicks:a.clicks+(r.clicks||0),cost:a.cost+(r.cost||0),conv:a.conv+(r.conv||0)}),{imp:0,clicks:0,cost:0,conv:0});
  }
  function aggList(list,fields){
    return (list||[]).reduce((a,r)=>{fields.forEach(f=>a[f]=(a[f]||0)+(r[f]||0));return a},{});
  }

  function getSummaries(f,t,chs){
    const out=[];
    if(chs.google&&CH.google&&CH.google.enabled){const a=aggDaily(D.google,f,t);if(a.imp||a.cost)out.push({name:CH.google.label,color:CH.google.color,budget:CH.google.budget||0,...a,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.meta&&CH.meta&&CH.meta.enabled){const a=aggDaily(D.meta,f,t),ab=aggDaily(D.meta_boosts||[],f,t);const mc2={imp:a.imp+ab.imp,clicks:a.clicks+ab.clicks,cost:a.cost+ab.cost,conv:0};if(mc2.imp||mc2.cost)out.push({name:CH.meta.label,color:CH.meta.color,budget:CH.meta.budget||0,...mc2,ctr:mc2.imp?mc2.clicks/mc2.imp*100:0,cpm:mc2.imp?mc2.cost/mc2.imp*1000:0})}
    if(chs.tiktok&&CH.tiktok&&CH.tiktok.enabled&&D.tiktok&&inR(D.tiktok.date,f,t)){const a=aggList(D.tiktok.ads,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.tiktok.label,color:CH.tiktok.color,budget:CH.tiktok.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.dpg&&CH.dpg&&CH.dpg.enabled&&D.dpg&&inR(D.dpg.date,f,t)){const a=aggList(D.dpg.formats,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.dpg.label,color:CH.dpg.color,budget:CH.dpg.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.adform&&CH.adform&&CH.adform.enabled&&D.adform&&inR(D.adform.date,f,t)){const a=aggList(D.adform.formats,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.adform.label,color:CH.adform.color,budget:CH.adform.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.dooh&&CH.dooh&&CH.dooh.enabled){const rows=(D.dooh||[]).filter(r=>inR(r.date,f,t));const a=rows.reduce((ac,r)=>({imp:ac.imp+r.imp,cost:ac.cost+r.totalCost}),{imp:0,cost:0});if(a.imp)out.push({name:CH.dooh.label,color:CH.dooh.color,budget:CH.dooh.budget||0,...a,clicks:0,conv:0,ctr:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.reddit&&CH.reddit&&CH.reddit.enabled&&D.reddit&&inR(D.reddit.date,f,t)){const a=aggList(D.reddit.ads,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.reddit.label,color:CH.reddit.color,budget:CH.reddit.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.readpeak&&CH.readpeak&&CH.readpeak.enabled&&D.readpeak&&inR(D.readpeak.date,f,t)){const a=aggList(D.readpeak.ads,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.readpeak.label,color:CH.readpeak.color,budget:CH.readpeak.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.showheroes&&CH.showheroes&&CH.showheroes.enabled&&D.showheroes&&D.showheroes.ads){const a=aggList(D.showheroes.ads,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.showheroes.label,color:CH.showheroes.color,budget:CH.showheroes.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.adalliance&&CH.adalliance&&CH.adalliance.enabled&&D.adalliance&&D.adalliance.publishers){const a=aggList(D.adalliance.publishers,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.adalliance.label,color:CH.adalliance.color,budget:CH.adalliance.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.talpa&&CH.talpa&&CH.talpa.enabled&&D.talpa&&D.talpa.campaigns){const a=aggList(D.talpa.campaigns,['imp','clicks','spend']);a.cost=a.spend;out.push({name:CH.talpa.label,color:CH.talpa.color,budget:CH.talpa.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.pinterest&&CH.pinterest&&CH.pinterest.enabled){const a=aggDaily(D.pinterest,f,t);if(a.imp||a.cost)out.push({name:CH.pinterest.label,color:CH.pinterest.color,budget:CH.pinterest.budget||0,...a,conv:0,ctr:a.imp?a.clicks/a.imp*100:0,cpm:a.imp?a.cost/a.imp*1000:0})}
    if(chs.native&&CH.native&&CH.native.enabled){const pa=D.pacing&&D.pacing.find(function(r){return r.channel==='Native'||r.channel==='native';});if(pa&&pa.spent)out.push({name:CH.native.label,color:CH.native.color,budget:CH.native.budget||0,imp:0,clicks:0,cost:pa.spent,conv:0,ctr:0,cpm:0})}
    return out;
  }

  // ── KPIs ─────────────────────────────────────────────────
  function updateKPIs(s){
    const tI=s.reduce((a,c)=>a+c.imp,0),tCl=s.reduce((a,c)=>a+c.clicks,0),tCo=s.reduce((a,c)=>a+c.cost,0);
    document.getElementById('kpi-spend').textContent    = fmtE(tCo,0);
    document.getElementById('kpi-spend-sub').textContent= `of ${fmtE(C.totalBudget,0)} budget`;
    document.getElementById('kpi-imp').textContent      = fmt(tI);
    document.getElementById('kpi-imp-sub').textContent  = `across ${s.length} channel${s.length!==1?'s':''}`;
    document.getElementById('kpi-clicks').textContent   = fmt(tCl);
    document.getElementById('kpi-ctr').textContent      = fmtP(tI?tCl/tI*100:0);
    document.getElementById('kpi-cpm').textContent      = fmtE(tI?tCo/tI*1000:0);
    document.getElementById('kpi-cpc').textContent      = fmtE(tCl?tCo/tCl:0);
    document.getElementById('kpi-budget').textContent   = fmtP(tCo/C.totalBudget*100);
  }

  // ── TREND ─────────────────────────────────────────────────
  // Toggle button now delegates to selectMetric for consistency
  window._toggleTrend = function(){
    window.selectMetric(activeMetric==='spend'?'imp':'spend');
  };

  function renderTrend(f,t,chs){
    const m=METRICS[activeMetric]||METRICS['imp'];

    // ── Build weekly (Mon-Sun) buckets from dates in range ────────────
    const allDates=datesInR(f,t);
    const wks=[];
    allDates.forEach(function(d){
      const dow=new Date(d+'T00:00:00Z').getUTCDay(); // 0=Sun,1=Mon
      if(!wks.length||dow===1) wks.push({lbl:d.slice(5),dates:[d]});
      else wks[wks.length-1].dates.push(d);
    });
    const wkLabels=wks.map(function(w){return w.lbl;});
    const nWks=wks.length||1;

    // ── Compute metric value from weekly raw totals ───────────────────
    function metricVal(wI,wCl,wCo,budget){
      switch(activeMetric){
        case 'spend':  return wCo;
        case 'clicks': return wCl;
        case 'ctr':    return wI?wCl/wI*100:0;
        case 'cpm':    return wI?wCo/wI*1000:0;
        case 'cpc':    return wCl?wCo/wCl:0;
        case 'budget': return budget?wCo/budget*100:0;
        default:       return wI;
      }
    }

    const datasets=[];

    // Push a dataset if it has at least one non-null value
    function pushLine(key,vals,dashed){
      if(!vals.some(function(v){return v!==null&&v>0;})) return;
      const ds={label:CH[key].label,data:vals,
        borderColor:CH[key].color,backgroundColor:CH[key].color+'22',
        borderWidth:2.5,pointRadius:4,pointHoverRadius:7,
        tension:.35,fill:false,spanGaps:true};
      if(dashed) ds.borderDash=[5,3];
      datasets.push(ds);
    }

    // ── Daily channel: accumulate raw per week then compute metric ────
    function addDailyLine(key,daily){
      if(!CH[key]||!CH[key].enabled||!chs[key]) return;
      if(!daily||!daily.length) return;
      const dm={};
      daily.forEach(function(r){dm[r.date]=r;});
      const budget=CH[key].budget||0;
      const vals=wks.map(function(wk){
        var wI=0,wCl=0,wCo=0,hasData=false;
        wk.dates.forEach(function(d){
          const r=dm[d];
          if(r){hasData=true;wI+=r.imp||0;wCl+=r.clicks||0;wCo+=r.cost||0;}
        });
        return hasData?metricVal(wI,wCl,wCo,budget):null;
      });
      pushLine(key,vals,false);
    }

    // ── DOOH: date+totalCost+imp ──────────────────────────────────────
    function addDoohLine(){
      if(!CH.dooh||!CH.dooh.enabled||!chs.dooh) return;
      const dooh=D.dooh||[];
      const budget=CH.dooh.budget||0;
      const vals=wks.map(function(wk){
        var wI=0,wCo=0,hasData=false;
        wk.dates.forEach(function(d){
          dooh.filter(function(r){return r.date===d;}).forEach(function(r){
            hasData=true;wI+=r.imp||0;wCo+=r.totalCost||0;
          });
        });
        return hasData?metricVal(wI,0,wCo,budget):null;
      });
      pushLine('dooh',vals,false);
    }

    // ── Snapshot channel: campaign total spread evenly across weeks ───
    // Ratio metrics (CPM/CTR/CPC) use campaign-level ratio (same each week)
    // Absolute metrics (spend/clicks/imp) divide total by nWks
    function addSnapshotLine(key,getTotals){
      if(!CH[key]||!CH[key].enabled||!chs[key]) return;
      const snap=getTotals();
      if(!snap) return;
      const {tI,tCl,tCo}=snap;
      const budget=CH[key].budget||0;
      // Respect channel's actual flight period (dateStart / date from DASH_DATA)
      const chStart=(D[key]&&D[key].dateStart)||'2026-03-19';
      const chEnd  =(D[key]&&D[key].date)||'2026-05-03';
      // Which weeks overlap with this channel's flight?
      const activeWks=wks.filter(function(wk){
        const wkFirst=wk.dates[0];
        const wkLast =wk.dates[wk.dates.length-1];
        return wkFirst<=chEnd && wkLast>=chStart;
      });
      const nActive=activeWks.length||1;
      const isRatio=(activeMetric==='ctr'||activeMetric==='cpm'||activeMetric==='cpc');
      const vals=wks.map(function(wk){
        const wkFirst=wk.dates[0];
        const wkLast =wk.dates[wk.dates.length-1];
        const active=wkFirst<=chEnd && wkLast>=chStart;
        if(!active) return null;
        if(isRatio) return metricVal(tI,tCl,tCo,budget);
        return metricVal(tI/nActive,tCl/nActive,tCo/nActive,budget);
      });
      pushLine(key,vals,true); // dashed = snapshot
    }

    function adsTotal(ads){
      if(!ads||!ads.length) return null;
      return {tI:ads.reduce(function(s,r){return s+(r.imp||0);},0),
              tCl:ads.reduce(function(s,r){return s+(r.clicks||0);},0),
              tCo:ads.reduce(function(s,r){return s+(r.spend||r.cost||0);},0)};
    }
    function formatsTotal(fmts){
      if(!fmts||!fmts.length) return null;
      return {tI:fmts.reduce(function(s,r){return s+(r.imp||0);},0),
              tCl:fmts.reduce(function(s,r){return s+(r.clicks||0);},0),
              tCo:fmts.reduce(function(s,r){return s+(r.spend||r.cost||0);},0)};
    }

    // ── Google ────────────────────────────────────────────────────────
    addDailyLine('google', D.google);

    // ── Meta: always-on + post boosts combined ────────────────────────
    if(CH.meta&&CH.meta.enabled&&chs.meta){
      const dm={};
      (D.meta||[]).forEach(function(r){dm[r.date]={imp:r.imp||0,clicks:r.clicks||0,cost:r.cost||0};});
      (D.meta_boosts||[]).forEach(function(r){
        if(dm[r.date]){dm[r.date].imp+=(r.imp||0);dm[r.date].clicks+=(r.clicks||0);dm[r.date].cost+=(r.cost||0);}
        else{dm[r.date]={imp:r.imp||0,clicks:r.clicks||0,cost:r.cost||0};}
      });
      const budget=CH.meta.budget||0;
      const vals=wks.map(function(wk){
        var wI=0,wCl=0,wCo=0,hasData=false;
        wk.dates.forEach(function(d){
          const r=dm[d];
          if(r){hasData=true;wI+=r.imp;wCl+=r.clicks;wCo+=r.cost;}
        });
        return hasData?metricVal(wI,wCl,wCo,budget):null;
      });
      pushLine('meta',vals,false);
    }

    // ── DOOH ──────────────────────────────────────────────────────────
    addDoohLine();

    // ── TikTok (has daily array) ──────────────────────────────────────
    if(D.tiktok&&D.tiktok.daily) addDailyLine('tiktok', D.tiktok.daily);

    // ── Snapshot channels (dashed line = campaign avg per week) ───────
    // Use daily arrays for proper weekly variation (not flat snapshot averages)
    if(D.dpg&&D.dpg.daily)           addDailyLine('dpg',      D.dpg.daily);
    if(D.adform&&D.adform.daily)     addDailyLine('adform',   D.adform.daily);
    if(D.reddit&&D.reddit.daily)     addDailyLine('reddit',   D.reddit.daily);
    if(D.readpeak&&D.readpeak.daily) addDailyLine('readpeak', D.readpeak.daily);

    // ── Channels with daily arrays ────────────────────────────────────
    if(D.showheroes&&D.showheroes.daily) addDailyLine('showheroes', D.showheroes.daily);
    if(D.adalliance&&D.adalliance.daily) addDailyLine('adalliance', D.adalliance.daily);
    if(D.talpa&&D.talpa.daily)           addDailyLine('talpa',      D.talpa.daily);
    addDailyLine('pinterest', D.pinterest);

    // ── Title & toggle button ─────────────────────────────────────────
    const trendTitle=document.querySelector('#chartTrend')?.closest('.chart-card')?.querySelector('.chart-title');
    if(trendTitle) trendTitle.textContent=`Weekly ${m.label} Trend`;
    const toggleBtn=document.getElementById('trendToggle');
    if(toggleBtn) toggleBtn.textContent=activeMetric==='spend'?'Show Impressions':'Show Spend';

    // ── Y-axis formatter per metric ───────────────────────────────────
    let yFmt;
    if     (activeMetric==='spend')   yFmt=function(v){return '€'+(v>=1000?Math.round(v/1000)+'K':Math.round(v));};
    else if(activeMetric==='cpm')     yFmt=function(v){return '€'+v.toFixed(2);};
    else if(activeMetric==='cpc')     yFmt=function(v){return '€'+v.toFixed(2);};
    else if(activeMetric==='ctr')     yFmt=function(v){return v.toFixed(1)+'%';};
    else if(activeMetric==='budget')  yFmt=function(v){return v.toFixed(1)+'%';};
    else if(activeMetric==='clicks')  yFmt=function(v){return v>=1000?Math.round(v/1000)+'K':Math.round(v)+'';};
    else yFmt=function(v){return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?Math.round(v/1000)+'K':Math.round(v)+'';};

    mc('chartTrend',{
      type:'line',
      data:{labels:wkLabels,datasets},
      options:{
        responsive:true,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},usePointStyle:true}},
          tooltip:{
            ...tooltipDefaults,
            filter:function(item){return item.raw!=null;},
            callbacks:{
              title:function(ctx){return '📅 Week of '+ctx[0].label;},
              label:function(ctx){
                if(ctx.raw==null) return null;
                const v=ctx.parsed.y; if(v==null) return null;
                return ' '+ctx.dataset.label+': '+m.fmt(v);
              }
            }
          }
        },
        scales:{
          x:{...scaleDefaults,grid:{color:'#f1f5f9'}},
          y:{...scaleDefaults,grid:{color:'#f1f5f9'},ticks:{...scaleDefaults.ticks,callback:yFmt}}
        }
      }
    });
  }

  // ── SELECT METRIC (KPI card click) ────────────────────────
  function updateOverviewBar(s){
    const m=METRICS[activeMetric]||METRICS['imp'];
    const chart=charts['chartImpBar'];
    if(!chart) return;
    let data,label,tickFmt;
    if(activeMetric==='spend'){      data=s.map(x=>x.cost);                                    label='Spend (€)';    tickFmt=v=>'€'+(v>=1000?Math.round(v/1000)+'K':v);}
    else if(activeMetric==='clicks'){data=s.map(x=>x.clicks);                                  label='Clicks';       tickFmt=v=>v>=1000?Math.round(v/1000)+'K':v;}
    else if(activeMetric==='ctr'){   data=s.map(x=>+x.ctr.toFixed(2));                         label='CTR %';        tickFmt=v=>v+'%';}
    else if(activeMetric==='cpm'){   data=s.map(x=>+x.cpm.toFixed(2));                         label='CPM €';        tickFmt=v=>'€'+v;}
    else if(activeMetric==='cpc'){   data=s.map(x=>x.clicks?+(x.cost/x.clicks).toFixed(2):0); label='CPC €';        tickFmt=v=>'€'+v;}
    else if(activeMetric==='budget'){data=s.map(x=>x.budget?+(x.cost/x.budget*100).toFixed(1):0);label='Budget Used %';tickFmt=v=>v+'%';}
    else{                            data=s.map(x=>x.imp);                                     label='Impressions';  tickFmt=v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?Math.round(v/1000)+'K':v;}
    chart.data.datasets[0].data=data;
    chart.data.datasets[0].label=label;
    chart.options.scales.x.ticks.callback=tickFmt;
    chart.options.plugins.tooltip.callbacks.label=ctx=>{const v=ctx.parsed.x;return ` ${label}: ${tickFmt(v)}`};
    const titleEl=document.querySelector('#chartImpBar')?.closest('.chart-card')?.querySelector('.chart-title');
    if(titleEl) titleEl.textContent=`${m.label} by Channel`;
    chart.update();
  }

  window.selectMetric=function(metric){
    if(!METRICS[metric]) return;
    activeMetric=metric;
    // Highlight active KPI card
    document.querySelectorAll('.kpi-card[data-metric]').forEach(c=>c.classList.remove('active'));
    const ac=document.querySelector(`.kpi-card[data-metric="${metric}"]`);
    if(ac) ac.classList.add('active');
    // Re-render trend + overview bar with new metric
    const{from,to,chs}=getF();
    renderTrend(from,to,chs);
    updateOverviewBar(getSummaries(from,to,chs));
  };

  // ── OVERVIEW ──────────────────────────────────────────────
  function renderOverview(s){
    if(!document.getElementById('pane-overview')) return;
    if(!s || s.length===0){
      document.getElementById('pane-overview').innerHTML='<div style="padding:40px;text-align:center;color:#999">Select at least one channel to view data</div>';
      return;
    }
    document.getElementById('pane-overview').innerHTML=`
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Channel Performance Summary</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Channel</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th><th class="num">Budget</th><th>Pacing</th></tr></thead>
          <tbody id="overviewTable"></tbody>
        </table></div>
      </div>
      <div class="chart-row cols-21">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Channel</div><div class="chart-sub">Hover for exact values</div></div></div><canvas id="chartImpBar" height="160"></canvas></div>
        <div class="chart-card donut-sm"><div class="chart-head"><div><div class="chart-title">Spend by Channel</div></div></div><div class="donut-wrap"><canvas id="chartSpendDonut"></canvas></div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR by Channel</div><div class="chart-sub">Hover for exact values</div></div></div><canvas id="chartCTR" height="160"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CPM Comparison</div><div class="chart-sub">Cost per 1,000 impressions</div></div></div><canvas id="chartCPM" height="160"></canvas></div>
      </div>`;

    const hBarTooltip={callbacks:{label:ctx=>{const v=ctx.parsed.x;if(v>=1e6)return ` ${ctx.dataset.label}: ${(v/1e6).toFixed(2)}M`;if(v>=1000)return ` ${ctx.dataset.label}: ${Math.round(v/1000)}K`;return ` ${ctx.dataset.label}: ${v.toLocaleString('nl-NL')}`}}};
    // Ensure old chart instances are destroyed before creating new ones
    dc('chartImpBar');
    dc('chartSpendDonut');
    dc('chartCTR');
    dc('chartCPM');
    mc('chartImpBar',{type:'bar',data:{labels:s.map(x=>x.name),datasets:[{label:'Impressions',data:s.map(x=>x.imp),backgroundColor:s.map(x=>x.color+'cc'),hoverBackgroundColor:s.map(x=>x.color),borderRadius:4}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false},tooltip:hBarTooltip},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?Math.round(v/1000)+'K':v}},y:{ticks:{font:{size:11}}}}}});
    mc('chartSpendDonut',{type:'doughnut',data:{labels:s.map(x=>x.name),datasets:[{data:s.map(x=>x.cost),backgroundColor:s.map(x=>x.color),hoverOffset:6}]},options:{maintainAspectRatio:true,cutout:'62%',plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,usePointStyle:true,padding:6}}}}});
    mc('chartCTR',{type:'bar',data:{labels:s.map(x=>x.name),datasets:[{label:'CTR %',data:s.map(x=>+x.ctr.toFixed(2)),backgroundColor:s.map(x=>x.color+'cc'),hoverBackgroundColor:s.map(x=>x.color),borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},x:{ticks:{font:{size:10}}}}}});
    mc('chartCPM',{type:'bar',data:{labels:s.map(x=>x.name),datasets:[{label:'CPM €',data:s.map(x=>+x.cpm.toFixed(2)),backgroundColor:s.map(x=>x.color+'cc'),hoverBackgroundColor:s.map(x=>x.color),borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>'€'+v}},x:{ticks:{font:{size:10}}}}}});

    const tb=document.getElementById('overviewTable');tb.innerHTML='';
    let tI=0,tCl=0,tCo=0,_h='';
    s.forEach(x=>{tI+=x.imp;tCl+=x.clicks;tCo+=x.cost;const p=x.budget?x.cost/x.budget*100:0;
      _h+=`<tr><td><span class="ch-dot" style="background:${x.color}"></span>${x.name}</td><td class="num">${fmt(x.imp)}</td><td class="num">${fmt(x.clicks)}</td><td class="num"><span class="badge ${x.ctr>1?'b-green':x.ctr>0.3?'b-blue':'b-grey'}">${fmtP(x.ctr)}</span></td><td class="num">${fmtE(x.cpm)}</td><td class="num">${fmtE(x.clicks?x.cost/x.clicks:0)}</td><td class="num">${fmtE(x.cost)}</td><td class="num">${fmtE(x.budget,0)}</td><td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill${p>80?' over':p>50?' warn':''}" style="width:${Math.min(p,100)}%"></div></div><span class="prog-txt">${p.toFixed(1)}%</span></div></td></tr>`;
    });
    tb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tCo/tI*1000:0)}</td><td class="num">${fmtE(tCl?tCo/tCl:0)}</td><td class="num">${fmtE(tCo)}</td><td class="num">${fmtE(C.totalBudget,0)}</td><td><span class="prog-txt">${(tCo/C.totalBudget*100).toFixed(2)}%</span></td></tr>`;
  }

  // ── GOOGLE ────────────────────────────────────────────────
  function renderGoogle(f,t){
    if(!CH.google||!CH.google.enabled) return;
    const pane=document.getElementById('pane-google');if(!pane)return;

    // Filter weekly data to the selected date range (include week if any day falls in [f,t])
    const wdata=(D.google_weekly||[]).filter(function(w){
      const wStart=w.week;
      const wEnd=new Date(w.week+'T00:00:00Z');
      wEnd.setUTCDate(wEnd.getUTCDate()+6);
      const wEndStr=wEnd.toISOString().slice(0,10);
      return wStart<=t&&wEndStr>=f;
    });
    const tI=wdata.reduce(function(s,w){return s+w.imp;},0);
    const tCl=wdata.reduce(function(s,w){return s+w.clicks;},0);
    const tCv=wdata.reduce(function(s,w){return s+(w.conv||0);},0);
    const tCo=wdata.reduce(function(s,w){return s+w.cost;},0);

    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card green"><div class="kpi-label">Conversions</div><div class="kpi-val">${fmt(tCv)}</div></div><div class="kpi-card purple"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card teal"><div class="kpi-label">Avg CPC</div><div class="kpi-val">${fmtE(tCl?tCo/tCl:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Weekly Clicks & Conversions</div><div class="chart-sub">Hover for weekly detail</div></div></div><canvas id="chartGoogleClicks" height="170"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Weekly Spend & Impressions</div></div></div><canvas id="chartGoogleSpend" height="170"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">Google Weekly Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Week</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Conversions</th><th class="num">Conv. Rate</th><th class="num">CPC</th><th class="num">Spend</th></tr></thead><tbody id="googleTable"></tbody></table></div></div>`;

    const lb=wdata.map(function(w){return w.week.slice(5)+(w.days<7?' ('+w.days+'d)':'');});
    mc('chartGoogleClicks',{type:'bar',data:{labels:lb,datasets:[
      {label:'Clicks',data:wdata.map(function(w){return w.clicks;}),backgroundColor:CH.google.color+'bb',hoverBackgroundColor:CH.google.color,borderRadius:3,yAxisID:'y'},
      {label:'Conversions',data:wdata.map(function(w){return w.conv||0;}),type:'line',borderColor:'#e53e3e',backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,pointHoverRadius:7,tension:.35,yAxisID:'y1'}
    ]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    mc('chartGoogleSpend',{type:'bar',data:{labels:lb,datasets:[
      {label:'Spend (€)',data:wdata.map(function(w){return w.cost;}),backgroundColor:'#bee3f8',hoverBackgroundColor:'#90cdf4',borderRadius:3,yAxisID:'y'},
      {label:'Impressions',data:wdata.map(function(w){return w.imp;}),type:'line',borderColor:CH.google.color,backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,pointHoverRadius:7,tension:.35,yAxisID:'y1'}
    ]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return '€'+(v>=1000?Math.round(v/1000)+'K':v);}}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;},font:{size:10}}},x:{ticks:{font:{size:10}}}}}});

    const tb=document.getElementById('googleTable');let _h='';
    wdata.forEach(function(w){
      const ctr=w.imp?w.clicks/w.imp*100:0,cvr=w.clicks?(w.conv||0)/w.clicks*100:0,cpc=w.clicks?w.cost/w.clicks:0;
      const lbl=w.week+(w.days<7?' ('+w.days+'d)':'');
      _h+=`<tr><td>${lbl}</td><td class="num">${fmt(w.imp)}</td><td class="num">${fmt(w.clicks)}</td><td class="num">${fmtP(ctr)}</td><td class="num">${fmt(w.conv||0)}</td><td class="num">${fmtP(cvr)}</td><td class="num">${fmtE(cpc)}</td><td class="num">${fmtE(w.cost)}</td></tr>`;
    });
    tb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmt(tCv)}</td><td class="num">${fmtP(tCl?tCv/tCl*100:0)}</td><td class="num">${fmtE(tCl?tCo/tCl:0)}</td><td class="num">${fmtE(tCo)}</td></tr>`;
  }

  // ── META ──────────────────────────────────────────────────
  function renderMeta(f,t){
    if(!CH.meta||!CH.meta.enabled) return;
    const pane=document.getElementById('pane-meta');if(!pane)return;

    // Sub-tab renderer helper
    function metaSubPane(rows,suffix,showObj){
      const tI=rows.reduce((s,r)=>s+r.imp,0),tCl=rows.reduce((s,r)=>s+r.clicks,0),tR=rows.reduce((s,r)=>s+(r.reach||0),0),tCo=rows.reduce((s,r)=>s+r.cost,0);
      document.getElementById('metaKPI'+suffix).innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card green"><div class="kpi-label">Reach</div><div class="kpi-val">${fmt(tR)}</div></div><div class="kpi-card purple"><div class="kpi-label">Spend</div><div class="kpi-val">${fmtE(tCo)}</div></div><div class="kpi-card teal"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card pink"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tCo/tI*1000:0)}</div></div></div>`;
      const lb=rows.map(r=>r.date.slice(5));
      mc('chartMetaDaily'+suffix,{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:rows.map(r=>r.imp),backgroundColor:CH.meta.color+'bb',hoverBackgroundColor:CH.meta.color,borderRadius:3,yAxisID:'y'},{label:'Spend (€)',data:rows.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,pointHoverRadius:7,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
      if(showObj){
        const objData=D.meta_objectives||{labels:['Awareness','Consideration','Conversion'],data:[40,35,25]};
        mc('chartMetaObj'+suffix,{type:'doughnut',data:{labels:objData.labels,datasets:[{data:objData.data,backgroundColor:['#3182ce','#48bb78','#e53e3e','#ed8936'],hoverOffset:8}]},options:{cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,usePointStyle:true,padding:16,maxWidth:9999}}},layout:{padding:{top:8}}}});
      } else if(D.meta_boosts_formats&&D.meta_boosts_formats.length){
        const fmts=D.meta_boosts_formats;
        mc('chartMetaFormats'+suffix,{type:'doughnut',data:{labels:fmts.map(f=>f.type),datasets:[{data:fmts.map(f=>f.imp),backgroundColor:['#0081FB','#90CDF4','#48bb78','#ed8936'],hoverOffset:8}]},options:{cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,usePointStyle:true,padding:16,maxWidth:9999}},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed;const total=fmts.reduce((a,f)=>a+f.imp,0);return ` ${ctx.label}: ${fmt(v)} (${(v/total*100).toFixed(1)}%)`}}}},layout:{padding:{top:8}}}});
      }
      const tb=document.getElementById('metaTable'+suffix);tb.innerHTML='';
      if(!rows.length){tb.innerHTML='<tr><td colspan="7" class="no-data">No data in selected range</td></tr>';return}
      let _h='';rows.forEach(r=>{_h+=`<tr><td>${r.date}</td><td class="num">${fmt(r.imp)}</td><td class="num">${fmt(r.reach||0)}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmtP(r.imp?r.clicks/r.imp*100:0)}</td><td class="num">${fmtE(r.imp?r.cost/r.imp*1000:0)}</td><td class="num">${fmtE(r.cost)}</td></tr>`});
      tb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tR)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tCo/tI*1000:0)}</td><td class="num">${fmtE(tCo)}</td></tr>`;
    }

    function metaSubHtml(suffix,showObj){
      const rightChart=showObj
        ?`<div class="chart-card" style="display:flex;flex-direction:column;justify-content:center"><div class="chart-head"><div><div class="chart-title">Objective Split</div></div></div><div style="max-width:320px;margin:0 auto;width:100%"><canvas id="chartMetaObj${suffix}" height="280"></canvas></div></div>`
        :`<div class="chart-card" style="display:flex;flex-direction:column;justify-content:center"><div class="chart-head"><div><div class="chart-title">Video vs. Static</div><div class="chart-sub">Impressions by creative format</div></div></div><div style="max-width:320px;margin:0 auto;width:100%"><canvas id="chartMetaFormats${suffix}" height="280"></canvas></div></div>`;
      return `<div id="metaKPI${suffix}"></div><div class="chart-row cols-2"><div class="chart-card" style="display:flex;flex-direction:column;justify-content:center"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div><div class="chart-sub">Hover for daily detail</div></div></div><canvas id="chartMetaDaily${suffix}" height="210"></canvas></div>${rightChart}</div><div class="chart-card"><div class="chart-head"><div class="chart-title">Daily Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Impressions</th><th class="num">Reach</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">Spend</th></tr></thead><tbody id="metaTable${suffix}"></tbody></table></div></div>`;
    }

    const hasBoosts=D.meta_boosts&&D.meta_boosts.length>0;
    const hasCreatives=D.meta_creatives&&D.meta_creatives.length>0;
    const creativesHtml=hasCreatives?`
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Creatives</div><div class="kpi-val">${D.meta_creatives.length}</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(D.meta_creatives.reduce(function(s,r){return s+r.spend;},0))}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Total Impressions</div><div class="kpi-val">${fmt(D.meta_creatives.reduce(function(s,r){return s+r.imp;},0))}</div></div>
        <div class="kpi-card purple"><div class="kpi-label">Total Clicks</div><div class="kpi-val">${fmt(D.meta_creatives.reduce(function(s,r){return s+r.clicks;},0))}</div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CPC & CPM per Creative</div><div class="chart-sub">Kosten per klik en per 1000 vertoningen</div></div></div><canvas id="chartMetaCPM" height="220"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR per Creative</div><div class="chart-sub">Klikratio per advertentie</div></div></div><canvas id="chartMetaCTR" height="220"></canvas></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Spend per Creative</div><div class="chart-sub">Budget verdeling</div></div></div><canvas id="chartMetaCreativeSpend" height="220"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions per Creative</div></div></div><canvas id="chartMetaCreativeImp" height="220"></canvas></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Meta Creatives Breakdown</div></div>
        <div class="table-wrap"><table><thead><tr><th>Creative</th><th>Type</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th></tr></thead><tbody id="metaCreativeTable"></tbody></table></div>
      </div>`:'<div class="chart-card"><p class="no-data">No creative data available</p></div>';

    pane.innerHTML=`
      <div class="sub-tab-bar">
        <button class="sub-tab-btn active" id="mst-always" data-subtab-id="always">Always On</button>
        <button class="sub-tab-btn" id="mst-boosts" data-subtab-id="boosts">Post Boosts</button>
        <button class="sub-tab-btn" id="mst-creatives" data-subtab-id="creatives">📊 Creatives</button>
      </div>
      <div id="msp-always">${metaSubHtml('A',true)}</div>
      <div id="msp-boosts" style="display:none">${metaSubHtml('B',false)}</div>
      <div id="msp-creatives" style="display:none">${creativesHtml}</div>`;

    window.metaSubTab=function(id,btn){
      document.querySelectorAll('#pane-meta .sub-tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('msp-always').style.display=id==='always'?'':'none';
      document.getElementById('msp-boosts').style.display=id==='boosts'?'':'none';
      document.getElementById('msp-creatives').style.display=id==='creatives'?'':'none';
      const{from,to}=getF();
      if(id==='always') metaSubPane((D.meta||[]).filter(r=>inR(r.date,from,to)),'A',true);
      else if(id==='boosts') metaSubPane((D.meta_boosts||[]).filter(r=>inR(r.date,from,to)),'B',false);
      else if(id==='creatives'&&hasCreatives) renderMetaCreatives();
    };

    function renderMetaCreatives(){
      const crvs=D.meta_creatives;
      const videoColor='#0081FB', staticColor='#48bb78';
      const bgColors=crvs.map(function(c){return c.type==='Video'?videoColor+'bb':staticColor+'bb';});
      const hoverColors=crvs.map(function(c){return c.type==='Video'?videoColor:staticColor;});
      const cNames=crvs.map(function(c){return c.name;});
      mc('chartMetaCPM',{type:'bar',data:{labels:cNames,datasets:[{label:'CPC (€)',data:crvs.map(function(c){return c.cpc||0;}),backgroundColor:bgColors,hoverBackgroundColor:hoverColors,borderRadius:4,yAxisID:'y'},{label:'CPM (€)',data:crvs.map(function(c){return c.cpm||0;}),type:'line',borderColor:'#e53e3e',backgroundColor:'transparent',borderWidth:2.5,pointRadius:5,pointHoverRadius:8,yAxisID:'y'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v.toFixed(2);}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      mc('chartMetaCTR',{type:'bar',data:{labels:cNames,datasets:[{label:'CTR (%)',data:crvs.map(function(c){return c.ctr||0;}),backgroundColor:bgColors,hoverBackgroundColor:hoverColors,borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return' CTR: '+ctx.parsed.y.toFixed(2)+'%';}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v.toFixed(2)+'%';}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      mc('chartMetaCreativeSpend',{type:'bar',data:{labels:cNames,datasets:[{label:'Spend (€)',data:crvs.map(function(c){return c.spend||0;}),backgroundColor:bgColors,hoverBackgroundColor:hoverColors,borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v;}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      mc('chartMetaCreativeImp',{type:'bar',data:{labels:cNames,datasets:[{label:'Impressions',data:crvs.map(function(c){return c.imp||0;}),backgroundColor:bgColors,hoverBackgroundColor:hoverColors,borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      const tb=document.getElementById('metaCreativeTable');
      const totI=crvs.reduce(function(s,r){return s+r.imp;},0);
      const totCl=crvs.reduce(function(s,r){return s+r.clicks;},0);
      const totSp=crvs.reduce(function(s,r){return s+r.spend;},0);
      let _h='';crvs.forEach(function(c){_h+=`<tr><td>${c.name}</td><td>${c.type}</td><td class="num">${fmt(c.imp)}</td><td class="num">${fmt(c.clicks)}</td><td class="num">${fmtP(c.ctr)}</td><td class="num">${fmtE(c.cpm)}</td><td class="num">${fmtE(c.cpc)}</td><td class="num">${fmtE(c.spend)}</td></tr>`;});
      tb.innerHTML=_h+`<tr class="total-row"><td colspan="2">TOTAAL</td><td class="num">${fmt(totI)}</td><td class="num">${fmt(totCl)}</td><td class="num">${fmtP(totI?totCl/totI*100:0)}</td><td class="num">${fmtE(totI?totSp/totI*1000:0)}</td><td class="num">${fmtE(totCl?totSp/totCl:0)}</td><td class="num">${fmtE(totSp)}</td></tr>`;
    }

    // Add Meta sub-tab event listeners
    document.querySelectorAll('#pane-meta [data-subtab-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        window.metaSubTab(this.dataset.subtabId, this);
      });
    });

    metaSubPane((D.meta||[]).filter(r=>inR(r.date,f,t)),'A',true);
  }

  // ── GA4 ───────────────────────────────────────────────────
  function renderGA4(f,t){
    const pane=document.getElementById('pane-ga4');if(!pane)return;
    const rows=(D.ga4||[]).filter(r=>inR(r.date,f,t));
    const tSe=rows.reduce((s,r)=>s+r.sessions,0);
    const tUs=rows.reduce((s,r)=>s+r.users,0);
    const tNu=rows.reduce((s,r)=>s+r.newUsers,0);
    const tRv=rows.reduce((s,r)=>s+r.revenue,0);
    const tPu=rows.reduce((s,r)=>s+r.purchases,0);
    const tAt=rows.reduce((s,r)=>s+r.addToCart,0);
    const tCh=rows.reduce((s,r)=>s+r.checkouts,0);
    const avgBnc=rows.length?rows.reduce((s,r)=>s+r.bounceRate,0)/rows.length:0;
    const avgSec=rows.length?rows.reduce((s,r)=>s+r.avgSessionSec,0)/rows.length:0;
    const fmtDur=sec=>{const m=Math.floor(sec/60),s=Math.round(sec%60);return`${m}m ${s}s`};
    pane.innerHTML=`
      <div class="kpi-row" style="margin-bottom:14px">
        <div class="kpi-card"><div class="kpi-label">Sessions</div><div class="kpi-val">${fmt(tSe)}</div><div class="kpi-sub">in selected period</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Active Users</div><div class="kpi-val">${fmt(tUs)}</div><div class="kpi-sub">${fmt(tNu)} new users</div></div>
        <div class="kpi-card green"><div class="kpi-label">Revenue</div><div class="kpi-val">${fmtE(tRv)}</div><div class="kpi-sub">${fmt(tPu)} purchases</div></div>
        <div class="kpi-card purple"><div class="kpi-label">Add-to-carts</div><div class="kpi-val">${fmt(tAt)}</div><div class="kpi-sub">${fmt(tCh)} reached checkout</div></div>
        <div class="kpi-card teal"><div class="kpi-label">Avg Session</div><div class="kpi-val">${fmtDur(avgSec)}</div><div class="kpi-sub">avg duration</div></div>
        <div class="kpi-card red"><div class="kpi-label">Bounce Rate</div><div class="kpi-val">${fmtP(avgBnc)}</div><div class="kpi-sub">avg in period</div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Sessions & Engaged Sessions</div><div class="chart-sub">Daily website traffic</div></div></div><canvas id="chartGA4Sessions" height="170"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Revenue & Purchases</div><div class="chart-sub">Daily e-commerce performance</div></div></div><canvas id="chartGA4Revenue" height="170"></canvas></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">E-commerce Funnel</div><div class="chart-sub">Add-to-cart → Checkout → Purchase</div></div></div><canvas id="chartGA4Funnel" height="170"></canvas></div>
        <div class="chart-card donut-sm"><div class="chart-head"><div><div class="chart-title">New vs Returning Users</div></div></div><div class="donut-wrap"><canvas id="chartGA4Users"></canvas></div></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">GA4 Daily Breakdown</div></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Sessions</th><th class="num">Users</th><th class="num">New Users</th><th class="num">Bounce Rate</th><th class="num">Add-to-cart</th><th class="num">Checkouts</th><th class="num">Purchases</th><th class="num">Revenue</th></tr></thead><tbody id="ga4Table"></tbody></table></div>
      </div>`;
    const lb=rows.map(r=>r.date.slice(5));
    mc('chartGA4Sessions',{type:'line',data:{labels:lb,datasets:[{label:'Sessions',data:rows.map(r=>r.sessions),borderColor:'#3182ce',backgroundColor:'#3182ce18',borderWidth:2.5,fill:true,tension:.35,pointRadius:3,pointHoverRadius:6},{label:'Engaged Sessions',data:rows.map(r=>r.engaged),borderColor:'#48bb78',backgroundColor:'transparent',borderWidth:2.5,fill:false,tension:.35,pointRadius:3,pointHoverRadius:6}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:10}}}}}});
    mc('chartGA4Revenue',{type:'bar',data:{labels:lb,datasets:[{label:'Revenue (€)',data:rows.map(r=>r.revenue),backgroundColor:'#48bb7888',hoverBackgroundColor:'#48bb78',borderRadius:3,yAxisID:'y'},{label:'Purchases',data:rows.map(r=>r.purchases),type:'line',borderColor:'#e53e3e',backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,pointHoverRadius:7,tension:.35,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>'€'+v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    mc('chartGA4Funnel',{type:'bar',data:{labels:['Add-to-cart','Checkout','Purchase'],datasets:[{label:'Users',data:[tAt,tCh,tPu],backgroundColor:['#3182ce99','#48bb7899','#9f7aea99'],hoverBackgroundColor:['#3182ce','#48bb78','#9f7aea'],borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.x;return` Users: ${v>=1000?Math.round(v/1000)+'K':v.toLocaleString('nl-NL')}`}}}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y:{ticks:{font:{size:12}}}}}});
    const returning=Math.max(0,tUs-tNu);
    mc('chartGA4Users',{type:'doughnut',data:{labels:['New Users','Returning Users'],datasets:[{data:[tNu,returning],backgroundColor:['#3182ce','#48bb78'],hoverOffset:8}]},options:{maintainAspectRatio:true,cutout:'60%',plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true,padding:8}}}}});
    const tb=document.getElementById('ga4Table');tb.innerHTML='';
    if(!rows.length){tb.innerHTML='<tr><td colspan="9" class="no-data">No GA4 data in selected range</td></tr>';return}
    let totSe=0,totUs=0,totNu=0,totAt=0,totCh=0,totPu=0,totRv=0;
    let _h='';rows.forEach(r=>{totSe+=r.sessions;totUs+=r.users;totNu+=r.newUsers;totAt+=r.addToCart;totCh+=r.checkouts;totPu+=r.purchases;totRv+=r.revenue;_h+=`<tr><td>${r.date}</td><td class="num">${fmt(r.sessions)}</td><td class="num">${fmt(r.users)}</td><td class="num">${fmt(r.newUsers)}</td><td class="num">${fmtP(r.bounceRate)}</td><td class="num">${fmt(r.addToCart)}</td><td class="num">${fmt(r.checkouts)}</td><td class="num">${fmt(r.purchases)}</td><td class="num">${fmtE(r.revenue)}</td></tr>`});
    tb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(totSe)}</td><td class="num">${fmt(totUs)}</td><td class="num">${fmt(totNu)}</td><td class="num">${fmtP(avgBnc)}</td><td class="num">${fmt(totAt)}</td><td class="num">${fmt(totCh)}</td><td class="num">${fmt(totPu)}</td><td class="num">${fmtE(totRv)}</td></tr>`;
  }

  // ── CONVERSIONS ───────────────────────────────────────────
  function renderConversions(f,t){
    const pane=document.getElementById('pane-conversions');if(!pane)return;
    const rows=(D.ga_conversions||[]).filter(r=>inR(r.date,f,t));
    if(!rows.length){pane.innerHTML='<div class="chart-card"><p class="no-data">No conversion data in selected range</p></div>';return}
    const tPv=rows.reduce((s,r)=>s+r.page_view,0);
    const tSs=rows.reduce((s,r)=>s+r.session_start,0);
    const tAtc=rows.reduce((s,r)=>s+r.add_to_cart,0);
    const tBc=rows.reduce((s,r)=>s+r.begin_checkout,0);
    const tApi=rows.reduce((s,r)=>s+r.add_payment_info,0);
    const tPu=rows.reduce((s,r)=>s+r.purchase,0);
    const pct=(a,b)=>b?((a/b)*100).toFixed(1)+'%':'—';
    pane.innerHTML=`
      <div class="kpi-row" style="margin-bottom:14px">
        <div class="kpi-card"><div class="kpi-label">Page Views</div><div class="kpi-val">${fmt(tPv)}</div><div class="kpi-sub">top of funnel</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Session Starts</div><div class="kpi-val">${fmt(tSs)}</div><div class="kpi-sub">${pct(tSs,tPv)} of page views</div></div>
        <div class="kpi-card purple"><div class="kpi-label">Add to Cart</div><div class="kpi-val">${fmt(tAtc)}</div><div class="kpi-sub">${pct(tAtc,tSs)} of sessions</div></div>
        <div class="kpi-card teal"><div class="kpi-label">Begin Checkout</div><div class="kpi-val">${fmt(tBc)}</div><div class="kpi-sub">${pct(tBc,tAtc)} of add-to-cart</div></div>
        <div class="kpi-card green"><div class="kpi-label">Purchases</div><div class="kpi-val">${fmt(tPu)}</div><div class="kpi-sub">${pct(tPu,tPv)} overall CVR</div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card" style="flex:1.5"><div class="chart-head"><div><div class="chart-title">Purchase Funnel</div><div class="chart-sub">Volume through each step · ${pct(tPu,tPv)} overall conversion rate</div></div></div><canvas id="chartConvFunnel" height="160"></canvas></div>
        <div class="chart-card" style="flex:1"><div class="chart-head"><div><div class="chart-title">Step Conversion Rates</div><div class="chart-sub">% progressing to next step</div></div></div><canvas id="chartConvRates" height="160"></canvas></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Conversion Rate</div><div class="chart-sub">Purchases ÷ Page Views · 7-day rolling average</div></div></div><canvas id="chartConvTrend" height="100"></canvas></div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Daily Breakdown</div></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th class="num">Page Views</th><th class="num">Sessions</th><th class="num">Add to Cart</th><th class="num">Checkout</th><th class="num">Payment</th><th class="num">Purchases</th><th class="num">CVR</th></tr></thead><tbody id="convTable"></tbody></table></div>
      </div>`;
    const funnelLabels=['Page Views','Session Start','Add to Cart','Begin Checkout','Payment Info','Purchase'];
    const funnelData=[tPv,tSs,tAtc,tBc,tApi,tPu];
    const funnelColors=['#3182ce','#4299e1','#9f7aea','#805ad5','#ed8936','#38a169'];
    mc('chartConvFunnel',{type:'bar',data:{labels:funnelLabels,datasets:[{label:'Users',data:funnelData,backgroundColor:funnelColors.map(c=>c+'bb'),hoverBackgroundColor:funnelColors,borderRadius:5}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.y;const prev=funnelData[ctx.dataIndex-1];const drop=prev?` (${((v/prev)*100).toFixed(1)}% from prev)`:' (top of funnel)';return` ${v.toLocaleString('nl-NL')}${drop}`}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:10}}}}}});
    const rateLabels=['PV→Session','Session→Cart','Cart→Checkout','Checkout→Payment','Payment→Purchase'];
    const rateData=[tPv?tSs/tPv*100:0,tSs?tAtc/tSs*100:0,tAtc?tBc/tAtc*100:0,tBc?tApi/tBc*100:0,tApi?tPu/tApi*100:0];
    const rateColors=['#4299e1','#9f7aea','#ed8936','#e53e3e','#38a169'];
    mc('chartConvRates',{type:'bar',data:{labels:rateLabels,datasets:[{label:'Conversion Rate',data:rateData.map(v=>+v.toFixed(2)),backgroundColor:rateColors.map(c=>c+'bb'),hoverBackgroundColor:rateColors,borderRadius:5}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.y.toFixed(2)}%`}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v.toFixed(1)+'%'}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
    const lb=rows.map(r=>r.date.slice(5));
    const dailyCvr=rows.map(r=>r.page_view?+((r.purchase/r.page_view)*100).toFixed(3):null);
    const rolling7=dailyCvr.map((_,idx)=>{const sl=dailyCvr.slice(Math.max(0,idx-6),idx+1).filter(v=>v!==null);return sl.length?+((sl.reduce((a,b)=>a+b,0)/sl.length).toFixed(3)):null});
    mc('chartConvTrend',{type:'line',data:{labels:lb,datasets:[{label:'Daily CVR',data:dailyCvr,borderColor:'#3182ce',backgroundColor:'#3182ce12',borderWidth:1.5,fill:true,tension:.3,pointRadius:2,pointHoverRadius:5,spanGaps:true},{label:'7-day avg',data:rolling7,borderColor:'#e53e3e',backgroundColor:'transparent',borderWidth:2.5,fill:false,tension:.4,pointRadius:0,pointHoverRadius:5,spanGaps:true}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y.toFixed(2)+'%'}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v.toFixed(1)+'%'}},x:{ticks:{font:{size:10}}}}}});
    const tb=document.getElementById('convTable');let _h='';
    rows.forEach(r=>{const cvr=r.page_view?((r.purchase/r.page_view)*100).toFixed(2)+'%':'—';_h+=`<tr><td>${r.date}</td><td class="num">${fmt(r.page_view)}</td><td class="num">${fmt(r.session_start)}</td><td class="num">${fmt(r.add_to_cart)}</td><td class="num">${fmt(r.begin_checkout)}</td><td class="num">${fmt(r.add_payment_info)}</td><td class="num">${fmt(r.purchase)}</td><td class="num">${cvr}</td></tr>`});
    const totalCvr=tPv?((tPu/tPv)*100).toFixed(2)+'%':'—';
    tb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tPv)}</td><td class="num">${fmt(tSs)}</td><td class="num">${fmt(tAtc)}</td><td class="num">${fmt(tBc)}</td><td class="num">${fmt(tApi)}</td><td class="num">${fmt(tPu)}</td><td class="num">${totalCvr}</td></tr>`;
  }

  // ── OFFLINE MEDIA ─────────────────────────────────────────
  function renderOffline(){
    const pane=document.getElementById('pane-offline');if(!pane)return;
    const of=D.offline;if(!of){pane.innerHTML='<div class="chart-card"><p class="no-data">No offline data</p></div>';return;}
    const hah=of.hah,dag=of.dagblad,mag=of.magazine,tv=of.tv;
    const hahT=hah.items.reduce(function(s,r){return s+r.reach;},0);
    const dagT=dag.items.reduce(function(s,r){return s+r.reach;},0);
    const magT=mag.items.reduce(function(s,r){return s+r.reach;},0);
    const tvT=tv?tv.reach:0;
    const grand=hahT+dagT+magT+tvT;

    pane.innerHTML=`
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Totaal bereik</div><div class="kpi-val">${fmt(grand)}</div><div class="kpi-sub">${hah.items.length+dag.items.length+mag.items.length+1} titels</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Huis-aan-Huis</div><div class="kpi-val">${fmt(hahT)}</div><div class="kpi-sub">${hah.items.length} titels</div></div>
        <div class="kpi-card"><div class="kpi-label">Dagblad</div><div class="kpi-val">${fmt(dagT)}</div><div class="kpi-sub">${dag.items.length} titels</div></div>
        <div class="kpi-card purple"><div class="kpi-label">Magazine</div><div class="kpi-val">${fmt(magT)}</div><div class="kpi-sub">${mag.items.length} titels</div></div>
        <div class="kpi-card red"><div class="kpi-label">TV</div><div class="kpi-val">${fmt(tvT)}</div><div class="kpi-sub">${tv.pub}</div></div>
      </div>

      <div class="chart-row cols-2">
        <div class="chart-card" style="display:flex;flex-direction:column;justify-content:center">
          <div class="chart-head"><div><div class="chart-title">Bereik per categorie</div><div class="chart-sub">Totaal ${fmt(grand)} lezers/kijkers</div></div></div>
          <div style="max-width:320px;margin:0 auto;width:100%"><canvas id="chartOfflineCat" height="260"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-head"><div><div class="chart-title">Magazine — bereik per titel</div><div class="chart-sub">Aandeel per titel · totaal ${fmt(magT)}</div></div></div>
          <div style="max-width:340px;margin:0 auto;width:100%"><canvas id="chartOfflineMag" height="260"></canvas></div>
        </div>
      </div>

      <div class="chart-row cols-1">
        <div class="chart-card">
          <div class="chart-head"><div><div class="chart-title">Huis-aan-Huis — bereik per titel</div><div class="chart-sub">Gesorteerd op oplage · kleur per uitgever: <span style="color:#E67E22">■</span> Verhagen &nbsp;<span style="color:#F1C40F">■</span> Buijzepers &nbsp;<span style="color:#27AE60">■</span> Regio Media Groep</div></div></div>
          <canvas id="chartOfflineHaH" height="220"></canvas>
        </div>
      </div>

      <div class="chart-row cols-1">
        <div class="chart-card">
          <div class="chart-head"><div><div class="chart-title">Dagblad — bereik per regionaal dagblad</div><div class="chart-sub">Alle titels Mediahuis · gesorteerd op bereik</div></div></div>
          <canvas id="chartOfflineDag" height="160"></canvas>
        </div>
      </div>`;

    // ── Category donut ───────────────────────────────────────
    mc('chartOfflineCat',{type:'doughnut',data:{
      labels:['Huis-aan-Huis','Dagblad','Magazine','TV'],
      datasets:[{data:[hahT,dagT,magT,tvT],
        backgroundColor:['#E67E22','#2980B9','#8E44AD','#E74C3C'],hoverOffset:8}]
    },options:{cutout:'62%',plugins:{
      legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,usePointStyle:true,padding:12}},
      tooltip:{callbacks:{label:function(ctx){const v=ctx.parsed;return' '+ctx.label+': '+fmt(v)+' ('+( v/grand*100).toFixed(1)+'%)';}}}
    }}});

    // ── Magazine doughnut ─────────────────────────────────────
    const magColors=['#8E44AD','#A569BD','#6C3483','#BB8FCE','#D2B4DE','#7D3C98'];
    mc('chartOfflineMag',{type:'doughnut',data:{
      labels:mag.items.map(function(r){return r.title;}),
      datasets:[{data:mag.items.map(function(r){return r.reach;}),backgroundColor:magColors,hoverOffset:8}]
    },options:{cutout:'55%',plugins:{
      legend:{position:'bottom',labels:{font:{size:11},boxWidth:10,usePointStyle:true,padding:10}},
      tooltip:{callbacks:{label:function(ctx){const v=ctx.parsed;return' '+ctx.label+': '+fmt(v)+' ('+( v/magT*100).toFixed(1)+'%)';}}}
    }}});

    // ── H-a-H horizontal bar — color by publisher ─────────────
    const pubC={'Verhagen':'#E67E22','Buijzepers':'#F1C40F','Regio Media Groep':'#27AE60'};
    const hahS=[].concat(hah.items).sort(function(a,b){return a.reach-b.reach;}); // ascending for horizontal
    mc('chartOfflineHaH',{type:'bar',data:{
      labels:hahS.map(function(r){return r.title;}),
      datasets:[{label:'Bereik',data:hahS.map(function(r){return r.reach;}),
        backgroundColor:hahS.map(function(r){return pubC[r.pub]||'#E67E22';}),borderRadius:3}]
    },options:{indexAxis:'y',plugins:{legend:{display:false},
      tooltip:{callbacks:{label:function(ctx){return' Bereik: '+fmt(ctx.parsed.x);}}}},
      scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},
              y:{ticks:{font:{size:10}}}}}});

    // ── Dagblad horizontal bar (blue gradient, sorted descending) ─
    const dagS=[].concat(dag.items).sort(function(a,b){return a.reach-b.reach;}); // ascending for horizontal
    const dagColors=dagS.map(function(_,i){return'hsl(210,70%,'+(35+i*5)+'%)';}); // dark→light blue
    mc('chartOfflineDag',{type:'bar',data:{
      labels:dagS.map(function(r){return r.title;}),
      datasets:[{label:'Bereik',data:dagS.map(function(r){return r.reach;}),
        backgroundColor:dagColors,borderRadius:3}]
    },options:{indexAxis:'y',plugins:{legend:{display:false},
      tooltip:{callbacks:{label:function(ctx){return' Bereik: '+fmt(ctx.parsed.x);}}}},
      scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},
              y:{ticks:{font:{size:10}}}}}});
  }

  // ── BUDGET ────────────────────────────────────────────────
  // ── PINTEREST ────────────────────────────────────────────
  function renderPinterest(f,t){
    if(!CH.pinterest||!CH.pinterest.enabled)return;
    const pane=document.getElementById('pane-pinterest');if(!pane)return;
    const rows=(D.pinterest||[]).filter(function(r){return inR(r.date,f,t);});
    const creatives=D.pinterest_campaigns||[];
    const tI=rows.reduce(function(s,r){return s+(r.imp||0);},0);
    const tCl=rows.reduce(function(s,r){return s+(r.clicks||0);},0);
    const tCo=rows.reduce(function(s,r){return s+(r.cost||0);},0);
    const color=CH.pinterest.color||'#E60023';
    const cNames=creatives.map(function(c){return c.name.length>30?c.name.slice(0,28)+'…':c.name;});
    pane.innerHTML=`
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Spend</div><div class="kpi-val">${fmtE(tCo)}</div></div>
        <div class="kpi-card purple"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div>
        <div class="kpi-card teal"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tCo/tI*1000:0)}</div></div>
        <div class="kpi-card pink"><div class="kpi-label">CPC</div><div class="kpi-val">${fmtE(tCl?tCo/tCl:0)}</div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Dagelijkse Impressions & Spend</div><div class="chart-sub">Pinterest campagne · hover voor detail</div></div></div><canvas id="chartPinDaily" height="200"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR per Dag</div><div class="chart-sub">Klikratio dagelijks</div></div></div><canvas id="chartPinCTR" height="200"></canvas></div>
      </div>
      ${creatives.length?`
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CPC & CPM per Campagne</div><div class="chart-sub">Kosten per klik en per duizend vertoningen</div></div></div><canvas id="chartPinCPM" height="200"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Spend & Impressions per Campagne</div><div class="chart-sub">Budget verdeling</div></div></div><canvas id="chartPinSpend" height="200"></canvas></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Pinterest Campagne Breakdown</div></div>
        <div class="table-wrap"><table><thead><tr><th>Campagne</th><th>Type</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th></tr></thead><tbody id="pinCreativeTable"></tbody></table></div>
      </div>`:''}
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Pinterest Dagelijkse Data</div></div>
        <div class="table-wrap"><table><thead><tr><th>Datum</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">Spend</th></tr></thead><tbody id="pinDailyTable"></tbody></table></div>
      </div>`;
    const lb=rows.map(function(r){return r.date.slice(5);});
    mc('chartPinDaily',{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:rows.map(function(r){return r.imp;}),backgroundColor:color+'bb',hoverBackgroundColor:color,borderRadius:3,yAxisID:'y'},{label:'Spend (€)',data:rows.map(function(r){return r.cost;}),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2.5,pointRadius:3,pointHoverRadius:6,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:function(v){return'€'+v;},font:{size:10}}},x:{ticks:{font:{size:9},maxRotation:45}}}}});
    mc('chartPinCTR',{type:'line',data:{labels:lb,datasets:[{label:'CTR (%)',data:rows.map(function(r){return r.imp?r.clicks/r.imp*100:0;}),borderColor:color,backgroundColor:color+'22',borderWidth:2.5,fill:true,tension:.35,pointRadius:3,pointHoverRadius:6}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v.toFixed(2)+'%';}}},x:{ticks:{font:{size:9},maxRotation:45}}}}});
    if(creatives.length){
      mc('chartPinCPM',{type:'bar',data:{labels:cNames,datasets:[{label:'CPC (€)',data:creatives.map(function(c){return c.cpc||0;}),backgroundColor:color+'99',hoverBackgroundColor:color,borderRadius:4,yAxisID:'y'},{label:'CPM (€)',data:creatives.map(function(c){return c.cpm||0;}),backgroundColor:'#4267B2aa',hoverBackgroundColor:'#4267B2',borderRadius:4,yAxisID:'y'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v.toFixed(2);}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      mc('chartPinSpend',{type:'bar',data:{labels:cNames,datasets:[{label:'Spend (€)',data:creatives.map(function(c){return c.spend||0;}),backgroundColor:color+'bb',hoverBackgroundColor:color,borderRadius:4,yAxisID:'y'},{label:'Impressions',data:creatives.map(function(c){return c.imp||0;}),type:'line',borderColor:'#2d3748',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v;}}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;},font:{size:9}}},x:{ticks:{font:{size:9},maxRotation:30}}}}});
      const ctb=document.getElementById('pinCreativeTable');
      let _h='';creatives.forEach(function(c){_h+=`<tr><td title="${c.name}">${c.name.length>40?c.name.slice(0,38)+'…':c.name}</td><td>${c.type||'—'}</td><td class="num">${fmt(c.imp)}</td><td class="num">${fmt(c.clicks)}</td><td class="num">${fmtP(c.ctr)}</td><td class="num">${fmtE(c.cpm)}</td><td class="num">${fmtE(c.cpc)}</td><td class="num">${fmtE(c.spend)}</td></tr>`;});
      ctb.innerHTML=_h;
    }
    const dtb=document.getElementById('pinDailyTable');
    let _h2='';rows.forEach(function(r){_h2+=`<tr><td>${r.date}</td><td class="num">${fmt(r.imp)}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmtP(r.imp?r.clicks/r.imp*100:0)}</td><td class="num">${fmtE(r.imp?r.cost/r.imp*1000:0)}</td><td class="num">${fmtE(r.cost)}</td></tr>`;});
    dtb.innerHTML=_h2+`<tr class="total-row"><td>TOTAAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tCo/tI*1000:0)}</td><td class="num">${fmtE(tCo)}</td></tr>`;
  }

  // ── NATIVE ───────────────────────────────────────────────
  function renderNative(f,t){
    if(!CH.native||!CH.native.enabled)return;
    const pane=document.getElementById('pane-native');if(!pane)return;
    const vars=D.native_variations||[];
    const topics=D.readpeak_topics||[];
    const pa=D.pacing&&D.pacing.find(function(r){return r.channel==='Native'||r.channel==='native';});
    const tSp=vars.length?vars.reduce(function(s,r){return s+r.spend;},0):(pa?pa.spent:0);
    const tCl=vars.length?vars.reduce(function(s,r){return s+r.clicks;},0):0;
    const tImp=vars.length?vars.reduce(function(s,r){return s+r.imp;},0):0;
    const avgCtr=tImp?tCl/tImp*100:0;
    const avgCpc=tCl?tSp/tCl:0;
    const color=CH.native.color||'#1ABC9C';
    const groupColors={'Smaken':'#F6AD55','Wandelen':'#68D391','Cadeau van de zee':'#63B3ED'};
    function groupColor(g){return groupColors[g]||color;}
    pane.innerHTML=`
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tImp)}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gem. CTR</div><div class="kpi-val">${fmtP(avgCtr)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Gem. CPC</div><div class="kpi-val">${fmtE(avgCpc)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Budget</div><div class="kpi-val">${fmtE(CH.native.budget||0,0)}</div></div>
      </div>
      ${vars.length?`
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions per Ad Variation</div><div class="chart-sub">Totaal per variation ID (12 mei – 9 jun 2026)</div></div></div><canvas id="chartNativeVarImp" height="200"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Clicks per Ad Variation</div><div class="chart-sub">Totaal clicks per variation ID</div></div></div><canvas id="chartNativeVarClk" height="200"></canvas></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Spend per Ad Variation</div><div class="chart-sub">Totaal besteed per variation ID</div></div></div><canvas id="chartNativeVarSpend" height="200"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CPC &amp; CPM per Ad Variation</div><div class="chart-sub">Kosten per klik en per 1000 vertoningen</div></div></div><canvas id="chartNativeVarCost" height="200"></canvas></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Ad Variation Detail</div></div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Artikel</th><th>Variant</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Spend</th><th class="num">CPC</th><th class="num">CPM</th></tr></thead><tbody id="nativeVarTable"></tbody></table></div>
      </div>`:''}
      ${topics.length?`
      <div class="chart-card" style="margin-top:16px"><div class="chart-head"><div><div class="chart-title">Native – Content Topics</div><div class="chart-sub">Clicks per artikel (Readpeak)</div></div></div><canvas id="chartNativeTopics" height="100"></canvas></div>`:''}`;
    if(vars.length){
      const labels=vars.map(function(r){return r.id+' ('+r.group.split(' ')[0]+' '+r.label+')';});
      const bgColors=vars.map(function(r){return groupColor(r.group)+'cc';});
      const barOpts=function(yLabel){return{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},y:{ticks:{font:{size:9}}}}};};
      mc('chartNativeVarImp',{type:'bar',data:{labels:labels,datasets:[{label:'Impressions',data:vars.map(function(r){return r.imp;}),backgroundColor:bgColors,borderRadius:3}]},options:barOpts('Impressions')});
      mc('chartNativeVarClk',{type:'bar',data:{labels:labels,datasets:[{label:'Clicks',data:vars.map(function(r){return r.clicks;}),backgroundColor:bgColors,borderRadius:3}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...scaleDefaults},y:{ticks:{font:{size:9}}}}}});
      mc('chartNativeVarSpend',{type:'bar',data:{labels:labels,datasets:[{label:'Spend',data:vars.map(function(r){return r.spend;}),backgroundColor:bgColors,borderRadius:3}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v;}}},y:{ticks:{font:{size:9}}}}}});
      mc('chartNativeVarCost',{type:'bar',data:{labels:labels,datasets:[{label:'CPC (€)',data:vars.map(function(r){return r.cpc;}),backgroundColor:vars.map(function(r){return groupColor(r.group)+'cc';}),borderRadius:3},{label:'CPM (€)',data:vars.map(function(r){return r.cpm;}),backgroundColor:vars.map(function(r){return groupColor(r.group)+'55';}),borderRadius:3}]},options:{indexAxis:'y',plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v;}}},y:{ticks:{font:{size:9}}}}}});
      const tb=document.getElementById('nativeVarTable');
      let _h='';
      vars.forEach(function(r){_h+=`<tr><td><code>${r.id}</code></td><td>${r.group}</td><td>${r.label}</td><td class="num">${fmt(r.imp)}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmtP(r.ctr)}</td><td class="num">${fmtE(r.spend)}</td><td class="num">${fmtE(r.cpc)}</td><td class="num">${fmtE(r.cpm)}</td></tr>`;});
      const totImp=vars.reduce(function(s,r){return s+r.imp;},0),totClk=vars.reduce(function(s,r){return s+r.clicks;},0),totSp=vars.reduce(function(s,r){return s+r.spend;},0);
      _h+=`<tr class="total-row"><td colspan="3">TOTAAL</td><td class="num">${fmt(totImp)}</td><td class="num">${fmt(totClk)}</td><td class="num">${fmtP(totImp?totClk/totImp*100:0)}</td><td class="num">${fmtE(totSp)}</td><td class="num">${fmtE(totClk?totSp/totClk:0)}</td><td class="num">${fmtE(totImp?totSp/totImp*1000:0)}</td></tr>`;
      tb.innerHTML=_h;
    }
    if(topics.length){
      mc('chartNativeTopics',{type:'bar',data:{labels:topics.map(function(r){return r.title.slice(0,35)+'…';}),datasets:[{label:'Clicks',data:topics.map(function(r){return r.clicks;}),backgroundColor:color+'bb',hoverBackgroundColor:color,borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return v>=1000?Math.round(v/1000)+'K':v;}}},y:{ticks:{font:{size:10}}}}}});
    }
  }

  function renderBudget(){
    const pane=document.getElementById('pane-budget');if(!pane)return;
    const raw=D.pacing||D.budget||[];
    const bd=raw.map(function(r){return{name:r.channel||r.name,color:r.color||'#3182ce',budget:r.budget||0,spent:r.spent||0,daysElapsedPct:r.daysTotal?r.daysPast/r.daysTotal*100:0,status:r.status||''};});
    const barColors=bd.map(function(r){return r.color+'bb';});
    pane.innerHTML=`<div class="chart-row cols-1"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Budget Allocatie per Kanaal</div><div class="chart-sub">Beschikbaar vs Besteed · Totaal: ${fmtE(C.totalBudget,0)}</div></div></div><canvas id="chartBudget" height="100"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">Budget Pacing Overview</div></div><div class="table-wrap"><table><thead><tr><th>Kanaal</th><th class="num">Budget</th><th class="num">Besteed</th><th class="num">Resterend</th><th class="num">% Besteed</th><th class="num">Vlucht %</th><th class="num">Pacing</th><th>Status</th></tr></thead><tbody id="budgetTable"></tbody></table></div></div>`;
    mc('chartBudget',{type:'bar',data:{labels:bd.map(function(r){return r.name;}),datasets:[{label:'Budget',data:bd.map(function(r){return r.budget;}),backgroundColor:bd.map(function(r){return r.color+'22';}),borderColor:bd.map(function(r){return r.color;}),borderWidth:1.5,borderRadius:3},{label:'Besteed',data:bd.map(function(r){return r.spent;}),backgroundColor:barColors,hoverBackgroundColor:bd.map(function(r){return r.color;}),borderRadius:3}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{x:{ticks:{maxRotation:30,font:{size:10}}},y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:function(v){return'€'+v.toLocaleString('nl-NL');}}}}}});
    const tb=document.getElementById('budgetTable');
    let _h='';
    bd.forEach(function(r){
      const p=r.budget?r.spent/r.budget*100:0;
      const pac=r.daysElapsedPct>0?p/r.daysElapsedPct:0;
      const statusMap={'actief':'b-green','gepland':'b-grey','over budget':'b-red','under-pacing':'b-orange','on track':'b-green'};
      const cls=r.spent===0?'b-grey':pac>1.5?'b-red':pac<0.5&&r.spent>0?'b-orange':'b-green';
      const lbl=r.status||( r.spent===0?'Gepland':pac>1.5?'Over budget':pac<0.5?'Under-pacing':'On track');
      _h+=`<tr><td><span class="ch-dot" style="background:${r.color}"></span>${r.name}</td><td class="num">${fmtE(r.budget,0)}</td><td class="num">${fmtE(r.spent)}</td><td class="num">${fmtE(r.budget-r.spent)}</td><td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill${p>100?' over':p>75?' warn':''}" style="width:${Math.min(p,100)}%"></div></div><span class="prog-txt">${p.toFixed(1)}%</span></div></td><td class="num">${(r.daysElapsedPct||0).toFixed(1)}%</td><td class="num">${r.spent>0?pac.toFixed(2)+'x':'—'}</td><td><span class="badge ${cls}">${lbl}</span></td></tr>`;
    });
    const tB=bd.reduce(function(s,r){return s+r.budget;},0),tSp=bd.reduce(function(s,r){return s+r.spent;},0);
    const tP=tB?tSp/tB*100:0;
    tb.innerHTML=_h+`<tr class="total-row"><td>TOTAAL</td><td class="num">${fmtE(tB,0)}</td><td class="num">${fmtE(tSp)}</td><td class="num">${fmtE(tB-tSp)}</td><td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:${Math.min(tP,100).toFixed(1)}%"></div></div><span class="prog-txt">${tP.toFixed(1)}%</span></div></td><td>—</td><td>—</td><td></td></tr>`;
  }

  // ── TIKTOK ───────────────────────────────────────────────
  function renderTikTok(f,t){
    if(!CH.tiktok||!CH.tiktok.enabled)return;
    const pane=document.getElementById('pane-tiktok');if(!pane)return;
    const tk=D.tiktok;if(!tk||!tk.ads){pane.innerHTML='<div class="chart-card"><p class="no-data">No TikTok data</p></div>';return}
    const xlDate=v=>{const n=Number(v);return(!isNaN(n)&&n>40000)?new Date((n-25569)*864e5).toISOString().slice(0,10):v};
    const ads=tk.ads,daily=(tk.daily||[]).map(r=>({...r,date:xlDate(r.date)})).filter(r=>inR(r.date,f,t));
    const tI=ads.reduce((a,r)=>a+r.imp,0),tCl=ads.reduce((a,r)=>a+r.clicks,0),tSp=ads.reduce((a,r)=>a+r.spend,0),tV=ads.reduce((a,r)=>a+r.views,0);
    const tVvr=ads.length?ads.reduce((a,r)=>a+(r.vvr||0),0)/ads.length:0;
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Video Views</div><div class="kpi-val">${fmt(tV)}</div></div><div class="kpi-card orange"><div class="kpi-label">Overall VTR</div><div class="kpi-val">${fmtP(tVvr)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPC</div><div class="kpi-val">${fmtE(tCl?tSp/tCl:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div><div class="chart-sub">Hover for daily detail</div></div></div><canvas id="chartTTDaily" height="170"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Video Completion Funnel</div><div class="chart-sub">% of views reaching each milestone</div></div></div><canvas id="chartTTFunnel" height="170"></canvas></div></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">TikTok Ad Breakdown</div></div></div><div class="table-wrap"><table><thead><tr><th>Campaign</th><th>Ad</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">Views</th><th class="num">VTR</th><th class="num">CPM</th><th class="num">Spend</th></tr></thead><tbody id="ttTable"></tbody></table></div></div>`;
    const lb=daily.map(r=>r.date.slice(5));
    mc('chartTTDaily',{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:daily.map(r=>r.imp),backgroundColor:CH.tiktok.color+'bb',yAxisID:'y'},{label:'Spend (€)',data:daily.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    const vv100Pct=tV>0?tV:1,funnelData=[100,tV>0?(ads.reduce((a,r)=>a+r.vv25,0)/vv100Pct*100):0,tV>0?(ads.reduce((a,r)=>a+r.vv50,0)/vv100Pct*100):0,tV>0?(ads.reduce((a,r)=>a+r.vv75,0)/vv100Pct*100):0,tV>0?(ads.reduce((a,r)=>a+r.vv100,0)/vv100Pct*100):0];
    mc('chartTTFunnel',{type:'bar',data:{labels:['Starts','25%','50%','75%','100%'],datasets:[{label:'Video Views %',data:funnelData,backgroundColor:[CH.tiktok.color+'bb',CH.tiktok.color+'99',CH.tiktok.color+'77',CH.tiktok.color+'55',CH.tiktok.color+'33'],borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,max:100,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},x:{ticks:{font:{size:11}}}}}});
    const tb=document.getElementById('ttTable');let totI=0,totCl=0,totSp=0,totV=0;
    let _h='';ads.forEach(a=>{totI+=a.imp;totCl+=a.clicks;totSp+=a.spend;totV+=a.views;_h+=`<tr><td>${a.campaign}</td><td title="${a.ad}">${a.ad.slice(0,25)}</td><td class="num">${fmt(a.imp)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${fmtP(a.ctr)}</td><td class="num">${fmt(a.views)}</td><td class="num">${fmtP(a.vvr)}</td><td class="num">${fmtE(a.cpm)}</td><td class="num">${fmtE(a.spend)}</td></tr>`});
    tb.innerHTML=_h+`<tr class="total-row"><td colspan="2">TOTAL</td><td class="num">${fmt(totI)}</td><td class="num">${fmt(totCl)}</td><td class="num">${fmtP(totI?totCl/totI*100:0)}</td><td class="num">${fmt(totV)}</td><td class="num">${fmtP(tVvr)}</td><td class="num">${fmtE(totI?totSp/totI*1000:0)}</td><td class="num">${fmtE(totSp)}</td></tr>`;
  }

  // ── DPG ──────────────────────────────────────────────────
  function renderDPG(f,t){
    if(!CH.dpg||!CH.dpg.enabled)return;
    const pane=document.getElementById('pane-dpg');if(!pane)return;
    const dpg=D.dpg;if(!dpg||!dpg.formats||!dpg.formats.length){pane.innerHTML='<div class="chart-card"><p class="no-data">No DPG data</p></div>';return}
    const fmts=dpg.formats,daily=dpg.daily||{};
    const colors=['#6B9E78','#4A90C4','#9B6B9E','#E08B5D','#E07B7B'];
    const subTabs=['Overview',...fmts.map(f=>f.name)];
    const subBtns=subTabs.map((n,i)=>`<button class="tab-btn${i===0?' active':''}" data-dpg-subtab="${n}">${n}</button>`).join('');
    const subPanes=subTabs.map(n=>`<div id="dpg-sub-${n.replace(/\s/g,'-')}" class="tab-pane${n==='Overview'?' active':''}"></div>`).join('');
    pane.innerHTML=`<div class="tab-row" style="margin-bottom:12px">${subBtns}</div>${subPanes}`;
    window.dpgSubTab=function(name,btn){pane.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));pane.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));pane.querySelector('#dpg-sub-'+name.replace(/\s/g,'-')).classList.add('active');btn.classList.add('active')};

    // Add DPG sub-tab event listeners
    pane.querySelectorAll('[data-dpg-subtab]').forEach(btn => {
      btn.addEventListener('click', function(){
        window.dpgSubTab(this.dataset.dpgSubtab, this);
      });
    });

    // Overview
    const ovPane=document.getElementById('dpg-sub-Overview');
    ovPane.innerHTML=`<div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Format</div><div class="chart-sub">Hover for exact values</div></div></div><canvas id="chartDPGImp" height="200"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR by Format</div></div></div><canvas id="chartDPGCTR" height="200"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">DPG Format Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Format</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th><th class="num">Budget</th><th>Pacing</th></tr></thead><tbody id="dpgTable"></tbody></table></div></div>`;
    const fmtLabels=fmts.map(f=>f.name),fmtColors=fmts.map((_,i)=>colors[i%colors.length]);
    mc('chartDPGImp',{type:'bar',data:{labels:fmtLabels,datasets:[{data:fmts.map(f=>f.imp),backgroundColor:fmtColors,borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.y;return v>=1e6?(v/1e6).toFixed(2)+'M':v>=1000?Math.round(v/1000)+'K':v}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:11}}}}}});
    mc('chartDPGCTR',{type:'bar',data:{labels:fmtLabels,datasets:[{data:fmts.map(f=>f.ctr),backgroundColor:fmtColors,borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},x:{ticks:{font:{size:11}}}}}});
    const dtb=document.getElementById('dpgTable');let tI=0,tCl=0,tSp=0,tB=0;
    let _h='';fmts.forEach((f,i)=>{const p=f.budget?f.spend/f.budget*100:0;tI+=f.imp;tCl+=f.clicks;tSp+=f.spend;tB+=f.budget;_h+=`<tr><td><span class="ch-dot" style="background:${colors[i]}"></span>${f.name}</td><td class="num">${fmt(f.imp)}</td><td class="num">${fmt(f.clicks)}</td><td class="num">${fmtP(f.ctr)}</td><td class="num">${fmtE(f.cpm)}</td><td class="num">${fmtE(f.cpc)}</td><td class="num">${fmtE(f.spend)}</td><td class="num">${fmtE(f.budget,0)}</td><td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill${p>80?' over':p>50?' warn':''}" style="width:${Math.min(p,100)}%"></div></div><span class="prog-txt">${p.toFixed(1)}%</span></div></td></tr>`});
    dtb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtE(tCl?tSp/tCl:0)}</td><td class="num">${fmtE(tSp)}</td><td class="num">${fmtE(tB,0)}</td><td><span class="prog-txt">${(tB?tSp/tB*100:0).toFixed(1)}%</span></td></tr>`;
    // Per-format sub-panes
    fmts.forEach((f,fi)=>{
      const subId='dpg-sub-'+f.name.replace(/\s/g,'-'),subPane=document.getElementById(subId);if(!subPane)return;
      const fDaily=daily[f.name]||[],fAds=daily[f.name+'_ads']||[],color=colors[fi%colors.length],isVid=f.name==='Outstream'||f.name==='Instream';
      subPane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(f.imp)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(f.clicks)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(f.ctr)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(f.cpm)}</div></div><div class="kpi-card"><div class="kpi-label">Spend</div><div class="kpi-val">${fmtE(f.spend)}</div></div>${isVid?`<div class="kpi-card"><div class="kpi-label">VTR</div><div class="kpi-val">${fmtP(f.vtr||0)}</div></div>`:`<div class="kpi-card"><div class="kpi-label">CPC</div><div class="kpi-val">${fmtE(f.cpc)}</div></div>`}</div><div class="chart-row cols-${isVid?'2':'1'}"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div></div></div><canvas id="chartDPG${f.name.replace(/\s/g,'')}Daily" height="170"></canvas></div>${isVid?`<div class="chart-card"><div class="chart-head"><div class="chart-title">Video Completion Funnel</div></div><canvas id="chartDPG${f.name.replace(/\s/g,'')}Video" height="170"></canvas></div>`:''}</div><div class="chart-card"><div class="chart-head"><div class="chart-title">${f.name} Ad Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Ad</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">Spend</th></tr></thead><tbody id="dpgAds${f.name.replace(/\s/g,'')}"></tbody></table></div></div>`;
      const lb=fDaily.map(r=>r.date.slice(5));
      mc(`chartDPG${f.name.replace(/\s/g,'')}Daily`,{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:fDaily.map(r=>r.imp),backgroundColor:color+'bb',yAxisID:'y'},{label:'Spend (€)',data:fDaily.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
      if(isVid&&f.v25!==undefined)mc(`chartDPG${f.name.replace(/\s/g,'')}Video`,{type:'bar',data:{labels:['25%','50%','75%','100%'],datasets:[{label:'Views',data:[f.v25,f.v50,f.v75,f.v100],backgroundColor:[color+'cc',color+'bb',color+'99',color+'77'],borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:12}}}}}});
      const atb=document.getElementById('dpgAds'+f.name.replace(/\s/g,''));
      if(atb)atb.innerHTML=fAds.map(a=>`<tr><td title="${a.ad}">${a.ad.slice(0,50)}</td><td class="num">${fmt(a.imp)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${fmtP(a.ctr)}</td><td class="num">${fmtE(a.cpm)}</td><td class="num">${fmtE(a.spend)}</td></tr>`).join('');
    });
  }

  // ── ADFORM ───────────────────────────────────────────────
  function renderAdform(f,t){
    if(!CH.adform||!CH.adform.enabled)return;
    const pane=document.getElementById('pane-adform');if(!pane)return;
    const af=D.adform;if(!af||!af.formats||!af.formats.length){pane.innerHTML='<div class="chart-card"><p class="no-data">No Adform data</p></div>';return}
    const fmts=af.formats;
    const colors=['#FF7043','#FF8A65','#FFAB91','#BF360C'];
    const tI=fmts.reduce((a,r)=>a+r.imp,0),tCl=fmts.reduce((a,r)=>a+r.clicks,0),tSp=fmts.reduce((a,r)=>a+r.spend,0);
    pane.innerHTML=`
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div>
        <div class="kpi-card orange"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div>
        <div class="kpi-card purple"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div>
        <div class="kpi-card teal"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div>
        <div class="kpi-card pink"><div class="kpi-label">CPC</div><div class="kpi-val">${fmtE(tCl?tSp/tCl:0)}</div></div>
      </div>
      <div class="chart-row cols-2">
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Format</div><div class="chart-sub">Hover for exact values</div></div></div><canvas id="chartAFImp" height="200"></canvas></div>
        <div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR by Format</div></div></div><canvas id="chartAFCTR" height="200"></canvas></div>
      </div>
      <div class="chart-card"><div class="chart-head"><div class="chart-title">Adform Format Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Format</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th><th class="num">Budget</th><th>Pacing</th></tr></thead><tbody id="afTable"></tbody></table></div></div>`;
    const fmtLabels=fmts.map(f=>f.name),fmtColors=fmts.map((_,i)=>colors[i%colors.length]);
    mc('chartAFImp',{type:'bar',data:{labels:fmtLabels,datasets:[{data:fmts.map(f=>f.imp),backgroundColor:fmtColors,borderRadius:4}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.y;return v>=1e6?(v/1e6).toFixed(2)+'M':v>=1000?Math.round(v/1000)+'K':v}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:11}}}}}});
    mc('chartAFCTR',{type:'bar',data:{labels:fmtLabels,datasets:[{data:fmts.map(f=>f.ctr),backgroundColor:fmtColors,borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},x:{ticks:{font:{size:11}}}}}});
    const dtb=document.getElementById('afTable');let _h='';
    fmts.forEach((f,i)=>{const p=f.budget?f.spend/f.budget*100:0;_h+=`<tr><td><span class="ch-dot" style="background:${colors[i]}"></span>${f.name}</td><td class="num">${fmt(f.imp)}</td><td class="num">${fmt(f.clicks)}</td><td class="num">${fmtP(f.ctr)}</td><td class="num">${fmtE(f.cpm)}</td><td class="num">${fmtE(f.cpc)}</td><td class="num">${fmtE(f.spend)}</td><td class="num">${fmtE(f.budget||0,0)}</td><td><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill${p>80?' over':p>50?' warn':''}" style="width:${Math.min(p,100)}%"></div></div><span class="prog-txt">${p.toFixed(1)}%</span></div></td></tr>`});
    dtb.innerHTML=_h+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtE(tCl?tSp/tCl:0)}</td><td class="num">${fmtE(tSp)}</td><td class="num">${fmtE(CH.adform.budget||0,0)}</td><td><span class="prog-txt">${(CH.adform.budget?tSp/CH.adform.budget*100:0).toFixed(1)}%</span></td></tr>`;
  }

  // ── READPEAK ─────────────────────────────────────────────
  function renderReadpeak(f,t){
    if(!CH.readpeak||!CH.readpeak.enabled)return;
    const pane=document.getElementById('pane-readpeak');if(!pane)return;
    const rp=D.readpeak;if(!rp||!rp.ads){pane.innerHTML='<div class="chart-card"><p class="no-data">No Readpeak data</p></div>';return}
    const ads=rp.ads;
    function normG(g){return g.toLowerCase().includes('consid')?'Consideration':g.toLowerCase().includes('conv')?'Conversion':g}
    const byG={};ads.forEach(a=>{const g=normG(a.group||'Other');if(!byG[g])byG[g]={imp:0,clicks:0,spend:0};byG[g].imp+=a.imp;byG[g].clicks+=a.clicks;byG[g].spend+=a.spend});
    const grpL=Object.keys(byG),tI=ads.reduce((a,r)=>a+r.imp,0),tCl=ads.reduce((a,r)=>a+r.clicks,0),tSp=ads.reduce((a,r)=>a+r.spend,0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">Avg CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">Avg CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">Avg CPC</div><div class="kpi-val">${fmtE(tCl?tSp/tCl:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Conversion vs Consideration</div><div class="chart-sub">Impressions · Clicks · Spend per objective group</div></div></div><canvas id="chartRPGroups" height="220"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR & CPM by Group</div><div class="chart-sub">Conversion vs Consideration combined</div></div></div><canvas id="chartRPCTR" height="220"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">Readpeak Ad Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Ad Group</th><th>Ad ID</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th></tr></thead><tbody id="rpTable"></tbody></table></div></div>`;
    const gcol=['#48bb78','#4299e1'];
    mc('chartRPGroups',{type:'bar',data:{labels:grpL,datasets:[{label:'Impressions',data:grpL.map(g=>byG[g].imp),backgroundColor:gcol.map(c=>c+'99'),borderRadius:4,yAxisID:'y'},{label:'Clicks',data:grpL.map(g=>byG[g].clicks),backgroundColor:gcol.map(c=>c+'66'),borderRadius:4,yAxisID:'y'},{label:'Spend (€)',data:grpL.map(g=>byG[g].spend),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:6,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.y;if(ctx.dataset.label==='Spend (€)')return` Spend: ${fmtE(v)}`;return v>=1000?` ${ctx.dataset.label}: ${Math.round(v/1000)}K`:` ${ctx.dataset.label}: ${v.toLocaleString('nl-NL')}`}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v.toFixed(0),font:{size:10}}},x:{ticks:{font:{size:12}}}}}});
    mc('chartRPCTR',{type:'bar',data:{labels:grpL,datasets:[{label:'CTR %',data:grpL.map(g=>{const v=byG[g];return v.imp?+(v.clicks/v.imp*100).toFixed(4):0}),backgroundColor:gcol.map(c=>c+'99'),borderRadius:4,yAxisID:'y'},{label:'CPM (€)',data:grpL.map(g=>{const v=byG[g];return v.imp?+(v.spend/v.imp*1000).toFixed(2):0}),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:6,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.y;if(ctx.dataset.label==='CPM (€)')return` CPM: ${fmtE(v)}`;return` CTR: ${fmtP(v)}`}}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v.toFixed(2),font:{size:10}}},x:{ticks:{font:{size:12}}}}}});
    const tb=document.getElementById('rpTable');let totI=0,totCl=0,totSp=0;
    let _h='';ads.forEach(a=>{totI+=a.imp;totCl+=a.clicks;totSp+=a.spend;const g=normG(a.group||'Other');_h+=`<tr><td><span class="badge ${g==='Conversion'?'b-blue':'b-green'}">${g}</span></td><td>${a.id}</td><td class="num">${fmt(a.imp)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${fmtP(a.ctr)}</td><td class="num">${fmtE(a.cpm)}</td><td class="num">${fmtE(a.cpc)}</td><td class="num">${fmtE(a.spend)}</td></tr>`});
    tb.innerHTML=_h+`<tr class="total-row"><td colspan="2">TOTAL</td><td class="num">${fmt(totI)}</td><td class="num">${fmt(totCl)}</td><td class="num">${fmtP(totI?totCl/totI*100:0)}</td><td class="num">${fmtE(totI?totSp/totI*1000:0)}</td><td class="num">${fmtE(totCl?totSp/totCl:0)}</td><td class="num">${fmtE(totSp)}</td></tr>`;
  }

  // ── REDDIT ───────────────────────────────────────────────
  function renderReddit(f,t){
    if(!CH.reddit||!CH.reddit.enabled)return;
    const pane=document.getElementById('pane-reddit');if(!pane)return;
    const rd=D.reddit;if(!rd||!rd.ads){pane.innerHTML='<div class="chart-card"><p class="no-data">No Reddit data</p></div>';return}
    const ads=rd.ads,tI=ads.reduce((a,r)=>a+r.imp,0),tCl=ads.reduce((a,r)=>a+r.clicks,0),tSp=ads.reduce((a,r)=>a+r.spend,0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPC</div><div class="kpi-val">${fmtE(tCl?tSp/tCl:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Ad</div></div></div><canvas id="chartRDImp" height="200"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">CTR by Ad</div></div></div><canvas id="chartRDCTR" height="200"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">Reddit Ad Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Ad</th><th>Goal</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">Spend</th></tr></thead><tbody id="rdTable"></tbody></table></div></div>`;
    const rdCol=CH.reddit.color,labels=ads.map(a=>(a.ad||'Ad').slice(0,25));
    mc('chartRDImp',{type:'bar',data:{labels,datasets:[{label:'Impressions',data:ads.map(a=>a.imp),backgroundColor:rdCol+'bb',borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.x;return v>=1000?` ${Math.round(v/1000)}K`:` ${v.toLocaleString('nl-NL')}`}}}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y:{ticks:{font:{size:10}}}}}});
    mc('chartRDCTR',{type:'bar',data:{labels,datasets:[{label:'CTR %',data:ads.map(a=>a.ctr),backgroundColor:rdCol+'bb',borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},y:{ticks:{font:{size:10}}}}}});
    const tb=document.getElementById('rdTable');
    tb.innerHTML=ads.map(a=>`<tr><td title="${a.ad||''}">${(a.ad||'Ad').slice(0,40)}</td><td>${a.goal||'—'}</td><td class="num">${fmt(a.imp)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${fmtP(a.ctr)}</td><td class="num">${fmtE(a.cpm)}</td><td class="num">${fmtE(a.cpc)}</td><td class="num">${fmtE(a.spend)}</td></tr>`).join('')+`<tr class="total-row"><td colspan="2">TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtE(tCl?tSp/tCl:0)}</td><td class="num">${fmtE(tSp)}</td></tr>`;
  }

  // ── DOOH ─────────────────────────────────────────────────
  function renderDOOH(f,t){
    if(!CH.dooh||!CH.dooh.enabled)return;
    const pane=document.getElementById('pane-dooh');if(!pane)return;
    const rows=(D.dooh||[]).filter(r=>inR(r.date,f,t));
    const byP={};rows.forEach(r=>{const n=(r.loc||r.owner+' '+r.venue||'Unknown');if(!byP[n])byP[n]={imp:0,cost:0,mediaCost:0};byP[n].imp+=(r.imp||0);byP[n].cost+=(r.totalCost||0);byP[n].mediaCost+=(r.mediaCost||0)});
    const placements=Object.entries(byP).map(([name,v])=>({name,...v,cpm:v.imp?v.cost/v.imp*1000:0}));
    const tI=placements.reduce((a,r)=>a+r.imp,0),tCo=placements.reduce((a,r)=>a+r.cost,0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Total Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tCo)}</div></div><div class="kpi-card"><div class="kpi-label">Avg CPM</div><div class="kpi-val">${fmtE(tI?tCo/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">Placements</div><div class="kpi-val">${placements.length}</div></div></div><div class="chart-row cols-1"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Placement</div><div class="chart-sub">Hover for exact values</div></div></div><canvas id="chartDOOHImp" height="180"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">DOOH Placement Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Placement</th><th class="num">Impressions</th><th class="num">Media Cost</th><th class="num">Total Cost</th><th class="num">CPM</th></tr></thead><tbody id="doohTable"></tbody></table></div></div>`;
    // Sort by impressions descending, assign distinct colours per placement
    placements.sort((a,b)=>b.imp-a.imp);
    const doohColors=['#E67E22','#F39C12','#D35400','#FAD7A0','#CA6F1E','#F8C471'];
    mc('chartDOOHImp',{type:'bar',data:{labels:placements.map(p=>p.name),datasets:[{label:'Impressions',data:placements.map(p=>p.imp),backgroundColor:placements.map((_,i)=>doohColors[i%doohColors.length]),borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const v=ctx.parsed.x;return v>=1e6?` ${(v/1e6).toFixed(2)}M`:v>=1000?` ${Math.round(v/1000)}K`:` ${v.toLocaleString('nl-NL')}`}}}},scales:{x:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?Math.round(v/1000)+'K':v}},y:{ticks:{font:{size:11}}}}}});
    const tb=document.getElementById('doohTable');
    tb.innerHTML=placements.map(p=>`<tr><td>${p.name}</td><td class="num">${fmt(p.imp)}</td><td class="num">${fmtE(p.mediaCost)}</td><td class="num">${fmtE(p.cost)}</td><td class="num">${fmtE(p.cpm)}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmtE(placements.reduce((a,p)=>a+p.mediaCost,0))}</td><td class="num">${fmtE(tCo)}</td><td class="num">${fmtE(tI?tCo/tI*1000:0)}</td></tr>`;
  }

  // ── SHOWHEROES ───────────────────────────────────────────
  function renderShowheroes(f,t){
    if(!CH.showheroes||!CH.showheroes.enabled)return;
    const pane=document.getElementById('pane-showheroes');if(!pane)return;
    const sh=D.showheroes;if(!sh||!sh.ads){pane.innerHTML='<div class="chart-card"><p class="no-data">No Showheroes data</p></div>';return}
    const ads=sh.ads,daily=(sh.daily||[]).filter(r=>inR(r.date,f,t));
    const tI=ads.reduce((a,r)=>a+r.imp,0),tCl=ads.reduce((a,r)=>a+r.clicks,0),tSp=ads.reduce((a,r)=>a+r.spend,0);
    const tV100=ads.reduce((a,r)=>a+(r.v100||0),0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">VTR (100%)</div><div class="kpi-val">${fmtP(tI?tV100/tI*100:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div></div></div><canvas id="chartSHDaily" height="170"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Video Completion Funnel</div></div></div><canvas id="chartSHVideo" height="170"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">Showheroes Ad Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Version</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">CPC</th><th class="num">VTR</th><th class="num">Spend</th></tr></thead><tbody id="shTable"></tbody></table></div></div>`;
    const col=CH.showheroes.color,lb=daily.map(r=>r.date.slice(5));
    mc('chartSHDaily',{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:daily.map(r=>r.imp),backgroundColor:col+'bb',yAxisID:'y'},{label:'Spend (€)',data:daily.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    const totV25=ads.reduce((a,r)=>a+(r.v25||0),0),totV50=ads.reduce((a,r)=>a+(r.v50||0),0),totV75=ads.reduce((a,r)=>a+(r.v75||0),0);
    mc('chartSHVideo',{type:'bar',data:{labels:['25%','50%','75%','100%'],datasets:[{label:'Views',data:[totV25,totV50,totV75,tV100],backgroundColor:[col+'cc',col+'bb',col+'99',col+'77'],borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:12}}}}}});
    const tb=document.getElementById('shTable');
    tb.innerHTML=ads.map(a=>`<tr><td>${a.versie}</td><td class="num">${fmt(a.imp)}</td><td class="num">${fmt(a.clicks)}</td><td class="num">${fmtP(a.ctr)}</td><td class="num">${fmtE(a.cpm)}</td><td class="num">${fmtE(a.cpc)}</td><td class="num">${fmtP(a.vtr)}</td><td class="num">${fmtE(a.spend)}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtE(tCl?tSp/tCl:0)}</td><td class="num">${fmtP(tI?tV100/tI*100:0)}</td><td class="num">${fmtE(tSp)}</td></tr>`;
  }

  // ── ADALLIANCE ───────────────────────────────────────────
  function renderAdAlliance(f,t){
    if(!CH.adalliance||!CH.adalliance.enabled)return;
    const pane=document.getElementById('pane-adalliance');if(!pane)return;
    const aa=D.adalliance;if(!aa||!aa.publishers){pane.innerHTML='<div class="chart-card"><p class="no-data">No AdAlliance data</p></div>';return}
    const pubs=aa.publishers,daily=(aa.daily||[]).filter(r=>inR(r.date,f,t));
    const tI=pubs.reduce((a,r)=>a+r.imp,0),tCl=pubs.reduce((a,r)=>a+r.clicks,0),tSp=pubs.reduce((a,r)=>a+r.spend,0);
    const tV100=pubs.reduce((a,r)=>a+(r.v100||0),0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">VTR (100%)</div><div class="kpi-val">${fmtP(tI?tV100/tI*100:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div></div></div><canvas id="chartAADaily" height="170"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Video Completion by Publisher</div></div></div><canvas id="chartAAVideo" height="170"></canvas></div></div><div class="chart-card"><div class="chart-head"><div class="chart-title">AdAlliance Publisher Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Publisher</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">VTR</th><th class="num">Spend</th></tr></thead><tbody id="aaTable"></tbody></table></div></div>`;
    const col=CH.adalliance.color,lb=daily.map(r=>r.date.slice(5));
    mc('chartAADaily',{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:daily.map(r=>r.imp),backgroundColor:col+'bb',yAxisID:'y'},{label:'Spend (€)',data:daily.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    mc('chartAAVideo',{type:'bar',data:{labels:pubs.map(p=>p.publisher.slice(0,20)),datasets:[{label:'25%',data:pubs.map(p=>p.v25),backgroundColor:col+'cc',borderRadius:2},{label:'50%',data:pubs.map(p=>p.v50),backgroundColor:col+'99',borderRadius:2},{label:'75%',data:pubs.map(p=>p.v75),backgroundColor:col+'77',borderRadius:2},{label:'100%',data:pubs.map(p=>p.v100),backgroundColor:col+'55',borderRadius:2}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},x:{ticks:{font:{size:10}}}}}});
    const tb=document.getElementById('aaTable');
    tb.innerHTML=pubs.map(p=>`<tr><td>${p.publisher}</td><td class="num">${fmt(p.imp)}</td><td class="num">${fmt(p.clicks)}</td><td class="num">${fmtP(p.ctr)}</td><td class="num">${fmtE(p.cpm)}</td><td class="num">${fmtP(p.vtr)}</td><td class="num">${fmtE(p.spend)}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtP(tI?tV100/tI*100:0)}</td><td class="num">${fmtE(tSp)}</td></tr>`;
  }

  // ── TALPA ──────────────────────────────────────────────────
  function renderTalpa(f,t){
    if(!CH.talpa||!CH.talpa.enabled)return;
    const pane=document.getElementById('pane-talpa');if(!pane)return;
    const tp=D.talpa;if(!tp||!tp.campaigns){pane.innerHTML='<div class="chart-card"><p class="no-data">No Talpa data</p></div>';return}
    const campaigns=tp.campaigns,daily=(tp.daily||[]).filter(r=>inR(r.date,f,t));
    const tI=campaigns.reduce((a,r)=>a+r.imp,0),tCl=campaigns.reduce((a,r)=>a+r.clicks,0),tSp=campaigns.reduce((a,r)=>a+r.spend,0);
    const tV100=campaigns.reduce((a,r)=>a+(r.v100||0),0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Impressions</div><div class="kpi-val">${fmt(tI)}</div></div><div class="kpi-card"><div class="kpi-label">Clicks</div><div class="kpi-val">${fmt(tCl)}</div></div><div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-val">${fmtE(tSp)}</div></div><div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-val">${fmtP(tI?tCl/tI*100:0)}</div></div><div class="kpi-card"><div class="kpi-label">CPM</div><div class="kpi-val">${fmtE(tI?tSp/tI*1000:0)}</div></div><div class="kpi-card"><div class="kpi-label">VTR (100%)</div><div class="kpi-val">${fmtP(tI?tV100/tI*100:0)}</div></div></div><div class="chart-row cols-2"><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Daily Impressions & Spend</div></div></div><canvas id="chartTalpaDaily" height="170"></canvas></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Impressions by Site</div></div></div><canvas id="chartTalpaSite" height="170"></canvas></div></div><div class="chart-card"><div class="chart-head"><div><div class="chart-title">Talpa Campaign Breakdown</div></div><div class="table-wrap"><table><thead><tr><th>Campaign ID</th><th>Device</th><th class="num">Impressions</th><th class="num">Clicks</th><th class="num">CTR</th><th class="num">CPM</th><th class="num">VTR</th><th class="num">Spend</th></tr></thead><tbody id="talpaTable"></tbody></table></div></div>`;
    const col=CH.talpa.color,lb=daily.map(r=>r.date.slice(5));
    mc('chartTalpaDaily',{type:'bar',data:{labels:lb,datasets:[{label:'Impressions',data:daily.map(r=>r.imp),backgroundColor:col+'bb',yAxisID:'y'},{label:'Spend (€)',data:daily.map(r=>r.cost),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    const siteData={};campaigns.forEach(c=>{const s=c.site||'Unknown';if(!siteData[s])siteData[s]={imp:0,clicks:0,spend:0};siteData[s].imp+=c.imp;siteData[s].clicks+=c.clicks;siteData[s].spend+=c.spend});const sites=Object.keys(siteData).sort();
    mc('chartTalpaSite',{type:'bar',data:{labels:sites,datasets:[{label:'Impressions',data:sites.map(s=>siteData[s].imp),backgroundColor:col+'cc',hoverBackgroundColor:col,borderRadius:4,yAxisID:'y'},{label:'Spend (€)',data:sites.map(s=>siteData[s].spend),type:'line',borderColor:'#ed8936',backgroundColor:'transparent',borderWidth:2.5,pointRadius:4,yAxisID:'y1'}]},options:{interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12,usePointStyle:true}}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v>=1000?Math.round(v/1000)+'K':v}},y1:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'€'+v,font:{size:10}}},x:{ticks:{font:{size:10}}}}}});
    const tb=document.getElementById('talpaTable');
    tb.innerHTML=campaigns.map(c=>{const cpm=c.imp?c.spend/c.imp*1000:0;return`<tr><td title="${c.campaign}">${c.site||'?'}</td><td>${c.device||'?'}</td><td class="num">${fmt(c.imp)}</td><td class="num">${fmt(c.clicks)}</td><td class="num">${fmtP(c.ctr*100)}</td><td class="num">${fmtE(cpm)}</td><td class="num">${fmtP(c.vtr*100)}</td><td class="num">${fmtE(c.spend)}</td></tr>`}).join('')+`<tr class="total-row"><td>TOTAL</td><td></td><td class="num">${fmt(tI)}</td><td class="num">${fmt(tCl)}</td><td class="num">${fmtP(tI?tCl/tI*100:0)}</td><td class="num">${fmtE(tI?tSp/tI*1000:0)}</td><td class="num">${fmtP(tI?tV100/tI*100:0)}</td><td class="num">${fmtE(tSp)}</td></tr>`;
  }

  // ── VTR COMPARISON ────────────────────────────────────────
  function renderVTR(f,t){
    const pane=document.getElementById('pane-vtr');if(!pane)return;
    const channels=[];

    // Collect video completion data from all video channels
    // Meta: per-video VTR data
    if(D.meta_video_vtr&&D.meta_video_vtr.length){
      D.meta_video_vtr.forEach(function(v){
        channels.push({name:'Meta – '+v.name,imp:v.imp,v25:v.v25,v50:v.v50,v75:v.v75,v100:v.v100,vtr:v.vtr,spend:v.spend,cpm:v.cpm,color:'#0081FB'});
      });
    } else if(D.meta_boosts_formats){const vf=D.meta_boosts_formats.find(function(r){return r.type==='Video';});if(vf&&vf.v25){channels.push({name:'Meta Video',imp:vf.imp,v25:vf.v25,v50:vf.v50,v75:vf.v75,v100:vf.v100,vtr:vf.imp?vf.v100/vf.imp*100:0});}}
    if(D.tiktok&&D.tiktok.ads){const tv=D.tiktok.ads.reduce((a,r)=>a+r.views,0);if(tv>0){const ti=D.tiktok.ads.reduce((a,r)=>a+r.imp,0);channels.push({name:'TikTok',imp:ti,v25:D.tiktok.ads.reduce((a,r)=>a+r.vv25,0),v50:D.tiktok.ads.reduce((a,r)=>a+r.vv50,0),v75:D.tiktok.ads.reduce((a,r)=>a+r.vv75,0),v100:D.tiktok.ads.reduce((a,r)=>a+r.vv100,0),vtr:D.tiktok.ads.reduce((a,r)=>a+r.vvr,0)/Math.max(D.tiktok.ads.length,1)})}}
    if(D.dpg&&D.dpg.formats){D.dpg.formats.forEach(f=>{if((f.name==='Outstream'||f.name==='Instream')&&f.imp>0){channels.push({name:'DPG '+f.name,imp:f.imp,v25:f.v25||0,v50:f.v50||0,v75:f.v75||0,v100:f.v100||0,vtr:f.vtr||0})}});
    }
    if(D.showheroes&&D.showheroes.ads){const sh=D.showheroes.ads;const si=sh.reduce((a,r)=>a+r.imp,0);if(si>0){channels.push({name:'ShowHeroes',imp:si,v25:sh.reduce((a,r)=>a+(r.v25||0),0),v50:sh.reduce((a,r)=>a+(r.v50||0),0),v75:sh.reduce((a,r)=>a+(r.v75||0),0),v100:sh.reduce((a,r)=>a+(r.v100||0),0),vtr:si?sh.reduce((a,r)=>a+(r.v100||0),0)/si*100:0})}}
    if(D.adalliance&&D.adalliance.publishers){const ap=D.adalliance.publishers;const ai=ap.reduce((a,r)=>a+r.imp,0);if(ai>0){channels.push({name:'AdAlliance',imp:ai,v25:ap.reduce((a,r)=>a+(r.v25||0),0),v50:ap.reduce((a,r)=>a+(r.v50||0),0),v75:ap.reduce((a,r)=>a+(r.v75||0),0),v100:ap.reduce((a,r)=>a+(r.v100||0),0),vtr:ap.reduce((a,r)=>a+r.vtr,0)/Math.max(ap.length,1)})}}
    if(D.talpa&&D.talpa.campaigns){const tc=D.talpa.campaigns;const ti=tc.reduce((a,r)=>a+r.imp,0);if(ti>0){const avgVtr=tc.reduce((a,r)=>a+(r.vtr||0),0)/Math.max(tc.length,1)*100;const v100est=Math.round(ti*avgVtr/100);channels.push({name:'Talpa',imp:ti,v25:Math.round(v100est/0.992),v50:Math.round(v100est/0.991),v75:v100est,v100:v100est,vtr:avgVtr})}}

    if(channels.length===0){pane.innerHTML='<div class="chart-card"><p class="no-data">No video data available</p></div>';return}

    const totalImp=channels.reduce((a,r)=>a+r.imp,0),totalV100=channels.reduce((a,r)=>a+r.v100,0);
    const avgV25=channels.reduce((a,r)=>a+(r.imp>0?r.v25/r.imp*100:0),0)/channels.length;
    const avgV50=channels.reduce((a,r)=>a+(r.imp>0?r.v50/r.imp*100:0),0)/channels.length;
    const avgV75=channels.reduce((a,r)=>a+(r.imp>0?r.v75/r.imp*100:0),0)/channels.length;
    const avgVTR=channels.reduce((a,r)=>a+(r.imp>0?r.v100/r.imp*100:0),0)/channels.length;
    const totalSpend=channels.reduce((a,r)=>a+(r.spend||0),0);
    pane.innerHTML=`<div class="kpi-row"><div class="kpi-card"><div class="kpi-label">Totaal Impressions</div><div class="kpi-val">${fmt(totalImp)}</div></div><div class="kpi-card"><div class="kpi-label">Gem. 25% Completion</div><div class="kpi-val">${fmtP(avgV25)}</div></div><div class="kpi-card"><div class="kpi-label">Gem. 50% Completion</div><div class="kpi-val">${fmtP(avgV50)}</div></div><div class="kpi-card"><div class="kpi-label">Gem. 75% Completion</div><div class="kpi-val">${fmtP(avgV75)}</div></div><div class="kpi-card orange"><div class="kpi-label">Gem. VTR (100%)</div><div class="kpi-val">${fmtP(avgVTR)}</div></div><div class="kpi-card"><div class="kpi-label">Totaal Spend</div><div class="kpi-val">${fmtE(totalSpend)}</div></div></div>
    <div class="chart-row cols-2">
      <div class="chart-card"><div class="chart-head"><div><div class="chart-title">Video Completion per Video</div><div class="chart-sub">% impressions per afkijkmijlpaal</div></div></div><div style="position:relative;height:260px"><canvas id="chartVTRFunnel"></canvas></div></div>
      <div class="chart-card"><div class="chart-head"><div><div class="chart-title">VTR per Video (100% afkijken)</div><div class="chart-sub">View-Through Rate · Meta Bereik campagne</div></div></div><canvas id="chartVTRBar" height="260"></canvas></div>
    </div>
    <div class="chart-card"><div class="chart-head"><div class="chart-title">Video Detail Overzicht</div></div><div class="table-wrap"><table><thead><tr><th>Video</th><th class="num">Impressions</th><th class="num">25%</th><th class="num">50%</th><th class="num">75%</th><th class="num">VTR (100%)</th><th class="num">CPM</th><th class="num">Spend</th></tr></thead><tbody id="vtrTable"></tbody></table></div></div>`;

    mc('chartVTRFunnel',{type:'bar',data:{labels:channels.map(c=>c.name),datasets:[{label:'25%',data:channels.map(c=>c.imp>0?c.v25/c.imp*100:0),backgroundColor:'#93C5FD',borderRadius:3},{label:'50%',data:channels.map(c=>c.imp>0?c.v50/c.imp*100:0),backgroundColor:'#60A5FA',borderRadius:3},{label:'75%',data:channels.map(c=>c.imp>0?c.v75/c.imp*100:0),backgroundColor:'#3B82F6',borderRadius:3},{label:'100%',data:channels.map(c=>c.imp>0?c.v100/c.imp*100:0),backgroundColor:'#1D4ED8',borderRadius:3}]},options:{maintainAspectRatio:false,responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,padding:8,usePointStyle:true}}},layout:{padding:{top:5,bottom:5,left:5,right:5}},scales:{y:{...scaleDefaults,max:100,ticks:{...scaleDefaults.ticks,callback:v=>v+'%',font:{size:9}}},x:{ticks:{font:{size:9}}}}}});
    mc('chartVTRBar',{type:'bar',data:{labels:channels.map(c=>c.name),datasets:[{label:'VTR %',data:channels.map(c=>c.vtr||0),backgroundColor:channels.map(c=>(c.color||'#0081FB')+'bb'),hoverBackgroundColor:channels.map(c=>c.color||'#0081FB'),borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{...scaleDefaults,ticks:{...scaleDefaults.ticks,callback:v=>v+'%'}},x:{ticks:{font:{size:11}}}}}});

    const tb=document.getElementById('vtrTable');
    const totV25=channels.reduce((a,r)=>a+r.v25,0),totV50=channels.reduce((a,r)=>a+r.v50,0),totV75=channels.reduce((a,r)=>a+r.v75,0),totV100=channels.reduce((a,r)=>a+r.v100,0);
    tb.innerHTML=channels.map(ch=>`<tr><td>${ch.name}</td><td class="num">${fmt(ch.imp)}</td><td class="num">${fmtP(ch.imp>0?ch.v25/ch.imp*100:0)}</td><td class="num">${fmtP(ch.imp>0?ch.v50/ch.imp*100:0)}</td><td class="num">${fmtP(ch.imp>0?ch.v75/ch.imp*100:0)}</td><td class="num">${fmtP(ch.vtr||0)}</td><td class="num">${fmtE(ch.cpm||0)}</td><td class="num">${fmtE(ch.spend||0)}</td></tr>`).join('')+`<tr class="total-row"><td>TOTAAL</td><td class="num">${fmt(totalImp)}</td><td class="num">${fmtP(totalImp?totV25/totalImp*100:0)}</td><td class="num">${fmtP(totalImp?totV50/totalImp*100:0)}</td><td class="num">${fmtP(totalImp?totV75/totalImp*100:0)}</td><td class="num">${fmtP(totalImp?totV100/totalImp*100:0)}</td><td class="num">${fmtE(totalImp?totalSpend/totalImp*1000:0)}</td><td class="num">${fmtE(totalSpend)}</td></tr>`;
  }

  // ── TAB SWITCH ────────────────────────────────────────────
  window.showPane = function(id,btn){
    document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('pane-'+id).classList.add('active');
    btn.classList.add('active');
    // Re-render charts for the newly visible tab (charts in hidden divs have no dimensions)
    const{from,to}=getF();
    const re={tiktok:()=>renderTikTok(from,to),dpg:()=>renderDPG(from,to),adform:()=>renderAdform(from,to),readpeak:()=>renderReadpeak(from,to),reddit:()=>renderReddit(from,to),dooh:()=>renderDOOH(from,to),google:()=>renderGoogle(from,to),meta:()=>renderMeta(from,to),ga4:()=>renderGA4(from,to),conversions:()=>renderConversions(from,to),budget:()=>renderBudget(),showheroes:()=>renderShowheroes(from,to),adalliance:()=>renderAdAlliance(from,to),talpa:()=>renderTalpa(from,to),vtr:()=>renderVTR(from,to),offline:()=>renderOffline(),pinterest:()=>renderPinterest(from,to),native:()=>renderNative(from,to)};
    if(re[id])re[id]();
  };

  // ── MASTER UPDATE ─────────────────────────────────────────
  window.updateDash = function(){
    const{from,to,chs}=getF();
    console.log('📊 updateDash called. Filters:', {from, to, selectedChannels: Object.keys(chs).filter(k=>chs[k])});
    const s=getSummaries(from,to,chs);
    console.log('📊 Summaries after filter:', s.length, 'channels,', s.map(x=>x.name).join(', '));
    updateKPIs(s);
    renderTrend(from,to,chs);
    renderOverview(s);
    renderGoogle(from,to);
    renderMeta(from,to);
    renderTikTok(from,to);
    renderDPG(from,to);
    renderAdform(from,to);
    renderReadpeak(from,to);
    renderReddit(from,to);
    renderDOOH(from,to);
    renderGA4(from,to);
    renderConversions(from,to);
    renderShowheroes(from,to);
    renderAdAlliance(from,to);
    renderTalpa(from,to);
    renderPinterest(from,to);
    renderNative(from,to);
    renderVTR(from,to);
    renderBudget();
    if(typeof window.DASH_EXTRA_RENDER==='function') window.DASH_EXTRA_RENDER(from,to,chs);
  };

  // ── DATE INPUTS ───────────────────────────────────────────
  document.getElementById('dateFrom').addEventListener('change',()=>{document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));window.updateDash()});
  document.getElementById('dateTo').addEventListener('change',()=>{document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));window.updateDash()});

  // ── INIT ──────────────────────────────────────────────────
  window.updateDash();
  if(typeof window.DASH_REFRESH_DONE === 'function') window.DASH_REFRESH_DONE();

})();
