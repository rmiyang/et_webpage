import { estimate, observedET, MODEL_VERSION } from './model.js';

const $ = id => document.getElementById(id);
const paths = {
  drop:'M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z M8 15a4 4 0 0 0 4 4',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon:'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z',
  reset:'M3 10a9 9 0 1 1 1 8M3 4v6h6',
  house:'m3 11 9-8 9 8v10H3V11Zm6 10v-7h6v7M12 3v8',
  light:'M7 3h10M9 3v4m6-4v4M6 7h12l3 5H3l3-5ZM6 16v2m6-2v4m6-4v2',
  wind:'M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 17h5a2 2 0 1 1-2 2',
  chevron:'m6 9 6 6 6-6',
  download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  cycle:'M4 9a8 8 0 0 1 14-4l2 3M20 3v5h-5M20 15a8 8 0 0 1-14 4l-2-3M4 21v-5h5'
};
function icon(path, cls='') { return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`; }
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(paths[el.dataset.icon] || paths.drop); });

const systems = [
  {id:'nft',name:'Nutrient Film Technique',short:'NFT · flowing channels',exposure:2,note:'NFT uses a thin recirculating nutrient film. We start with 2% exposed wet area; edit it to match your channel covers.',path:'M3 13h18v4H3v-4Zm3 4v4m12-4v4M6 12V7m0 2C2 9 3 4 6 6c3-3 6 2 0 3Zm12 3V7m0 2c-4 0-3-5 0-3 3-3 6 2 0 3Z'},
  {id:'dwc',name:'Deep Water Culture',short:'DWC · floating rafts',exposure:3,note:'DWC rafts usually cover most nutrient solution. The 3% exposed-area starting assumption represents gaps and planting holes.',path:'M3 10h18v11H3V10Zm0 5c3-3 6 3 9 0s6 3 9 0M7 10V5m0 2C2 7 4 2 7 4c3-2 5 3 0 3Zm10 3V5m0 2c-5 0-3-5 0-3 3-2 5 3 0 3ZM7 18l1 3m8-3 1 3'},
  {id:'drip',name:'Drip / Substrate',short:'Coco, rockwool & perlite',exposure:10,note:'Drip systems can lose water from wet substrate. The 10% assumption approximates an equivalent exposed wet area; drainage belongs in other losses.',path:'M2 4h20M6 4v5m12-5v5M6 10l-1 2m13-2-1 2M3 15h6l-1 6H4l-1-6Zm12 0h6l-1 6h-4l-1-6Z'},
  {id:'ebb',name:'Ebb & Flow',short:'Flood and drain beds',exposure:15,note:'Ebb & flow exposure changes through the pump cycle. Use a daily effective wet-area fraction; the 15% starting value needs measurement.',path:'M3 10h18v7H3v-7Zm4 7v4m10-4v4M3 13c3-2 6 2 9 0s6 2 9 0M8 10V5m0 2C3 7 5 2 8 4c3-2 5 3 0 3Zm9 3V5m0 2c-5 0-3-5 0-3 3-2 5 3 0 3Z'},
  {id:'aero',name:'Aeroponics',short:'Enclosed root misting',exposure:1,note:'An enclosed aeroponic chamber limits exposed water. The 1% effective-area assumption excludes mist escaping the enclosure; record measured extra loss separately.',path:'M4 9h16v12H4V9Zm8 0V4m0 2C6 6 8 1 12 3c4-3 6 3 0 3ZM8 13l-2 2m6-2v3m4-3 2 2M9 18h6M12 18v3'},
  {id:'wick',name:'Wick System',short:'Passive nutrient delivery',exposure:8,note:'Wick systems lose water from the crop and moist medium. We use 8% equivalent exposed area as a starting assumption; adjust for covers and wetting.',path:'M4 5h16l-2 8H6L4 5ZM3 16h18v6H3v-6Zm7-3v6m4-6v6M12 5V2M3 19c3-2 6 2 9 0s6 2 9 0'}
];
const crops = {
  lettuce:{name:'Lettuce',varieties:['Unspecified / mixed','Butterhead','Romaine','Grand Rapids','Great Lakes','Regina','Lollo Rossa']},
  basil:{name:'Basil',varieties:['Unspecified / mixed','Genovese','Sweet basil','Thai basil','Lemon basil']},
  spinach:{name:'Spinach',varieties:['Unspecified / mixed','Space','Bloomsdale','Tyee']},
  kale:{name:'Kale',varieties:['Unspecified / mixed','Lacinato','Red Russian','Curly kale']},
  tomato:{name:'Tomato',varieties:['Unspecified / mixed','Cherry tomato','Axiany','Beefsteak','Roma']},
  cucumber:{name:'Cucumber',varieties:['Unspecified / mixed','English / seedless','Beit Alpha','Persian']},
  strawberry:{name:'Strawberry',varieties:['Unspecified / mixed','Albion','San Andreas','Monterey']},
  pepper:{name:'Sweet pepper',varieties:['Unspecified / mixed','California Wonder','Bell pepper','Mini sweet pepper']},
  custom:{name:'Other crop',varieties:['Unspecified crop / variety']}
};
const sources = [
  {category:'Equations & methodology',title:'FAO Paper 56',text:'The general Penman–Monteith formulation and field reference-ET methodology. A foundation for energy-balance calculations.',limit:'Outdoor crop coefficients require calibration before transfer to hydroponics.',url:'https://www.fao.org/4/X0490E/x0490e00.htm',action:'Read the methodology'},
  {category:'Hydroponic crop evidence',title:'NFT lettuce ET study',text:'Zolnier, Lyra & Gates (2004) tested Penman–Monteith against measured ET in three greenhouse lettuce cultivars.',limit:'Good performance above LAI 0.5; weaker young-canopy and dawn/dusk estimates.',url:'https://experts.illinois.edu/en/publications/evapotranspiration-estimates-for-greenhouse-lettuce-using-an-inte/',action:'Explore the research'},
  {category:'Public greenhouse dataset',title:'Wageningen greenhouse data',text:'Six months of indoor/outdoor climate, irrigation, drainage samples and resource-use data from six cherry tomato compartments.',limit:'Useful for model development; water-balance boundaries must be checked before deriving ET.',url:'https://research.wur.nl/en/datasets/autonomous-greenhouse-challenge-second-edition-2019/',action:'View the dataset'},
  {category:'Outdoor weather & reference ET',title:'Open-Meteo',text:'Weather API with temperature, RH, radiation, wind and FAO reference evapotranspiration (et0_fao_evapotranspiration).',limit:'ET₀ is for well-watered grass. Its separate land-surface ET variable is not hydroponic ET.',url:'https://open-meteo.com/en/docs',action:'Open API documentation'},
  {category:'Global climate & solar data',title:'NASA POWER',text:'Global meteorological and solar time series for historical climate context and outdoor planning.',limit:'Gridded outdoor data do not represent greenhouse or indoor canopy conditions.',url:'https://power.larc.nasa.gov/docs/tutorials/service-data-request/api/',action:'Explore the data API'},
  {category:'California station network',title:'CIMIS',text:'California weather stations and reference evapotranspiration. Data and API access are available through the CIMIS service.',limit:'Regional outdoor reference data; API access requires an account and AppKey.',url:'https://cimis.water.ca.gov/',action:'Visit CIMIS'},
  {category:'Long-term climate baseline',title:'FAO CLIMWAT',text:'Historical monthly climate averages for use with CROPWAT, useful for early water-demand planning.',limit:'Long-term averages rather than live weather or measured crop water loss.',url:'https://www.fao.org/land-water/land/land-governance-and-planning/land-resources-planning-toolbox/detail/climwat---climatic-database-to-be-used-with-cropwat/en',action:'Explore CLIMWAT'},
  {category:'Greenhouse model foundations',title:'Stanghellini’s research',text:'Original greenhouse transpiration research connecting radiation, vapor transfer, canopy properties and climate management.',limit:'A scientific framework; resistance values still need local measurement or fitting.',url:'https://research.wur.nl/en/publications/transpiration-of-greenhouse-crops-an-aid-to-climate-management/',action:'Read the research record'},
  {category:'Light measurement guidance',title:'Photon flux & energy',text:'Apogee sensor documentation explains the role of the light spectrum in photon-to-energy conversion.',limit:'The 4.57 µmol/J sunlight approximation does not fit every LED spectrum.',url:'https://www.apogeeinstruments.com/content/SQ-212-215-manual.pdf',action:'View sensor documentation'}
];
let selectedSystem='nft';
let environment='greenhouse';
let lastResult=null;
let lastInputs=null;
let proposedCalibration=null;
const numberKeys=['dayTemp','nightTemp','dayRh','nightRh','ppfd','hours','ra','leafResistance','lai','exposure','reservoirArea','calibration','recovery','otherLoss','activeFraction','photonConversion','netRadiationFactor','pressure'];
const radiationKeys=['dayRn','nightRn','waterDayRn','waterNightRn'];
const stageLai={seedling:0.3,developing:1.2,mature:2.5};
const presets={greenhouse:{dayTemp:24,nightTemp:18,dayRh:65,nightRh:80,ppfd:400,hours:14,lightType:'solar',ra:100,airflow:'100'},indoor:{dayTemp:23,nightTemp:20,dayRh:65,nightRh:75,ppfd:250,hours:16,lightType:'led',ra:100,airflow:'100'},outdoor:{dayTemp:28,nightTemp:18,dayRh:55,nightRh:80,ppfd:600,hours:12,lightType:'solar',ra:50,airflow:'50'}};
const fmt=(value,digits=1)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);

$('system-grid').innerHTML=systems.map(s=>`<button type="button" class="system-card${s.id===selectedSystem?' selected':''}" data-system="${s.id}" aria-pressed="${s.id===selectedSystem}"><span class="system-radio"></span>${icon(s.path,'system-icon')}<strong>${s.name}</strong><small>${s.short}</small></button>`).join('');
$('crop').innerHTML=Object.entries(crops).map(([key,c])=>`<option value="${key}">${c.name}</option>`).join('');
function updateCultivars(){ $('cultivar').replaceChildren(...crops[$('crop').value].varieties.map(v=>new Option(v,v))); }
updateCultivars();
$('system-note').textContent=systems[0].note;
$('sources').innerHTML=sources.map(s=>`<article class="source-card"><span class="source-category">${s.category}</span><h3>${s.title}</h3><p>${s.text}</p><div class="source-limitation">${s.limit}</div><a href="${s.url}" target="_blank" rel="noopener">${s.action}<span>↗</span></a></article>`).join('');

function setSystem(id){
  selectedSystem=id;
  const s=systems.find(s=>s.id===id);
  $('exposure').value=s.exposure;
  $('system-note').textContent=s.note;
  document.querySelectorAll('[data-system]').forEach(b=>{b.classList.toggle('selected',b.dataset.system===id);b.setAttribute('aria-pressed',String(b.dataset.system===id));});
}
function setEnvironment(env){
  environment=env;
  Object.entries(presets[env]).forEach(([k,v])=>{$(k).value=v;});
  document.querySelectorAll('[data-env]').forEach(b=>{b.classList.toggle('selected',b.dataset.env===env);b.setAttribute('aria-pressed',String(b.dataset.env===env));});
  $('preset-note').textContent=env==='outdoor'?'Illustrative outdoor conditions, not a forecast. Use measured period averages. Replenishment assumes no rain enters the system.':env==='indoor'?'Illustrative indoor LED conditions. Replace with canopy measurements and your fixture’s spectrum-based energy factor.':'Illustrative greenhouse conditions. Replace with measurements inside your growing space.';
}
function readInputs(){
  const input={};
  for(const key of numberKeys)input[key]=$(key).valueAsNumber;
  input.area=$('area').valueAsNumber*($('area-unit').value==='ft2'?0.09290304:1);
  input.lightType=$('lightType').value;
  input.nightResistanceFactor=$('nightMultiplier').valueAsNumber;
  if($('measured-radiation').checked)for(const key of radiationKeys)input[key]=$(key).valueAsNumber;
  return input;
}
function setError(message){
  $('form-error').hidden=!message;$('form-error').textContent=message;
  document.querySelector('.live-dot').textContent=message?'Check inputs':'Live';
  if(message){
    lastResult=null;
    for(const id of ['total-et','sensitivity-value','crop-et','surface-et','et-depth','weekly','makeup','vpd','dli'])$(id).textContent='—';
    $('result-context').textContent='Complete your inputs to calculate';
    $('crop-bar').style.width='0%';$('evap-bar').style.width='0%';
  }
}
function update(){
  const form=$('grow-form');
  if(!form.checkValidity()){
    setError('Complete the highlighted inputs within the indicated ranges to update the estimate.');
    $('download').disabled=true;
    $('results').setAttribute('aria-label','Previous estimate. Some inputs are invalid.');
    return;
  }
  try{
    const inputs=readInputs();
    const r=estimate(inputs);lastResult=r;lastInputs=inputs;setError('');$('download').disabled=false;
    $('results').setAttribute('aria-label','Current daily water estimate');
    $('total-et').textContent=fmt(r.grossET,1);
    $('total-et').style.fontSize=r.grossET>=1000000?'30px':r.grossET>=10000?'40px':'';
    const stage=$('stage').value==='mature'?'Full canopy':$('stage').value==='seedling'?'Seedling':'Developing canopy';
    $('result-context').textContent=`${fmt(inputs.area,inputs.area%1?1:0)} m² · ${crops[$('crop').value].name} · ${stage}`;
    $('sensitivity-value').textContent=`${fmt(r.low,0)}–${fmt(r.high,0)} L/day`;
    $('crop-et').textContent=`${fmt(r.crop)} L`;$('surface-et').textContent=`${fmt(r.evaporation)} L`;
    $('crop-bar').style.width=`${r.grossET>0?r.crop/r.grossET*100:0}%`;
    $('evap-bar').style.width=`${r.grossET>0?r.evaporation/r.grossET*100:0}%`;
    $('et-depth').textContent=`${fmt(r.depth,2)} L/m²`;$('weekly').textContent=`${fmt(r.grossET*7,0)} L`;
    $('makeup').textContent=`${fmt(r.makeup)} L/day`;$('vpd').textContent=`${fmt(r.vpdDay,2)} kPa`;
    $('dli').textContent=`${fmt(inputs.ppfd*inputs.hours*0.0036)} mol/m²/day`;
    const warnings=[];
    if(inputs.lai<0.5)warnings.push('Young canopy: published NFT lettuce research found weak estimates below LAI 0.5. Measure and calibrate before relying on this result.');
    if(r.vpdDay>2||r.vpdNight>2)warnings.push('High air VPD can close stomata. This model uses fixed resistance and may overestimate water use.');
    if(inputs.dayRh>90||inputs.nightRh>90)warnings.push('Near saturation, condensation and leaf temperature matter. Condensation is not simulated.');
    if(environment==='outdoor')warnings.push('Outdoor replenishment excludes rainfall entering the nutrient solution. Use measured net radiation and account for rain separately.');
    if(inputs.lightType==='led'&&!$('measured-radiation').checked)warnings.push('LED energy conversion depends on the spectrum. Edit the photon-to-energy factor or use measured available radiation for a better estimate.');
    if(['drip','ebb','wick'].includes(selectedSystem))warnings.push('Wet substrate and intermittent flooding are represented as equivalent open-water area. Surface drying resistance and flood timing need local calibration.');
    $('model-warning').hidden=!warnings.length;$('model-warning').textContent=warnings.join(' ');
    // A changed scenario invalidates any unapplied calibration suggestion.
    proposedCalibration=null;$('cal-result').hidden=true;
  }catch(err){setError(err.message);$('download').disabled=true;}
}
document.querySelectorAll('[data-system]').forEach(b=>b.addEventListener('click',()=>{setSystem(b.dataset.system);update();}));
document.querySelectorAll('[data-env]').forEach(b=>b.addEventListener('click',()=>{setEnvironment(b.dataset.env);update();}));
$('crop').addEventListener('change',updateCultivars);
$('stage').addEventListener('change',()=>{$('lai').value=stageLai[$('stage').value];});
$('airflow').addEventListener('change',()=>{if($('airflow').value!=='custom')$('ra').value=$('airflow').value;});
$('ra').addEventListener('input',()=>{$('airflow').value='custom';});
$('area-unit').addEventListener('change',event=>{
  const n=$('area').valueAsNumber;
  if(Number.isFinite(n))$('area').value=Number((event.target.value==='ft2'?n/0.09290304:n*0.09290304).toFixed(4));
});
$('measured-radiation').addEventListener('change',()=>{for(const key of radiationKeys)$(key).disabled=!$('measured-radiation').checked;});
$('grow-form').addEventListener('input',update);
$('grow-form').addEventListener('change',update);
$('grow-form').addEventListener('submit',e=>{e.preventDefault();update();if(!lastResult||!e.currentTarget.checkValidity())return;$('results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
$('reset').addEventListener('click',()=>{
  $('grow-form').reset();updateCultivars();setSystem('nft');setEnvironment('greenhouse');
  for(const key of radiationKeys)$(key).disabled=true;
  $('advanced').open=false;update();toast('Example conditions restored.');
});
function route(){
  let id=location.hash.slice(1)||'estimator';if(!['estimator','science','calibration'].includes(id))id='estimator';
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  document.querySelectorAll('[data-tab]').forEach(a=>{a.classList.toggle('active',a.dataset.tab===id);if(a.dataset.tab===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',route);
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},3500);}

$('download').addEventListener('click',()=>{
  if(!lastResult||!$('grow-form').checkValidity())return;
  const r=lastResult;
  const rows=[['CANOPY HYDROPONIC ET ESTIMATE',''],['Model version',MODEL_VERSION],['Exported at',new Date().toISOString()],['System',systems.find(s=>s.id===selectedSystem).name],['Crop',crops[$('crop').value].name],['Variety',$('cultivar').value],['Growth stage',$('stage').selectedOptions[0].text],['Environment',environment],['',''],['RESULT','VALUE'],['Total evapotranspiration L/day',r.grossET],['Crop transpiration L/day',r.crop],['Surface evaporation L/day',r.evaporation],['ET depth L/m2/day',r.depth],['Gross ET over 7 identical days L',r.grossET*7],['Fresh replenishment L/day',r.makeup],['Returned condensate L/day',r.recovered],['Other water losses L/day',r.otherLoss],['Sensitivity low L/day',r.low],['Sensitivity high L/day',r.high],['Daytime VPD kPa',r.vpdDay],['Nighttime VPD kPa',r.vpdNight],['DLI mol/m2/day',lastInputs.ppfd*lastInputs.hours*0.0036],['',''],['INPUTS (SI units in key)','VALUE'],...Object.entries(r.inputs),['',''],['ASSUMPTIONS & WARNINGS',''],...r.assumptions.map(s=>[s,'']),...r.warnings.map(s=>[s,'']),['Outdoor replenishment assumes no rainfall enters the system.',''],['Cultivar labels do not apply physiological coefficients.',''],['',''],['SOURCES','URL'],...sources.map(s=>[s.title,s.url])];
  const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`canopy-et-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your estimate and model assumptions were exported.');
});
$('calibration-form').addEventListener('submit',e=>{
  e.preventDefault();const error=$('cal-error');error.hidden=true;$('cal-result').hidden=true;
  if(!lastInputs||!$('grow-form').checkValidity()){error.textContent='Complete the estimator inputs before calculating a calibration factor.';error.hidden=false;return;}
  const days=$('cal-days').valueAsNumber;
  const observed=observedET({start:$('cal-start').valueAsNumber,end:$('cal-end').valueAsNumber,added:$('cal-added').valueAsNumber,recovered:$('cal-returned').valueAsNumber,otherOutflow:$('cal-removed').valueAsNumber})/days;
  const baseline=estimate({...readInputs(),calibration:1}).grossET;
  if(!Number.isFinite(observed)||observed<=0||baseline<=0){error.textContent='This balance does not show a positive daily evaporative loss. Check the volumes, additions and removals before fitting a factor.';error.hidden=false;return;}
  proposedCalibration=observed/baseline;
  $('observed-et').textContent=`${fmt(observed)} L/day`;$('suggested-factor').textContent=`${fmt(proposedCalibration,2)}×`;
  const supported=proposedCalibration>=0.1&&proposedCalibration<=5;
  $('cal-note').textContent=supported?'This factor scales total model ET. Apply it only if your current crop, climate, and exposure match the observation period.':'This factor is outside the supported 0.1–5 range. Investigate storage changes, leaks, measurement timing and assumptions before fitting the model.';
  $('apply-calibration').hidden=!supported;$('cal-result').hidden=false;
});
$('calibration-form').addEventListener('input',()=>{$('cal-result').hidden=true;proposedCalibration=null;});
$('apply-calibration').addEventListener('click',()=>{
  if(proposedCalibration===null)return;
  $('calibration').value=proposedCalibration.toFixed(4);update();location.hash='estimator';toast('Water-balance calibration applied to your estimate.');
});
setEnvironment('greenhouse');route();update();
