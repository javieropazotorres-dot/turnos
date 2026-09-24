(function(){
  var MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var DOW=['dom','lun','mar','mié','jue','vie','sáb'];
  var DOWL=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var PAL=['--p1','--p2','--p3','--p4','--p5','--p6','--p7'];
  var ICON_BACK='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>';
  var ICON_CHEV='<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"></path></svg>';
  var ICON_WA='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"></path></svg>';
  var ICON_COPY='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>';

  function pad(n){return String(n).padStart(2,'0');}
  function todayKey(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function parse(k){var p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
  function diffDays(a,b){return Math.round((parse(a)-parse(b))/86400000);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function plata(n){return '$'+String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
  function fmtH(h){h=Number(h)||0;return (Math.round(h*10)/10).toString().replace('.',',');}
  function mins(start,h){var p=(start||'00:00').split(':').map(Number);return p[0]*60+p[1]+Math.round(h*60);}
  function hhmm(t){var r=((t%1440)+1440)%1440;return pad(Math.floor(r/60))+':'+pad(r%60);}
  function finCorto(start,h){var t=mins(start,h),d=Math.floor(t/1440);return hhmm(t)+(d>0?' (+'+d+')':'');}
  function finLargo(start,h){var t=mins(start,h),d=Math.floor(t/1440);return hhmm(t)+(d===1?' del día siguiente':d>1?' (+'+d+' días)':'');}
  function monthLabel(mk){var p=mk.split('-').map(Number);return MES[p[1]-1]+' '+p[0];}
  function shiftMonth(mk,delta){var p=mk.split('-').map(Number);var d=new Date(p[0],p[1]-1+delta,1);return d.getFullYear()+'-'+pad(d.getMonth()+1);}
  function lsGet(k,def){try{var v=localStorage.getItem(k);return v==null?def:JSON.parse(v);}catch(e){return def;}}
  function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

  var S={
    status:'loading', places:[], shifts:[], perfil:{nombre:'',titulo:'doctora'}, lastBackup:null,
    screen:'inicio', cobroMes:todayKey().slice(0,7), openShift:null, confirmDel:null,
    form:null, addOpen:false, nl:{name:'',rate:''}, error:'', editNombre:false,
    optDetalle:lsGet('optDetalle',true), optMonto:lsGet('optMonto',false)
  };
  function newForm(){return {date:todayKey(),start:'08:00',hours:12,placeId:''};}
  S.form=newForm();

  var app=document.getElementById('app');
  var toastEl=document.getElementById('toast'); var toastT;
  function toast(t){toastEl.textContent=t;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true;},2600);}

  function placeById(id){for(var i=0;i<S.places.length;i++){if(S.places[i].id===id)return S.places[i];}return null;}
  function colorOf(pl,idx){return 'var('+PAL[((pl&&pl.color!=null?pl.color:idx)||0)%PAL.length]+')';}
  function deco(s){
    var dt=parse(s.date), pl=placeById(s.placeId), T=todayKey(), n=diffDays(s.date,T);
    var rate=pl&&Number(pl.rate)>0?Number(pl.rate):0;
    return {
      id:s.id, date:s.date, start:s.start, hours:Number(s.hours)||0, placeId:s.placeId,
      place:pl?pl.name:(s.placeName||'Lugar'), color:colorOf(pl,0),
      dow:DOW[dt.getDay()], day:dt.getDate(), mon:MES[dt.getMonth()].slice(0,3),
      largo:DOWL[dt.getDay()]+' '+dt.getDate()+' de '+MES[dt.getMonth()],
      ddmm:pad(dt.getDate())+'/'+pad(dt.getMonth()+1),
      range:s.start+' – '+finCorto(s.start,s.hours),
      rate:rate, pago:rate*(Number(s.hours)||0),
      rel:n===0?'Hoy':n===1?'Mañana':n>1?'En '+n+' días':''
    };
  }
  function sorted(){return S.shifts.slice().sort(function(a,b){return (a.date+a.start).localeCompare(b.date+b.start);}).map(deco);}
  function split(){var T=todayKey(),all=sorted();return {up:all.filter(function(s){return s.date>=T;}),past:all.filter(function(s){return s.date<T;}).reverse()};}
  function sumH(l){return l.reduce(function(a,s){return a+s.hours;},0);}
  function sumP(l){return l.reduce(function(a,s){return a+s.pago;},0);}
  function groupByMonth(l){var m={},out=[];l.forEach(function(s){var k=s.date.slice(0,7);if(!m[k]){m[k]={key:k,items:[]};out.push(m[k]);}m[k].items.push(s);});return out;}
  function desglose(l){var tot=sumH(l)||1,out=[];S.places.forEach(function(p,i){var it=l.filter(function(s){return s.placeId===p.id;});if(!it.length)return;var h=sumH(it);out.push({name:p.name,color:colorOf(p,i),h:h,n:it.length,pct:h/tot*100});});return out;}

  function shiftCard(s,showPago){
    var open=S.openShift===s.id, conf=S.confirmDel===s.id;
    var h='<div class="list" style="gap:8px"><button class="shift" data-act="toggleShift" data-id="'+esc(s.id)+'" aria-expanded="'+open+'">'+
      '<div class="datebox"><span>'+s.dow+'</span><strong class="num">'+s.day+'</strong><span style="text-transform:none">'+s.mon+'</span></div>'+
      '<div class="grow"><div class="row" style="gap:8px"><span class="dot" style="background:'+s.color+'"></span><span class="place">'+esc(s.place)+'</span></div><div class="sub num">'+s.range+'</div></div>'+
      '<div class="right"><b class="num">'+fmtH(s.hours)+' h</b><span class="num">'+(showPago?(s.rate?plata(s.pago):'—'):s.rel)+'</span></div></button>';
    if(open){
      h+= conf
        ? '<div class="confirm"><button class="btn btn-sm btn-ghost" style="flex:1" data-act="cancelDel">Cancelar</button><button class="btn btn-sm btn-danger" style="flex:1" data-act="doDel" data-id="'+esc(s.id)+'">Sí, eliminar</button></div>'
        : '<div class="confirm"><button class="btn btn-sm btn-ghost" style="flex:1" data-act="askDel" data-id="'+esc(s.id)+'">Eliminar turno</button></div>';
    }
    return h+'</div>';
  }
  function backHead(title,sub){return '<div class="head-back"><button class="icon-btn" data-go="inicio" aria-label="Volver">'+ICON_BACK+'</button><div class="head"><h1 style="font-size:28px">'+title+'</h1>'+(sub?'<div class="eyebrow cap">'+sub+'</div>':'')+'</div></div>';}
  function bar(d){return '<div class="bar">'+d.map(function(x){return '<div style="width:'+x.pct+'%;background:'+x.color+'"></div>';}).join('')+'</div>';}

  var V={};
  V.inicio=function(){
    var sp=split(), mk=todayKey().slice(0,7), mesPast=sp.past.filter(function(s){return s.date.slice(0,7)===mk;});
    var nx=sp.up[0], rest=sp.up.slice(1), dt=parse(todayKey());
    var h='<div class="head"><div class="eyebrow cap">'+DOWL[dt.getDay()]+' '+dt.getDate()+' de '+MES[dt.getMonth()]+'</div><h1>Mis turnos</h1></div>';
    h+='<div class="tiles"><button class="tile" data-go="realizadas">'+ICON_CHEV+'<small>Realizadas en '+MES[dt.getMonth()]+'</small><span class="big num">'+fmtH(sumH(mesPast))+' h</span><small>'+mesPast.length+' turnos</small></button>'+
       '<button class="tile" data-go="programadas">'+ICON_CHEV+'<small>Programadas</small><span class="big num">'+fmtH(sumH(sp.up))+' h</span><small>'+sp.up.length+' turnos próximos</small></button></div>';
    if(nx){
      h+='<div class="hero"><div class="between"><span class="label">Próximo turno</span><span class="pill">'+nx.rel+'</span></div>'+
         '<div class="head"><div class="big cap" style="font-size:26px">'+nx.largo+'</div><div style="font-size:16px">'+esc(nx.place)+'</div></div>'+
         '<div class="row" style="gap:20px;font-size:14px"><span class="num">'+nx.range+'</span><strong class="num">'+fmtH(nx.hours)+' h</strong></div></div>';
    }
    h+='<section class="list"><h2>'+(nx?'Después':'Próximos turnos')+'</h2>';
    if(rest.length){h+=rest.map(function(s){return shiftCard(s,false);}).join('');}
    else h+='<div class="empty">'+(nx?'No hay más turnos agendados.':'Aún no hay turnos agendados. Usa el botón + para registrar uno.')+'</div>';
    return h+'</section>';
  };
  V.realizadas=function(){
    var sp=split(), mk=todayKey().slice(0,7), l=sp.past.filter(function(s){return s.date.slice(0,7)===mk;}), d=desglose(l);
    var h=backHead('Horas realizadas',monthLabel(mk));
    h+='<div class="card" style="padding:18px;display:flex;flex-direction:column;gap:14px"><div class="row" style="align-items:baseline"><span class="big num" style="font-size:42px">'+fmtH(sumH(l))+' h</span><span class="sub" style="font-size:15px">en '+l.length+' turnos</span></div>';
    if(d.length){h+=bar(d)+'<div class="list" style="gap:8px">'+d.map(function(x){return '<div class="row" style="font-size:14px"><span class="dot" style="background:'+x.color+'"></span><span style="flex:1">'+esc(x.name)+'</span><span class="sub num">'+x.n+' turnos</span><strong class="num" style="width:52px;text-align:right">'+fmtH(x.h)+' h</strong></div>';}).join('')+'</div>';}
    h+='</div><section class="list"><h2>Turnos del mes</h2>'+(l.length?l.map(function(s){return shiftCard(s,true);}).join(''):'<div class="empty">Todavía no hay turnos realizados este mes.</div>')+'</section>';
    h+='<button class="btn btn-outline btn-block" data-act="verCobro">Ver cobro de '+MES[Number(mk.slice(5))-1]+'</button>';
    return h;
  };
  V.programadas=function(){
    var sp=split(), d=desglose(sp.up), hasRates=sp.up.some(function(s){return s.rate;});
    var h=backHead('Turnos programados','Desde hoy en adelante');
    h+='<div class="hero"><div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="head"><span class="label">Turnos</span><span class="big num" style="font-size:26px">'+sp.up.length+'</span></div><div class="head"><span class="label">Horas</span><span class="big num" style="font-size:26px">'+fmtH(sumH(sp.up))+' h</span></div><div class="head"><span class="label">Por cobrar</span><span class="big num" style="font-size:20px;line-height:1.5">'+(hasRates?plata(sumP(sp.up)):'—')+'</span></div></div>';
    if(d.length)h+='<div class="tags" style="gap:6px 14px;font-size:13px">'+d.map(function(x){return '<span>'+esc(x.name)+' · <strong class="num">'+fmtH(x.h)+' h</strong></span>';}).join('')+'</div>';
    h+='</div>';
    var g=groupByMonth(sp.up);
    if(!g.length)h+='<div class="empty">No hay turnos agendados.</div>';
    g.forEach(function(gr){h+='<section class="list"><div class="group-h"><h2 class="cap">'+monthLabel(gr.key)+'</h2><span class="sub">'+gr.items.length+' turnos · <strong class="num">'+fmtH(sumH(gr.items))+' h</strong></span></div>'+gr.items.map(function(s){return shiftCard(s,false);}).join('')+'</section>';});
    return h;
  };
  V.historial=function(){
    var sp=split(), g=groupByMonth(sp.past);
    var h='<div class="head"><div class="eyebrow">Turnos realizados</div><h1>Historial</h1></div>';
    if(!g.length)h+='<div class="empty">Aquí aparecerán los turnos ya realizados.</div>';
    g.forEach(function(gr){
      h+='<section class="list"><div class="group-h"><h2 class="cap">'+monthLabel(gr.key)+'</h2><span class="sub num">'+gr.items.length+' turnos · '+fmtH(sumH(gr.items))+' h · <strong>'+plata(sumP(gr.items))+'</strong></span></div>'+gr.items.map(function(s){return shiftCard(s,true);}).join('')+'</section>';
    });
    return h;
  };
  function mensaje(pl,items,mk){
    var t=(S.perfil.titulo||'doctora'), nombre=(S.perfil.nombre||'').trim()||'[nombre]';
    var horas=sumH(items);
    var m='Horas realizadas por la '+t+' '+nombre+' en '+pl.name+': '+fmtH(horas)+' horas durante el mes de '+monthLabel(mk)+'.';
    if(S.optDetalle){m+='\n\nDetalle:\n'+items.map(function(s){return '• '+s.dow+' '+s.ddmm+': '+fmtH(s.hours)+' h ('+s.range+')';}).join('\n');}
    if(S.optMonto&&Number(pl.rate)>0){m+='\n\nTotal: '+fmtH(horas)+' h × '+plata(pl.rate)+' = '+plata(horas*Number(pl.rate));}
    return m;
  }
  V.cobros=function(){
    var mk=S.cobroMes, T=todayKey(), all=sorted();
    var hechos=all.filter(function(s){return s.date<T&&s.date.slice(0,7)===mk;});
    var prog=all.filter(function(s){return s.date>=T&&s.date.slice(0,7)===mk;});
    var por=[];
    S.places.forEach(function(p,i){var it=hechos.filter(function(s){return s.placeId===p.id;});if(it.length)por.push({p:p,i:i,items:it});});
    var sinTarifa=por.some(function(x){return !(Number(x.p.rate)>0);});
    var h='<div class="head"><div class="eyebrow">Turnos realizados por cobrar</div><h1>Cobros</h1></div>';
    h+='<div class="month-nav"><button class="icon-btn" data-act="mes" data-d="-1" aria-label="Mes anterior">'+ICON_BACK+'</button><strong class="cap" style="font-size:16px">'+monthLabel(mk)+'</strong><button class="icon-btn" data-act="mes" data-d="1" aria-label="Mes siguiente" style="transform:scaleX(-1)">'+ICON_BACK+'</button></div>';
    h+='<div class="hero" style="gap:6px"><span class="label">Total a cobrar</span><span class="big num" style="font-size:40px">'+plata(sumP(hechos))+'</span><span style="font-size:14px">'+hechos.length+' turnos · '+fmtH(sumH(hechos))+' h en '+por.length+(por.length===1?' lugar':' lugares')+'</span>'+
       (prog.length?'<div style="margin-top:8px;padding-top:10px;border-top:1px solid var(--accent-soft);font-size:14px">Con los '+prog.length+' turnos programados del mes: <strong class="num">'+plata(sumP(hechos)+sumP(prog))+'</strong></div>':'')+'</div>';
    if(sinTarifa)h+='<div class="note">Hay lugares sin valor por hora. Defínelo en <button data-go="lugares" style="border:none;background:none;padding:0;color:var(--accent);font-weight:600;text-decoration:underline">Lugares</button> para calcular el monto.</div>';
    h+='<section class="list"><div class="between"><h2>Por lugar</h2></div>';
    if(!por.length)h+='<div class="empty">No hay turnos realizados en '+MES[Number(mk.slice(5))-1]+'.</div>';
    else{
      h+='<div class="card toggles" style="padding:8px 14px"><span class="sub" style="padding-top:4px">El mensaje incluye:</span><label class="toggle"><input type="checkbox" id="opt-detalle" data-opt="optDetalle"'+(S.optDetalle?' checked':'')+'> Detalle de cada turno</label><label class="toggle"><input type="checkbox" id="opt-monto" data-opt="optMonto"'+(S.optMonto?' checked':'')+'> Monto a cobrar</label></div>';
    }
    por.forEach(function(x){
      var hs=sumH(x.items), rate=Number(x.p.rate)||0, msg=mensaje(x.p,x.items,mk);
      var wa='https://wa.me/?text='+encodeURIComponent(msg);
      h+='<div class="card cobro"><div class="row"><span class="dot" style="background:'+colorOf(x.p,x.i)+'"></span><span class="place" style="flex:1">'+esc(x.p.name)+'</span><span class="amount num">'+(rate?plata(hs*rate):'—')+'</span></div>'+
        '<div class="sub num">'+x.items.length+' turnos · '+fmtH(hs)+' h'+(rate?' × '+plata(rate)+'/h':' · sin valor por hora')+'</div>'+
        '<div class="tags">'+x.items.map(function(s){return '<span class="tag num">'+s.dow+' '+s.day+' · '+fmtH(s.hours)+' h</span>';}).join('')+'</div>'+
        '<details><summary>Ver mensaje</summary><pre class="msg" id="msg-'+esc(x.p.id)+'">'+esc(msg)+'</pre></details>'+
        '<div class="grid2"><a class="btn btn-sm btn-wa" href="'+esc(wa)+'" target="_blank" rel="noopener">'+ICON_WA+' WhatsApp</a><button class="btn btn-sm btn-ghost" data-act="copy" data-id="'+esc(x.p.id)+'">'+ICON_COPY+' Copiar</button></div></div>';
    });
    return h+'</section>';
  };
  function addPlaceBox(prefix){
    return '<div class="box"><div class="lbl">Nuevo lugar</div><div class="field"><label for="'+prefix+'-nombre">Nombre</label><input class="input" id="'+prefix+'-nombre" data-nl="name" placeholder="Ej: Hospital del Salvador" value="'+esc(S.nl.name)+'" autocomplete="off"></div>'+
      '<div class="field"><label for="'+prefix+'-valor">Valor por hora ($)</label><input class="input" id="'+prefix+'-valor" data-nl="rate" type="number" inputmode="numeric" min="0" step="500" placeholder="Opcional" value="'+esc(S.nl.rate)+'"></div>'+
      '<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="cancelAdd">Cancelar</button><button class="btn btn-sm btn-primary" data-act="saveAdd">Agregar</button></div></div>';
  }
  V.lugares=function(){
    var h='<div class="head"><div class="eyebrow">Centros donde hace turnos</div><h1>Lugares</h1></div><div class="list">';
    if(!S.places.length)h+='<div class="empty">Aún no hay lugares. Agrega el primero.</div>';
    S.places.forEach(function(p,i){
      var n=S.shifts.filter(function(s){return s.placeId===p.id;}).length;
      h+='<div class="card place-row"><span class="dot" style="width:12px;height:12px;background:'+colorOf(p,i)+'"></span><div class="grow"><span class="place">'+esc(p.name)+'</span><span class="sub" style="font-size:12px">'+n+(n===1?' turno registrado':' turnos registrados')+'</span></div>'+
         '<div class="rate"><label for="rate-'+esc(p.id)+'">Valor hora ($)</label><input class="input num" id="rate-'+esc(p.id)+'" data-rate="'+esc(p.id)+'" type="number" inputmode="numeric" min="0" step="500" placeholder="Sin valor" value="'+(Number(p.rate)>0?Number(p.rate):'')+'"></div></div>';
    });
    h+='</div>'+(S.addOpen?addPlaceBox('lp'):'<button class="btn btn-dashed btn-block" data-act="openAdd">+ Agregar lugar</button>');
    h+='<section class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><h2>Nombre en los mensajes</h2><div class="field"><label for="perfil-nombre">Nombre completo</label><input class="input" id="perfil-nombre" data-perfil="nombre" value="'+esc(S.perfil.nombre)+'" autocomplete="name"></div>'+
       '<div class="field"><label for="perfil-titulo">Tratamiento</label><select class="input" id="perfil-titulo" data-perfil="titulo"><option value="doctora"'+(S.perfil.titulo!=='Dra.'?' selected':'')+'>doctora</option><option value="Dra."'+(S.perfil.titulo==='Dra.'?' selected':'')+'>Dra.</option></select></div><div class="note">Se usa en el mensaje de WhatsApp de Cobros. Se guarda al salir del campo.</div></section>';
    var lb=S.lastBackup?new Date(S.lastBackup):null;
    h+='<section class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><h2>Respaldo de datos</h2><div class="note">Los turnos se guardan solo en este teléfono. Descarga un respaldo cada cierto tiempo y guárdalo en Drive, iCloud o envíatelo por correo.</div>'+
       '<div class="sub">'+(lb?'Último respaldo: '+lb.getDate()+' de '+MES[lb.getMonth()]+' '+lb.getFullYear():'Todavía no hay respaldos.')+'</div>'+
       '<div class="grid2"><button class="btn btn-sm btn-primary" data-act="backup">Descargar respaldo</button><button class="btn btn-sm btn-ghost" data-act="csv">Exportar a Excel</button></div>'+
       '<label class="btn btn-sm btn-dashed btn-block" for="restore-file" style="cursor:pointer">Restaurar desde un respaldo</label><input type="file" id="restore-file" accept="application/json,.json" hidden></section>';
    return h;
  };
  V.nuevo=function(){
    var f=S.form, pl=placeById(f.placeId), pago=pl&&Number(pl.rate)>0?Number(pl.rate)*(Number(f.hours)||0):0;
    var h='<div class="head-back"><button class="icon-btn" data-go="inicio" aria-label="Volver">'+ICON_BACK+'</button><h1 style="font-size:28px">Nuevo turno</h1></div>';
    h+='<div class="grid2"><div class="field"><label for="f-fecha">Día</label><input class="input" id="f-fecha" type="date" data-f="date" value="'+esc(f.date)+'"></div><div class="field"><label for="f-inicio">Hora de inicio</label><input class="input" id="f-inicio" type="time" data-f="start" value="'+esc(f.start)+'"></div></div>';
    h+='<div class="field"><label for="f-horas">Cantidad de horas</label><div class="chips">'+[6,8,12,24].map(function(x){return '<button class="chip num" data-act="hrs" data-h="'+x+'" aria-pressed="'+(Number(f.hours)===x)+'">'+x+' h</button>';}).join('')+
       '<input class="input num" id="f-horas" type="number" inputmode="decimal" min="0.5" max="48" step="0.5" data-f="hours" value="'+esc(f.hours)+'" aria-label="Otra cantidad de horas" style="width:72px;height:44px;text-align:center"></div><div class="sub" id="fin-txt">Termina a las '+finLargo(f.start,Number(f.hours)||0)+'</div></div>';
    h+='<div class="field"><span class="lbl">Lugar</span><div class="list" style="gap:8px">'+S.places.map(function(p,i){var sel=f.placeId===p.id;return '<button class="opt" data-act="pick" data-id="'+esc(p.id)+'" aria-pressed="'+sel+'"><span class="dot" style="background:'+colorOf(p,i)+'"></span><span>'+esc(p.name)+'</span>'+(sel?'<svg class="check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>':'')+'</button>';}).join('')+
       (S.addOpen?addPlaceBox('np'):'<button class="btn btn-dashed btn-block" data-act="openAdd">+ Agregar nuevo lugar</button>')+'</div></div>';
    h+='<div class="card between" id="pago-box" style="padding:12px 16px"'+(pago?'':' hidden')+'><span class="sub" style="font-size:14px">Monto de este turno</span><strong class="num" id="pago-txt" style="font-size:17px">'+plata(pago)+'</strong></div>';
    h+='<button class="btn btn-primary btn-block" style="height:54px;font-size:16px" data-act="save">Guardar turno</button>';
    if(S.error)h+='<div class="err" role="alert">'+esc(S.error)+'</div>';
    return h;
  };

  function render(){
    if(S.status==='loading'){app.innerHTML='<div class="head"><div class="eyebrow">Cargando turnos…</div><h1>Mis turnos</h1></div>';return;}
    if(S.status==='nodb'){app.innerHTML='<div class="head"><div class="eyebrow">No se pudieron abrir los datos</div><h1>Mis turnos</h1></div><div class="empty">Este navegador no permite guardar datos (por ejemplo, en modo incógnito). Ábrela en una ventana normal.</div>';return;}
    var y=window.scrollY;
    app.innerHTML='<div class="screen" style="display:flex;flex-direction:column;gap:20px">'+V[S.screen]()+'</div>';
    ['inicio','cobros','historial','lugares'].forEach(function(k){var t=document.getElementById('tab-'+k);var on=S.screen===k||(k==='inicio'&&(S.screen==='realizadas'||S.screen==='programadas'));if(on)t.setAttribute('aria-current','page');else t.removeAttribute('aria-current');});
    return y;
  }
  function go(k){S.screen=k;S.openShift=null;S.confirmDel=null;S.addOpen=false;S.nl={name:'',rate:''};S.error='';if(k==='nuevo')S.form=newForm();render();window.scrollTo(0,0);}
  function rerender(){var y=window.scrollY;render();window.scrollTo(0,y);}

  async function write(fn,okMsg){
    try{await fn();if(okMsg)toast(okMsg);}
    catch(e){var c=e&&e.code;toast(c==='QuotaExceededError'||(e&&e.name==='QuotaExceededError')?'Se llenó el espacio del navegador. Descarga un respaldo y elimina turnos antiguos.':'No se pudo guardar. Inténtalo de nuevo.');}
  }

  document.addEventListener('click',function(ev){
    var g=ev.target.closest('[data-go]'); if(g){ev.preventDefault();go(g.getAttribute('data-go'));return;}
    var b=ev.target.closest('[data-act]'); if(!b)return;
    var a=b.getAttribute('data-act'), id=b.getAttribute('data-id');
    if(a==='toggleShift'){S.openShift=S.openShift===id?null:id;S.confirmDel=null;rerender();}
    else if(a==='askDel'){S.confirmDel=id;rerender();}
    else if(a==='cancelDel'){S.confirmDel=null;rerender();}
    else if(a==='doDel'){S.openShift=null;S.confirmDel=null;write(function(){return Store.deleteShift(id);},'Turno eliminado');}
    else if(a==='verCobro'){S.cobroMes=todayKey().slice(0,7);go('cobros');}
    else if(a==='mes'){S.cobroMes=shiftMonth(S.cobroMes,Number(b.getAttribute('data-d')));rerender();}
    else if(a==='hrs'){S.form.hours=Number(b.getAttribute('data-h'));rerender();}
    else if(a==='pick'){S.form.placeId=id;S.error='';rerender();}
    else if(a==='openAdd'){S.addOpen=true;rerender();var i=document.querySelector('[data-nl="name"]');if(i)i.focus();}
    else if(a==='cancelAdd'){S.addOpen=false;S.nl={name:'',rate:''};rerender();}
    else if(a==='saveAdd'){
      var name=(S.nl.name||'').trim(); if(!name){toast('Escribe el nombre del lugar');return;}
      var ex=S.places.filter(function(p){return p.name.toLowerCase()===name.toLowerCase();})[0];
      if(ex){S.form.placeId=ex.id;S.addOpen=false;S.nl={name:'',rate:''};rerender();toast('Ese lugar ya existe');return;}
      var newId=Store.newPlaceId(); var maxO=S.places.reduce(function(m,p){return Math.max(m,Number(p.order)||0);},0);
      var body={id:newId,name:name,rate:Number(S.nl.rate)||0,color:S.places.length%PAL.length,order:maxO+1};
      if(S.screen==='nuevo')S.form.placeId=newId;
      S.addOpen=false;S.nl={name:'',rate:''};
      write(function(){return Store.addPlace(body);},'Lugar agregado');
    }
    else if(a==='save'){
      var f=S.form, hrs=Number(f.hours);
      if(!f.placeId){S.error='Elige el lugar del turno.';rerender();return;}
      if(!f.date||!(hrs>0)){S.error='Revisa el día y la cantidad de horas.';rerender();return;}
      var pl=placeById(f.placeId);
      var data={date:f.date,start:f.start||'08:00',hours:hrs,placeId:f.placeId,placeName:pl?pl.name:'',createdAt:new Date().toISOString()};
      var dest=f.date>=todayKey()?'inicio':'historial';
      write(function(){return Store.addShift(data);},'Turno guardado');
      go(dest);
    }
    else if(a==='backup'){download('turnos-respaldo-'+todayKey()+'.json',Store.exportJSON(),'application/json');toast('Respaldo descargado');}
    else if(a==='csv'){download('turnos-'+todayKey()+'.csv',toCSV(),'text/csv;charset=utf-8');}
    else if(a==='copy'){
      var pre=document.getElementById('msg-'+id); var txt=pre?pre.textContent:'';
      try{navigator.clipboard.writeText(txt).then(function(){toast('Mensaje copiado');},function(){fallbackCopy(pre);});}catch(e){fallbackCopy(pre);}
    }
  });
  function download(name,text,type){var blob=new Blob([type.indexOf('csv')>=0?'\ufeff'+text:text],{type:type});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);}
  function csvCell(v){v=String(v==null?'':v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function toCSV(){var rows=[['Fecha','Día','Inicio','Término','Horas','Lugar','Valor hora','Monto']];sorted().forEach(function(s){rows.push([s.date,DOWL[parse(s.date).getDay()],s.start,finCorto(s.start,s.hours),String(s.hours).replace('.',','),s.place,s.rate||'',s.rate?Math.round(s.pago):'']);});return rows.map(function(r){return r.map(csvCell).join(';');}).join('\r\n');}
  function fallbackCopy(pre){if(!pre)return;var d=pre.closest('details');if(d)d.open=true;var r=document.createRange();r.selectNodeContents(pre);var s=window.getSelection();s.removeAllRanges();s.addRange(r);toast('Texto seleccionado: cópialo manualmente');}

  document.addEventListener('input',function(ev){
    var t=ev.target;
    if(t.dataset.f){S.form[t.dataset.f]=t.value;S.error='';
      var fin=document.getElementById('fin-txt'); if(fin)fin.textContent='Termina a las '+finLargo(S.form.start,Number(S.form.hours)||0);
      if(t.dataset.f==='hours')document.querySelectorAll('.chip').forEach(function(c){c.setAttribute('aria-pressed',String(Number(c.dataset.h)===Number(t.value)));});
      var pl=placeById(S.form.placeId), pago=pl&&Number(pl.rate)>0?Number(pl.rate)*(Number(S.form.hours)||0):0;
      var pb=document.getElementById('pago-box'); if(pb){pb.hidden=!pago;document.getElementById('pago-txt').textContent=plata(pago);}
    }
    if(t.dataset.nl){S.nl[t.dataset.nl]=t.value;}
  });
  document.addEventListener('change',function(ev){
    var t=ev.target;
    if(t.id==='restore-file'&&t.files&&t.files[0]){
      var file=t.files[0];
      if(!window.confirm('¿Reemplazar todos los datos de este teléfono con el respaldo «'+file.name+'»?')){t.value='';return;}
      file.text().then(function(txt){return Store.importJSON(txt);}).then(function(){toast('Respaldo restaurado');},function(){toast('Ese archivo no es un respaldo válido de la app.');});
      t.value='';return;
    }
    if(t.dataset.rate){var id=t.dataset.rate,v=Number(t.value)||0;write(function(){return Store.updatePlace(id,{rate:v});},'Valor por hora guardado');}
    if(t.dataset.perfil){var k=t.dataset.perfil,val=t.value.trim();var patch={};patch[k]=val;S.perfil[k]=val;write(function(){return Store.setPerfil(patch);},'Guardado');}
    if(t.dataset.opt){S[t.dataset.opt]=t.checked;lsSet(t.dataset.opt,t.checked);rerender();}
  });

  function busy(){var a=document.activeElement;return a&&(a.tagName==='INPUT'||a.tagName==='SELECT'||a.tagName==='TEXTAREA')&&app.contains(a);}
  var pending=false;
  function liveRender(){ if(busy()){pending=true;return;} rerender(); }
  document.addEventListener('focusout',function(){setTimeout(function(){if(pending&&!busy()){pending=false;rerender();}},0);});

  function apply(st){S.places=st.places;S.shifts=st.shifts.filter(function(x){return typeof x.date==='string'&&x.date.length===10;});S.perfil=st.perfil;S.lastBackup=st.lastBackup;}
  render();
  (async function(){
    try{ apply(await Store.init()); }catch(e){ S.status='nodb'; render(); return; }
    S.status='ok'; render();
    Store.subscribe(function(st){ apply(st); liveRender(); });
  })();
})();
