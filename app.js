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
    screen:'inicio', cobroMes:todayKey().slice(0,7), openShift:null, confirmDel:null, editId:null, backTo:'inicio', editPlace:null, pe:null,
    form:null, addOpen:false, nl:{name:'',rate:'',rateNoche:''}, error:'', editNombre:false,
    sync:{status:'off',email:'',pending:0,lastSync:null}, auth:{mode:'entrar',email:'',pass:'',busy:false},
    optMonto:lsGet('optMonto',false)
  };
  function newForm(){return {date:todayKey(),start:'08:00',hours:12,placeId:'',feriado:false};}
  S.form=newForm();

  var app=document.getElementById('app');
  var toastEl=document.getElementById('toast'); var toastT;
  function toast(t){toastEl.textContent=t;toastEl.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.hidden=true;},2600);}

  function placeById(id){for(var i=0;i<S.places.length;i++){if(S.places[i].id===id)return S.places[i];}return null;}
  function colorOf(pl,idx){return 'var('+PAL[((pl&&pl.color!=null?pl.color:idx)||0)%PAL.length]+')';}
  // Horario de día; el resto de las horas se cobra como noche.
  var DIA_INI=8*60, DIA_FIN=24*60;
  // Horas dentro del horario de día; con sinFinde, las de sábado y domingo no cuentan como día.
  function horasDia(date,start,h,sinFinde){
    var dow0=date?parse(date).getDay():1, t0=mins(start,0), t1=t0+Math.round((Number(h)||0)*60), m=0;
    for(var d=Math.floor(t0/1440)-1;d<=Math.floor(t1/1440);d++){
      var dow=((dow0+d)%7+7)%7; if(sinFinde&&(dow===0||dow===6))continue;
      var a=Math.max(t0,d*1440+DIA_INI),b=Math.min(t1,d*1440+DIA_FIN);if(b>a)m+=b-a;
    }
    return m/60;
  }
  // Si falta una de las dos tarifas, se usa la otra.
  function tarifas(pl){var d=pl&&Number(pl.rate)>0?Number(pl.rate):0,n=pl&&Number(pl.rateNoche)>0?Number(pl.rateNoche):0;return {dia:d||n,noche:n||d};}
  function feriadoNoche(pl,feriado){return !!(feriado&&pl&&pl.feriadoNoche);}
  function calc(pl,date,start,h,feriado){
    h=Number(h)||0;
    var fer=feriadoNoche(pl,feriado), hd=fer?0:horasDia(date,start,h,!!(pl&&pl.findeNoche)), hn=h-hd, r=tarifas(pl);
    var finde=!fer&&hd<horasDia(date,start,h,false);
    return {hDia:hd,hNoche:hn,rate:r.dia,pago:hd*r.dia+hn*r.noche,feriado:fer,finde:finde};
  }
  function tramos(hd,hn){return hd&&hn?fmtH(hd)+' h de día y '+fmtH(hn)+' h de noche':hn?'todo de noche':'todo de día';}
  function finTxt(f){
    var h=Number(f.hours)||0,c=calc(placeById(f.placeId),f.date,f.start,h,f.feriado);
    var extra=!h?'':c.feriado?'feriado: todo se paga como noche':tramos(c.hDia,c.hNoche)+(c.finde?' (fin de semana se paga como noche)':'');
    return 'Termina a las '+finLargo(f.start,h)+(extra?' · '+extra:'');
  }
  function deco(s){
    var dt=parse(s.date), pl=placeById(s.placeId), T=todayKey(), n=diffDays(s.date,T);
    var c=calc(pl,s.date,s.start,s.hours,s.feriado);
    return {
      id:s.id, date:s.date, start:s.start, hours:Number(s.hours)||0, placeId:s.placeId,
      place:pl?pl.name:(s.placeName||'Lugar'), color:colorOf(pl,0),
      dow:DOW[dt.getDay()], day:dt.getDate(), mon:MES[dt.getMonth()].slice(0,3),
      largo:DOWL[dt.getDay()]+' '+dt.getDate()+' de '+MES[dt.getMonth()],
      ddmm:pad(dt.getDate())+'/'+pad(dt.getMonth()+1),
      range:s.start+' – '+finCorto(s.start,s.hours), feriado:!!s.feriado,
      rate:c.rate, pago:c.pago, hDia:c.hDia, hNoche:c.hNoche,
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
      '<div class="grow"><div class="row" style="gap:8px"><span class="dot" style="background:'+s.color+'"></span><span class="place">'+esc(s.place)+'</span></div><div class="sub num">'+s.range+(s.feriado?' · Feriado':'')+'</div></div>'+
      '<div class="right"><b class="num">'+fmtH(s.hours)+' h</b><span class="num">'+(showPago?(s.rate?plata(s.pago):'—'):s.rel)+'</span></div></button>';
    if(open){
      h+= conf
        ? '<div class="confirm"><button class="btn btn-sm btn-ghost" style="flex:1" data-act="cancelDel">Cancelar</button><button class="btn btn-sm btn-danger" style="flex:1" data-act="doDel" data-id="'+esc(s.id)+'">Sí, eliminar</button></div>'
        : '<div class="confirm"><button class="btn btn-sm btn-ghost" style="flex:1" data-act="editShift" data-id="'+esc(s.id)+'">Editar</button><button class="btn btn-sm btn-ghost" style="flex:1" data-act="askDel" data-id="'+esc(s.id)+'">Eliminar</button></div>';
    }
    return h+'</div>';
  }
  function backHead(title,sub){return '<div class="head-back"><button class="icon-btn" data-go="inicio" aria-label="Volver">'+ICON_BACK+'</button><div class="head"><h1 style="font-size:28px">'+title+'</h1>'+(sub?'<div class="eyebrow cap">'+sub+'</div>':'')+'</div></div>';}
  function bar(d){return '<div class="bar">'+d.map(function(x){return '<div style="width:'+x.pct+'%;background:'+x.color+'"></div>';}).join('')+'</div>';}

  function tiempos(s){var p=s.date.split('-').map(Number),q=(s.start||'00:00').split(':').map(Number),a=new Date(p[0],p[1]-1,p[2],q[0],q[1]).getTime();return {ini:a,fin:a+(Number(s.hours)||0)*3600000};}
  function duracion(ms){var m=Math.max(1,Math.ceil(ms/60000)),h=Math.floor(m/60);m=m%60;return h?h+' h'+(m?' '+m+' min':''):m+' min';}
  var RETENCION=0.1525; // retención boleta de honorarios 2026
  function liquido(n){return n*(1-RETENCION);}
  var DIA_MS=86400000;
  function avisoRespaldo(){
    if(!S.shifts.length||Date.now()<lsGet('backupSnooze',0))return '';
    var dias=S.lastBackup?Math.floor((Date.now()-new Date(S.lastBackup).getTime())/DIA_MS):null;
    if(dias!==null&&dias<30)return '';
    var txt=dias===null?'Todavía no has descargado un respaldo de tus turnos.':'Tu último respaldo fue hace '+dias+' días.';
    return '<div class="card" role="status" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px"><strong>Descarga un respaldo</strong><div class="sub">'+txt+' Guárdalo en Drive, iCloud o envíatelo por correo.</div>'+
      '<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="snoozeBackup">Ahora no</button><button class="btn btn-sm btn-primary" data-act="backup">Descargar</button></div></div>';
  }
  var V={};
  V.inicio=function(){
    var sp=split(), mk=todayKey().slice(0,7), mesPast=sp.past.filter(function(s){return s.date.slice(0,7)===mk;});
    var now=Date.now(), all=sorted(), dt=parse(todayKey());
    var curso=all.filter(function(s){var t=tiempos(s);return t.ini<=now&&now<t.fin;})[0];
    var futuros=all.filter(function(s){return tiempos(s).ini>now;});
    var nx=curso||futuros[0], rest=futuros.filter(function(s){return s!==nx;});
    var h='<div class="head"><div class="eyebrow cap">'+DOWL[dt.getDay()]+' '+dt.getDate()+' de '+MES[dt.getMonth()]+'</div><h1>Mis turnos</h1></div>';
    h+='<div class="tiles"><button class="tile" data-go="realizadas">'+ICON_CHEV+'<small>Realizadas en '+MES[dt.getMonth()]+'</small><span class="big num">'+fmtH(sumH(mesPast))+' h</span><small>'+mesPast.length+(mesPast.length===1?' turno':' turnos')+'</small></button>'+
       '<button class="tile" data-go="programadas">'+ICON_CHEV+'<small>Programadas</small><span class="big num">'+fmtH(sumH(sp.up))+' h</span><small>'+sp.up.length+(sp.up.length===1?' turno próximo':' turnos próximos')+'</small></button></div>';
    h+=avisoRespaldo();
    if(nx){
      var tn=tiempos(nx);
      var etiqueta=curso?'Turno en curso':'Próximo turno';
      var pill=curso?'Quedan '+duracion(tn.fin-now):tn.ini-now<12*3600000?'En '+duracion(tn.ini-now):nx.rel;
      var abierto=S.openShift===nx.id;
      h+='<div class="hero" data-act="toggleShift" data-id="'+esc(nx.id)+'" role="button" tabindex="0" aria-expanded="'+abierto+'" style="cursor:pointer"><div class="between"><span class="label">'+etiqueta+'</span><span class="pill">'+pill+'</span></div>'+
         '<div class="head"><div class="big cap" style="font-size:26px">'+nx.largo+'</div><div style="font-size:16px">'+esc(nx.place)+'</div></div>'+
         '<div class="row" style="gap:20px;font-size:14px"><span class="num">'+nx.range+(nx.feriado?' · Feriado':'')+'</span><strong class="num">'+fmtH(nx.hours)+' h</strong></div>'+
         (!abierto?'':S.confirmDel===nx.id
           ?'<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="cancelDel">Cancelar</button><button class="btn btn-sm btn-danger" data-act="doDel" data-id="'+esc(nx.id)+'">Sí, eliminar</button></div>'
           :'<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="editShift" data-id="'+esc(nx.id)+'">Editar</button><button class="btn btn-sm btn-ghost" data-act="askDel" data-id="'+esc(nx.id)+'">Eliminar</button></div>')+'</div>';
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
  function listaY(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' y '+a[a.length-1];}
  function mensaje(pl,items,mk){
    var horas=sumH(items), mes=MES[Number(mk.slice(5))-1];
    var dias=[];items.forEach(function(s){if(dias.indexOf(s.day)<0)dias.push(s.day);});
    var m='Hola Doctoor,\n'+(dias.length===1?'El refuerzo de '+mes+' sería el '+dias[0]:'Los refuerzos de '+mes+' serían '+listaY(dias))+
      '\n'+(horas===1?'Sería 1 hora':'Serían '+fmtH(horas)+' horas');
    if(S.optMonto&&sumP(items)>0){m+='\nTotal: '+plata(sumP(items));}
    return m;
  }
  V.cobros=function(){
    var mk=S.cobroMes, T=todayKey(), all=sorted();
    var hechos=all.filter(function(s){return s.date<T&&s.date.slice(0,7)===mk;});
    var prog=all.filter(function(s){return s.date>=T&&s.date.slice(0,7)===mk;});
    var por=[];
    S.places.forEach(function(p,i){var it=hechos.filter(function(s){return s.placeId===p.id;});if(it.length)por.push({p:p,i:i,items:it});});
    var sinTarifa=por.some(function(x){return !tarifas(x.p).dia;});
    var h='<div class="head"><div class="eyebrow">Turnos realizados por cobrar</div><h1>Cobros</h1></div>';
    h+='<div class="month-nav"><button class="icon-btn" data-act="mes" data-d="-1" aria-label="Mes anterior">'+ICON_BACK+'</button><strong class="cap" style="font-size:16px">'+monthLabel(mk)+'</strong><button class="icon-btn" data-act="mes" data-d="1" aria-label="Mes siguiente" style="transform:scaleX(-1)">'+ICON_BACK+'</button></div>';
    h+='<div class="hero" style="gap:6px"><span class="label">Total bruto a cobrar</span><span class="big num" style="font-size:40px">'+plata(sumP(hechos))+'</span><span style="font-size:15px">Líquido aprox.: <strong class="num">'+plata(liquido(sumP(hechos)))+'</strong></span><span style="font-size:14px">'+hechos.length+(hechos.length===1?' turno':' turnos')+' · '+fmtH(sumH(hechos))+' h en '+por.length+(por.length===1?' lugar':' lugares')+'</span>'+
       (prog.length?'<div style="margin-top:8px;padding-top:10px;border-top:1px solid var(--accent-soft);font-size:14px">Con los '+prog.length+' turnos programados del mes: <strong class="num">'+plata(sumP(hechos)+sumP(prog))+'</strong> bruto · <span class="num">'+plata(liquido(sumP(hechos)+sumP(prog)))+'</span> líquido</div>':'')+'</div>';
    if(sinTarifa)h+='<div class="note">Hay lugares sin valor por hora. Defínelo en <button data-go="lugares" style="border:none;background:none;padding:0;color:var(--accent);font-weight:600;text-decoration:underline">Lugares</button> para calcular el monto.</div>';
    h+='<section class="list"><div class="between"><h2>Por lugar</h2></div>';
    if(!por.length)h+='<div class="empty">No hay turnos realizados en '+MES[Number(mk.slice(5))-1]+'.</div>';
    else{
      h+='<div class="card toggles" style="padding:8px 14px"><span class="sub" style="padding-top:4px">El mensaje incluye:</span><label class="toggle"><input type="checkbox" id="opt-monto" data-opt="optMonto"'+(S.optMonto?' checked':'')+'> Monto a cobrar</label></div>';
    }
    por.forEach(function(x){
      var hs=sumH(x.items), r=tarifas(x.p), msg=mensaje(x.p,x.items,mk);
      var hd=x.items.reduce(function(a,s){return a+s.hDia;},0), hn=hs-hd;
      var wa='https://wa.me/?text='+encodeURIComponent(msg);
      var tarifaTxt=!r.dia?' · sin valor por hora':r.dia===r.noche?' × '+plata(r.dia)+'/h':'';
      var desg=hn?'<div class="sub num">'+fmtH(hd)+' h día'+(r.dia&&r.dia!==r.noche?' × '+plata(r.dia):'')+' · '+fmtH(hn)+' h noche'+(r.dia&&r.dia!==r.noche?' × '+plata(r.noche):'')+'</div>':'';
      h+='<div class="card cobro"><div class="row"><span class="dot" style="background:'+colorOf(x.p,x.i)+'"></span><span class="place" style="flex:1">'+esc(x.p.name)+'</span><span class="amount num">'+(r.dia?plata(sumP(x.items)):'—')+'</span></div>'+
        '<div class="sub num">'+x.items.length+(x.items.length===1?' turno':' turnos')+' · '+fmtH(hs)+' h'+tarifaTxt+'</div>'+desg+
        (r.dia?'<div class="sub num">Bruto '+plata(sumP(x.items))+' · líquido aprox. <strong>'+plata(liquido(sumP(x.items)))+'</strong></div>':'')+
        '<div class="tags">'+x.items.map(function(s){return '<span class="tag num">'+s.dow+' '+s.day+' · '+fmtH(s.hours)+' h</span>';}).join('')+'</div>'+
        '<details><summary>Ver mensaje</summary><pre class="msg" id="msg-'+esc(x.p.id)+'">'+esc(msg)+'</pre></details>'+
        '<div class="grid2"><a class="btn btn-sm btn-wa" href="'+esc(wa)+'" target="_blank" rel="noopener">'+ICON_WA+' WhatsApp</a><button class="btn btn-sm btn-ghost" data-act="copy" data-id="'+esc(x.p.id)+'">'+ICON_COPY+' Copiar</button></div></div>';
    });
    return h+'</section>';
  };
  function addPlaceBox(prefix){
    return '<div class="box"><div class="lbl">Nuevo lugar</div><div class="field"><label for="'+prefix+'-nombre">Nombre</label><input class="input" id="'+prefix+'-nombre" data-nl="name" placeholder="Ej: Hospital del Salvador" value="'+esc(S.nl.name)+'" autocomplete="off"></div>'+
      '<div class="grid2"><div class="field"><label for="'+prefix+'-valor">Hora día ($)</label><input class="input" id="'+prefix+'-valor" data-nl="rate" type="number" inputmode="numeric" min="0" step="500" placeholder="Opcional" value="'+esc(S.nl.rate)+'"></div>'+
      '<div class="field"><label for="'+prefix+'-valor-n">Hora noche ($)</label><input class="input" id="'+prefix+'-valor-n" data-nl="rateNoche" type="number" inputmode="numeric" min="0" step="500" placeholder="Igual a día" value="'+esc(S.nl.rateNoche)+'"></div></div>'+
      '<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="cancelAdd">Cancelar</button><button class="btn btn-sm btn-primary" data-act="saveAdd">Agregar</button></div></div>';
  }
  function syncCard(){
    var y=S.sync, a=S.auth, dis=a.busy?' disabled':'';
    if(y.status==='off')return '';
    var h='<section class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><h2>Sincronización en la nube</h2>';
    if(y.status==='out'){
      var crear=a.mode==='crear';
      h+='<div class="note">'+(crear?'Crea una cuenta con tu correo y una contraseña de al menos 8 caracteres. Se pide una sola vez en cada teléfono.':'Entra con tu correo y contraseña para guardar los turnos en la nube y verlos en otros dispositivos. Se pide una sola vez en cada teléfono.')+'</div>'+
         '<form id="auth-form" style="display:flex;flex-direction:column;gap:10px" novalidate>'+
         '<div class="field"><label for="auth-email">Correo</label><input class="input" id="auth-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" data-auth="email" value="'+esc(a.email)+'"></div>'+
         '<div class="field"><label for="auth-pass">Contraseña</label><input class="input" id="auth-pass" name="password" type="password" autocomplete="'+(crear?'new-password':'current-password')+'" minlength="8" data-auth="pass" value="'+esc(a.pass)+'"></div>'+
         '<button type="submit" class="btn btn-sm btn-primary"'+dis+'>'+(a.busy?(crear?'Creando…':'Entrando…'):(crear?'Crear cuenta':'Entrar'))+'</button></form>'+
         '<button class="btn btn-sm btn-ghost"'+dis+' data-act="authMode">'+(crear?'Ya tengo cuenta':'Primera vez: crear cuenta')+'</button>';
      return h+'</section>';
    }
    var ls=y.lastSync?new Date(y.lastSync):null;
    var est=y.status==='syncing'?'Sincronizando…'
      :y.status==='ok'?'Todo sincronizado'+(ls?' · '+ls.getDate()+' de '+MES[ls.getMonth()]+', '+pad(ls.getHours())+':'+pad(ls.getMinutes()):'')
      :y.status==='offline'?'Sin conexión. Los cambios quedan en el teléfono y se subirán solos.'
      :'No se pudo sincronizar. Inténtalo de nuevo.';
    if(y.pending&&y.status!=='ok')est+=' ('+y.pending+(y.pending===1?' cambio pendiente)':' cambios pendientes)');
    h+='<div class="sub">Sesión iniciada con <strong>'+esc(y.email)+'</strong></div><div class="note" role="status">'+est+'</div>'+
       '<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="syncNow"'+(y.status==='syncing'?' disabled':'')+'>Sincronizar ahora</button><button class="btn btn-sm btn-ghost" data-act="signOut">Cerrar sesión</button></div>';
    return h+'</section>';
  }
  function authErr(e){
    var m=((e&&e.code||'')+' '+(e&&e.message||'')).toLowerCase();
    if(m.indexOf('invalid_credentials')>=0||m.indexOf('invalid login')>=0)return 'Correo o contraseña incorrectos.';
    if(m.indexOf('already')>=0||m.indexOf('user_already_exists')>=0)return 'Ese correo ya tiene cuenta. Usa «Ya tengo cuenta» para entrar.';
    if(m.indexOf('weak_password')>=0||m.indexOf('password should')>=0)return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
    if(m.indexOf('confirm')>=0)return 'Falta un ajuste en Supabase: desactivar la confirmación por correo.';
    if(m.indexOf('signup')>=0&&m.indexOf('disabled')>=0)return 'No se pueden crear cuentas nuevas. Usa «Ya tengo cuenta».';
    if(m.indexOf('rate')>=0||(e&&e.status===429))return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    if(navigator.onLine===false||m.indexOf('fetch')>=0)return 'Sin conexión. Conéctate a internet para entrar.';
    return 'No se pudo completar. Inténtalo de nuevo.';
  }
  async function authStep(fn,next){
    S.auth.busy=true;rerender();
    try{await fn();if(next)next();}
    catch(e){console.error(e);toast(authErr(e));}
    S.auth.busy=false;rerender();
  }
  V.lugares=function(){
    var h='<div class="head"><div class="eyebrow">Centros donde hace turnos</div><h1>Lugares</h1></div><div class="list">';
    if(!S.places.length)h+='<div class="empty">Aún no hay lugares. Agrega el primero.</div>';
    S.places.forEach(function(p,i){
      var dot='<span class="dot" style="width:12px;height:12px;background:'+colorOf(p,i)+'"></span>';
      if(S.editPlace!==p.id){h+='<div class="card place-row"><button class="dot-btn" data-act="editPlace" data-color="1" data-id="'+esc(p.id)+'" aria-label="Cambiar color de '+esc(p.name)+'">'+dot+'</button><span class="place grow">'+esc(p.name)+'</span><button class="btn btn-sm btn-ghost" data-act="editPlace" data-id="'+esc(p.id)+'">Editar</button></div>';return;}
      var e=S.pe;
      h+='<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px"><div class="row" style="gap:10px"><button class="dot-btn" data-act="peColorToggle" aria-expanded="'+!!S.peColorOpen+'" aria-label="Cambiar color"><span class="dot" style="width:12px;height:12px;background:var('+PAL[e.color]+')"></span></button><strong>Editar lugar</strong></div>'+
         '<div class="field"><label for="pe-name">Nombre</label><input class="input" id="pe-name" data-pe="name" value="'+esc(e.name)+'" autocomplete="off"></div>'+
         (!S.peColorOpen?'':'<div class="field"><span class="lbl">Color</span><div class="swatches">'+PAL.map(function(v,ci){return '<button class="swatch" data-act="peColor" data-c="'+ci+'" aria-pressed="'+(e.color===ci)+'" aria-label="Color '+(ci+1)+'" style="background:var('+v+')"></button>';}).join('')+'</div></div>')+
         '<div class="grid2"><div class="field"><label for="pe-rate">Hora día ($)</label><input class="input num" id="pe-rate" data-pe="rate" type="number" inputmode="numeric" min="0" step="500" placeholder="Sin valor" value="'+esc(e.rate)+'"></div>'+
         '<div class="field"><label for="pe-noche">Hora noche ($)</label><input class="input num" id="pe-noche" data-pe="rateNoche" type="number" inputmode="numeric" min="0" step="500" placeholder="Igual a día" value="'+esc(e.rateNoche)+'"></div></div>'+
         '<div class="toggles"><label class="toggle"><input type="checkbox" data-pe="feriadoNoche"'+(e.feriadoNoche?' checked':'')+'> Feriado se paga como noche</label>'+
         '<label class="toggle"><input type="checkbox" data-pe="findeNoche"'+(e.findeNoche?' checked':'')+'> Fin de semana se paga como noche</label></div>'+
         '<div class="grid2"><button class="btn btn-sm btn-ghost" data-act="cancelPlace">Cancelar</button><button class="btn btn-sm btn-primary" data-act="savePlace" data-id="'+esc(p.id)+'">Guardar</button></div></div>';
    });
    h+='</div>'+(S.addOpen?addPlaceBox('lp'):'<button class="btn btn-dashed btn-block" data-act="openAdd">+ Agregar lugar</button>');
    h+=syncCard();
    var lb=S.lastBackup?new Date(S.lastBackup):null, enNube=S.sync.email!=='';
    h+='<section class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px"><h2>Respaldo de datos</h2><div class="note">'+(enNube?'Los turnos se guardan en la nube y en este teléfono. Igual puedes descargar un respaldo propio cuando quieras.':'Los turnos se guardan solo en este teléfono. Descarga un respaldo cada cierto tiempo y guárdalo en Drive, iCloud o envíatelo por correo.')+'</div>'+
       '<div class="sub">'+(lb?'Último respaldo: '+lb.getDate()+' de '+MES[lb.getMonth()]+' '+lb.getFullYear():'Todavía no hay respaldos.')+'</div>'+
       '<div class="grid2"><button class="btn btn-sm btn-primary" data-act="backup">Descargar respaldo</button><button class="btn btn-sm btn-ghost" data-act="csv">Exportar a Excel</button></div>'+
       '<label class="btn btn-sm btn-dashed btn-block" for="restore-file" style="cursor:pointer">Restaurar desde un respaldo</label><input type="file" id="restore-file" accept="application/json,.json" hidden></section>';
    return h;
  };
  V.nuevo=function(){
    var f=S.form, pago=calc(placeById(f.placeId),f.date,f.start,f.hours,f.feriado).pago;
    var ed=!!S.editId;
    var h='<div class="head-back"><button class="icon-btn" data-go="'+(ed?S.backTo:'inicio')+'" aria-label="Volver">'+ICON_BACK+'</button><h1 style="font-size:28px">'+(ed?'Editar turno':'Nuevo turno')+'</h1></div>';
    h+='<div class="grid2"><div class="field"><label for="f-fecha">Día</label><input class="input" id="f-fecha" type="date" data-f="date" value="'+esc(f.date)+'"></div><div class="field"><label for="f-inicio">Hora de inicio</label><input class="input" id="f-inicio" type="time" data-f="start" value="'+esc(f.start)+'"></div></div>';
    h+='<div class="field"><label for="f-horas">Cantidad de horas</label><div class="chips">'+[6,8,12,24].map(function(x){return '<button class="chip num" data-act="hrs" data-h="'+x+'" aria-pressed="'+(Number(f.hours)===x)+'">'+x+' h</button>';}).join('')+
       '<input class="input num" id="f-horas" type="number" inputmode="decimal" min="0.5" max="48" step="0.5" data-f="hours" value="'+([6,8,12,24].indexOf(Number(f.hours))<0?esc(f.hours):'')+'" placeholder="Otra" aria-label="Otra cantidad de horas" aria-pressed="'+([6,8,12,24].indexOf(Number(f.hours))<0&&Number(f.hours)>0)+'" style="width:72px;height:44px;text-align:center"></div><div class="sub" id="fin-txt">'+finTxt(f)+'</div>'+
       '<label class="toggle"><input type="checkbox" id="f-feriado" data-fcheck="feriado"'+(f.feriado?' checked':'')+'> Es feriado</label></div>';
    h+='<div class="field"><span class="lbl">Lugar</span><div class="list" style="gap:8px">'+S.places.map(function(p,i){var sel=f.placeId===p.id;return '<button class="opt" data-act="pick" data-id="'+esc(p.id)+'" aria-pressed="'+sel+'"><span class="dot" style="background:'+colorOf(p,i)+'"></span><span>'+esc(p.name)+'</span>'+(sel?'<svg class="check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>':'')+'</button>';}).join('')+
       (S.addOpen?addPlaceBox('np'):'<button class="btn btn-dashed btn-block" data-act="openAdd">+ Agregar nuevo lugar</button>')+'</div></div>';
    h+='<div class="card between" id="pago-box" style="padding:12px 16px"'+(pago?'':' hidden')+'><span class="sub" style="font-size:14px">Monto de este turno</span><strong class="num" id="pago-txt" style="font-size:17px">'+plata(pago)+'</strong></div>';
    h+='<button class="btn btn-primary btn-block" style="height:54px;font-size:16px" data-act="save">'+(ed?'Guardar cambios':'Guardar turno')+'</button>';
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
  function go(k){S.screen=k;S.openShift=null;S.confirmDel=null;S.addOpen=false;S.nl={name:'',rate:'',rateNoche:''};S.error='';S.editId=null;S.editPlace=null;if(k==='nuevo')S.form=newForm();render();window.scrollTo(0,0);}
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
    else if(a==='editShift'){
      var sh=S.shifts.filter(function(x){return x.id===id;})[0]; if(!sh)return;
      var from=S.screen;
      go('nuevo');
      S.editId=id;S.backTo=from;S.form={date:sh.date,start:sh.start,hours:Number(sh.hours)||0,placeId:placeById(sh.placeId)?sh.placeId:'',feriado:!!sh.feriado};
      render();
    }
    else if(a==='askDel'){S.confirmDel=id;rerender();}
    else if(a==='cancelDel'){S.confirmDel=null;rerender();}
    else if(a==='doDel'){S.openShift=null;S.confirmDel=null;write(function(){return Store.deleteShift(id);},'Turno eliminado');}
    else if(a==='verCobro'){S.cobroMes=todayKey().slice(0,7);go('cobros');}
    else if(a==='mes'){S.cobroMes=shiftMonth(S.cobroMes,Number(b.getAttribute('data-d')));rerender();}
    else if(a==='hrs'){S.form.hours=Number(b.getAttribute('data-h'));rerender();}
    else if(a==='pick'){S.form.placeId=id;S.error='';rerender();}
    else if(a==='editPlace'){
      var ep=placeById(id); if(!ep)return;
      S.editPlace=id;S.peColorOpen=b.getAttribute('data-color')==='1';S.pe={color:(Number(ep.color)||0)%PAL.length,name:ep.name,rate:Number(ep.rate)>0?Number(ep.rate):'',rateNoche:Number(ep.rateNoche)>0?Number(ep.rateNoche):'',feriadoNoche:!!ep.feriadoNoche,findeNoche:!!ep.findeNoche};rerender();
    }
    else if(a==='peColor'){S.pe.color=Number(b.getAttribute('data-c'));S.peColorOpen=false;rerender();}
    else if(a==='peColorToggle'){S.peColorOpen=!S.peColorOpen;rerender();}
    else if(a==='cancelPlace'){S.editPlace=null;rerender();}
    else if(a==='savePlace'){
      var e=S.pe, nm=(e.name||'').trim(), num=function(v){return Math.max(0,Math.round(Number(v)||0));};
      if(!nm){toast('Escribe el nombre del lugar');return;}
      if(S.places.some(function(p){return p.id!==id&&p.name.toLowerCase()===nm.toLowerCase();})){toast('Ya hay otro lugar con ese nombre');return;}
      S.editPlace=null;
      write(function(){return Store.updatePlace(id,{name:nm,color:e.color,rate:num(e.rate),rateNoche:num(e.rateNoche),feriadoNoche:!!e.feriadoNoche,findeNoche:!!e.findeNoche});},'Lugar guardado');
    }
    else if(a==='openAdd'){S.addOpen=true;rerender();var i=document.querySelector('[data-nl="name"]');if(i)i.focus();}
    else if(a==='cancelAdd'){S.addOpen=false;S.nl={name:'',rate:'',rateNoche:''};rerender();}
    else if(a==='saveAdd'){
      var name=(S.nl.name||'').trim(); if(!name){toast('Escribe el nombre del lugar');return;}
      var ex=S.places.filter(function(p){return p.name.toLowerCase()===name.toLowerCase();})[0];
      if(ex){S.form.placeId=ex.id;S.addOpen=false;S.nl={name:'',rate:'',rateNoche:''};rerender();toast('Ese lugar ya existe');return;}
      var newId=Store.newPlaceId(); var maxO=S.places.reduce(function(m,p){return Math.max(m,Number(p.order)||0);},0);
      var body={id:newId,name:name,rate:Number(S.nl.rate)||0,rateNoche:Number(S.nl.rateNoche)||0,color:S.places.length%PAL.length,order:maxO+1};
      if(S.screen==='nuevo')S.form.placeId=newId;
      S.addOpen=false;S.nl={name:'',rate:'',rateNoche:''};
      write(function(){return Store.addPlace(body);},'Lugar agregado');
    }
    else if(a==='save'){
      var f=S.form, hrs=Number(f.hours);
      if(!f.placeId){S.error='Elige el lugar del turno.';rerender();return;}
      if(!f.date||!(hrs>0)){S.error='Revisa el día y la cantidad de horas.';rerender();return;}
      var pl=placeById(f.placeId);
      var data={date:f.date,start:f.start||'08:00',hours:hrs,placeId:f.placeId,placeName:pl?pl.name:'',feriado:!!f.feriado};
      if(S.editId){
        var eid=S.editId, back=S.backTo;
        write(function(){return Store.updateShift(eid,data).then(function(ok){if(!ok)throw new Error('gone');});},'Cambios guardados');
        go(back);
      }else{
        data.createdAt=new Date().toISOString();
        var dest=f.date>=todayKey()?'inicio':'historial';
        write(function(){return Store.addShift(data);},'Turno guardado');
        go(dest);
      }
    }
    else if(a==='authMode'){S.auth.mode=S.auth.mode==='crear'?'entrar':'crear';S.auth.pass='';rerender();}
    else if(a==='syncNow'){Store.syncNow();}
    else if(a==='signOut'){
      if(!window.confirm('¿Cerrar sesión? Los turnos quedan en este teléfono, pero dejan de sincronizarse.'))return;
      Store.signOut().then(function(){toast('Sesión cerrada');},function(){toast('No se pudo cerrar la sesión. Inténtalo de nuevo.');});
    }
    else if(a==='snoozeBackup'){lsSet('backupSnooze',Date.now()+7*DIA_MS);rerender();}
    else if(a==='backup'){download('turnos-respaldo-'+todayKey()+'.json',Store.exportJSON(),'application/json');toast('Respaldo descargado');}
    else if(a==='csv'){download('turnos-'+todayKey()+'.csv',toCSV(),'text/csv;charset=utf-8');}
    else if(a==='copy'){
      var pre=document.getElementById('msg-'+id); var txt=pre?pre.textContent:'';
      try{navigator.clipboard.writeText(txt).then(function(){toast('Mensaje copiado');},function(){fallbackCopy(pre);});}catch(e){fallbackCopy(pre);}
    }
  });
  document.addEventListener('submit',function(ev){
    if(ev.target.id!=='auth-form')return;
    ev.preventDefault();
    if(S.auth.busy)return;
    var fd=new FormData(ev.target), em=String(fd.get('email')||'').trim().toLowerCase(), pw=String(fd.get('password')||''), crear=S.auth.mode==='crear';
    S.auth.email=em;S.auth.pass=pw;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){toast('Escribe un correo válido');return;}
    if(pw.length<(crear?8:1)){toast(crear?'La contraseña debe tener al menos 8 caracteres':'Escribe tu contraseña');return;}
    authStep(function(){return crear?Store.signUp(em,pw):Store.signIn(em,pw);},function(){S.auth={mode:'entrar',email:'',pass:'',busy:false};toast(crear?'Cuenta creada':'Sesión iniciada');});
  });
  function download(name,text,type){var blob=new Blob([type.indexOf('csv')>=0?'\ufeff'+text:text],{type:type});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);}
  function csvCell(v){v=String(v==null?'':v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function toCSV(){var coma=function(n){return String(Math.round(n*100)/100).replace('.',',');};var rows=[['Fecha','Día','Inicio','Término','Horas','Horas día','Horas noche','Feriado','Lugar','Valor hora día','Valor hora noche','Monto']];sorted().forEach(function(s){var r=tarifas(placeById(s.placeId));rows.push([s.date,DOWL[parse(s.date).getDay()],s.start,finCorto(s.start,s.hours),coma(s.hours),coma(s.hDia),coma(s.hNoche),s.feriado?'Sí':'',s.place,r.dia||'',r.noche||'',s.rate?Math.round(s.pago):'']);});return rows.map(function(r){return r.map(csvCell).join(';');}).join('\r\n');}
  function fallbackCopy(pre){if(!pre)return;var d=pre.closest('details');if(d)d.open=true;var r=document.createRange();r.selectNodeContents(pre);var s=window.getSelection();s.removeAllRanges();s.addRange(r);toast('Texto seleccionado: cópialo manualmente');}

  document.addEventListener('input',function(ev){
    var t=ev.target;
    if(t.dataset.f){S.form[t.dataset.f]=t.value;S.error='';
      var fin=document.getElementById('fin-txt'); if(fin)fin.textContent=finTxt(S.form);
      if(t.dataset.f==='hours'){document.querySelectorAll('.chip').forEach(function(c){c.setAttribute('aria-pressed',String(Number(c.dataset.h)===Number(t.value)));});t.setAttribute('aria-pressed',String([6,8,12,24].indexOf(Number(t.value))<0&&Number(t.value)>0));}
      var pago=calc(placeById(S.form.placeId),S.form.date,S.form.start,S.form.hours,S.form.feriado).pago;
      var pb=document.getElementById('pago-box'); if(pb){pb.hidden=!pago;document.getElementById('pago-txt').textContent=plata(pago);}
    }
    if(t.dataset.nl){S.nl[t.dataset.nl]=t.value;}
    if(t.dataset.auth){S.auth[t.dataset.auth]=t.value;}
    if(t.dataset.pe&&t.type!=='checkbox'){S.pe[t.dataset.pe]=t.value;}
  });
  document.addEventListener('change',function(ev){
    var t=ev.target;
    if(t.id==='restore-file'&&t.files&&t.files[0]){
      var file=t.files[0];
      if(!window.confirm('¿Reemplazar todos los datos '+(S.sync.email?'(en este teléfono y en la nube)':'de este teléfono')+' con el respaldo «'+file.name+'»?')){t.value='';return;}
      file.text().then(function(txt){return Store.importJSON(txt);}).then(function(){toast('Respaldo restaurado');},function(){toast('Ese archivo no es un respaldo válido de la app.');});
      t.value='';return;
    }
    if(t.dataset.opt){S[t.dataset.opt]=t.checked;lsSet(t.dataset.opt,t.checked);rerender();}
    if(t.dataset.pe&&t.type==='checkbox'){S.pe[t.dataset.pe]=t.checked;}
    if(t.dataset.fcheck){S.form[t.dataset.fcheck]=t.checked;rerender();}
  });

  function busy(){var a=document.activeElement;return a&&(a.tagName==='INPUT'||a.tagName==='SELECT'||a.tagName==='TEXTAREA')&&app.contains(a);}
  var pending=false;
  function liveRender(){ if(busy()){pending=true;return;} rerender(); }
  document.addEventListener('focusout',function(){setTimeout(function(){if(pending&&!busy()){pending=false;rerender();}},0);});

  // Con el teclado abierto, la barra inferior fija tapa el formulario: se oculta mientras se escribe.
  function escribiendo(el){return !!el&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!/checkbox|radio|file/.test(el.type)));}
  document.addEventListener('focusin',function(e){if(escribiendo(e.target))document.body.classList.add('typing');});
  document.addEventListener('focusout',function(){setTimeout(function(){if(!escribiendo(document.activeElement))document.body.classList.remove('typing');},0);});
  // Deslizar de izquierda a derecha = volver (la app instalada en iPhone no tiene gesto propio).
  var sx=null,sy=0;
  document.addEventListener('touchstart',function(e){var t=e.touches[0];sx=e.touches.length===1&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)?t.clientX:null;sy=t.clientY;},{passive:true});
  document.addEventListener('touchend',function(e){
    if(sx==null)return;var t=e.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);sx=null;
    if(dx<80||dy>dx/2)return;
    var b=document.querySelector('.head-back [data-go]');
    if(b)b.click();else if(S.screen!=='inicio')go('inicio');
  },{passive:true});
  function refrescarInicio(){if(S.status==='ok'&&S.screen==='inicio'&&!document.hidden)liveRender();}
  setInterval(refrescarInicio,60000);
  document.addEventListener('visibilitychange',refrescarInicio);
  function apply(st){S.places=st.places;S.shifts=st.shifts.filter(function(x){return typeof x.date==='string'&&x.date.length===10;});S.perfil=st.perfil;S.lastBackup=st.lastBackup;S.sync=st.sync;}
  render();
  (async function(){
    try{ apply(await Store.init()); }catch(e){ S.status='nodb'; render(); return; }
    S.status='ok'; render();
    Store.subscribe(function(st){ apply(st); liveRender(); });
  })();
})();
