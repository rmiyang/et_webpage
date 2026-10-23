/**
 * Hydroponic water-balance planning model. All calculations run locally.
 *
 * General bulk Penman–Monteith, not the FAO grass reference equation:
 * LE = [Delta (Rn-G) + rho cp VPD / ra] /
 *      [Delta + gamma (1 + rs/ra)]   [W/m²].
 * Crop Rn is per m² of growing area; rs = leafResistance / activeLAI.
 * Open-water evaporation uses rs=0, with zero water heat storage assumed.
 * All vapor pressures used in PM are Pa; reported VPD is kPa.
 *
 * The resistance, active-leaf fraction and radiation proxies are editable
 * starting assumptions, not validated crop/cultivar or hydroponic coefficients.
 * General equation: https://www.fao.org/4/X0490E/x0490e06.htm
 * Atmosphere: https://www.fao.org/4/X0490E/x0490e07.htm
 * Hydroponic NFT validation/limits: https://doi.org/10.13031/2013.15868
 */

export const MODEL_VERSION = '1.0.0';

export const DEFAULTS = Object.freeze({
  area: 100,
  dayTemp: 24,
  nightTemp: 20,
  dayRh: 65,
  nightRh: 75,
  ppfd: 300,
  hours: 16,
  lightType: 'led',
  ra: 150,
  leafResistance: 200,
  lai: 2.5,
  extinction: 0.65,
  activeFraction: 0.5,
  nightResistanceFactor: 5,
  photonConversion: 4.57,
  solarParFraction: 0.45,
  exposure: 2,
  reservoirArea: 0,
  calibration: 1,
  recovery: 0,
  otherLoss: 0,
  pressure: 101.3,
});

export const SOURCES = Object.freeze([
  {
    title: 'FAO-56: general Penman–Monteith, canopy resistance and active leaf area',
    url: 'https://www.fao.org/4/X0490E/x0490e06.htm',
  },
  {
    title: 'FAO-56: atmospheric parameters and vapor-pressure equations',
    url: 'https://www.fao.org/4/X0490E/x0490e07.htm',
  },
  {
    title: 'Zolnier, Lyra & Gates (2004): greenhouse NFT lettuce ET model validation',
    url: 'https://doi.org/10.13031/2013.15868',
  },
  {
    title: 'Stanghellini (1987): transpiration of greenhouse crops',
    url: 'https://research.wur.nl/en/publications/transpiration-of-greenhouse-crops-an-aid-to-climate-management/',
  },
  {
    title: 'Apogee: converting photon flux to energy requires the light source spectrum',
    url: 'https://www.apogeeinstruments.com/content/SQ-212-215-manual.pdf',
  },
]);

/** Saturation vapor pressure [Pa], for air temperature [°C]. */
export function saturationVaporPressure(temperature) {
  return 610.8 * Math.exp(17.27 * temperature / (temperature + 237.3));
}

/** Slope of saturation vapor-pressure curve [Pa/K]. */
export function saturationSlope(temperature) {
  return 4098 * saturationVaporPressure(temperature) / (temperature + 237.3) ** 2;
}

/** Vapor-pressure deficit [kPa] from air temperature [°C] and RH [%]. */
export function vaporPressureDeficit(temperature, rh) {
  return Math.max(0, saturationVaporPressure(temperature) * (1 - rh / 100) / 1000);
}

/**
 * Latent energy flux [W/m²]. Input pressure [kPa], temperature [°C],
 * RH [%], radiation [W/m²], resistance [s/m]. Negative flux (dew)
 * is clipped to zero because this model reports evaporative loss only.
 */
export function penmanMonteith({ temperature, rh, radiation, ra, rs, pressure = 101.3 }) {
  if (!(ra > 0) || !(rs >= 0) || !(pressure > 0)) {
    throw new RangeError('Aerodynamic resistance and pressure must be positive; surface resistance must be nonnegative.');
  }
  const lambda = 2.45e6; // J/kg
  const cp = 1013; // J/(kg K), FAO atmospheric approximation
  const airDensity = pressure * 1000 / (287.05 * (temperature + 273.15));
  const gamma = cp * pressure * 1000 / (0.622 * lambda); // Pa/K
  const delta = saturationSlope(temperature);
  const vpd = vaporPressureDeficit(temperature, rh) * 1000; // Pa
  return Math.max(0,
    (delta * radiation + airDensity * cp * vpd / ra) /
    (delta + gamma * (1 + rs / ra))
  );
}

function numeric(input, key, min, max, fallback = DEFAULTS[key]) {
  const raw = input[key];
  const n = raw === undefined || raw === null || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RangeError(`${key} must be a finite number between ${min} and ${max}.`);
  }
  return n;
}

function optionalRadiation(input, key) {
  return input[key] === undefined || input[key] === null || input[key] === ''
    ? null : numeric(input, key, -300, 2500);
}

function normalize(input) {
  const p = {
    area: numeric(input, 'area', 0, 1e8),
    dayTemp: numeric(input, 'dayTemp', -10, 60),
    nightTemp: numeric(input, 'nightTemp', -10, 60),
    dayRh: numeric(input, 'dayRh', 0, 100),
    nightRh: numeric(input, 'nightRh', 0, 100),
    ppfd: numeric(input, 'ppfd', 0, 5000),
    hours: numeric(input, 'hours', 0, 24),
    lightType: input.lightType === 'solar' ? 'solar' : 'led',
    ra: numeric(input, 'ra', 1, 10000),
    leafResistance: numeric(input, 'leafResistance', 1, 20000),
    lai: numeric(input, 'lai', 0, 20),
    extinction: numeric(input, 'extinction', 0.01, 3),
    activeFraction: numeric(input, 'activeFraction', 0.01, 1),
    nightResistanceFactor: numeric(input, 'nightResistanceFactor', 1, 100),
    photonConversion: numeric(input, 'photonConversion', 2, 7),
    solarParFraction: numeric(input, 'solarParFraction', 0.2, 0.8),
    exposure: numeric(input, 'exposure', 0, 100),
    reservoirArea: numeric(input, 'reservoirArea', 0, 1e8),
    calibration: numeric(input, 'calibration', 0, 10),
    recovery: numeric(input, 'recovery', 0, 100),
    otherLoss: numeric(input, 'otherLoss', 0, 1e9),
    pressure: numeric(input, 'pressure', 50, 110),
    dayRn: optionalRadiation(input, 'dayRn'),
    nightRn: optionalRadiation(input, 'nightRn'),
    waterDayRn: optionalRadiation(input, 'waterDayRn'),
    waterNightRn: optionalRadiation(input, 'waterNightRn'),
  };
  p.netRadiationFactor = numeric(input, 'netRadiationFactor', 0.01, 1, p.lightType === 'solar' ? 0.77 : 0.85);
  p.waterRa = numeric(input, 'waterRa', 1, 10000, p.ra);
  p.waterTemp = input.waterTemp === undefined || input.waterTemp === null || input.waterTemp === ''
    ? null : numeric(input, 'waterTemp', 0, 60);
  return p;
}

const LAMBDA = 2.45e6;
const fluxToDepth = (flux, hours) => flux * hours * 3600 / LAMBDA; // kg/m² = L/m² = mm

function simulate(p, resistanceScale = 1, radiationScale = 1) {
  const interception = 1 - Math.exp(-p.extinction * p.lai);
  // PPFD -> PAR energy; sunlight additionally assumes PAR is 45% of shortwave.
  // netRadiationFactor approximates absorption/net retention. This is not a
  // measurement of all-wave net radiation; explicit overrides are preferable.
  const parEnergy = p.ppfd / p.photonConversion;
  const incidentRadiation = p.lightType === 'solar' ? parEnergy / p.solarParFraction : parEnergy;
  const dayRn = (p.dayRn ?? incidentRadiation * interception * p.netRadiationFactor) * radiationScale;
  const nightRn = (p.nightRn ?? 0) * radiationScale;
  const rs = p.lai > 0 ? p.leafResistance / (p.activeFraction * p.lai) * resistanceScale : Infinity;
  const period = (temperature, rh, radiation, resistance, ra = p.ra) => penmanMonteith({
    temperature, rh, radiation, ra, rs: resistance, pressure: p.pressure,
  });
  const cropDayFlux = p.lai > 0 ? period(p.dayTemp, p.dayRh, dayRn, rs) : 0;
  const cropNightFlux = p.lai > 0 ? period(p.nightTemp, p.nightRh, nightRn, rs * p.nightResistanceFactor) : 0;
  const cropDayDepth = fluxToDepth(cropDayFlux, p.hours);
  const cropNightDepth = fluxToDepth(cropNightFlux, 24 - p.hours);

  // Radiation is allocated between foliage and the exposed bed surface.
  // Reservoir area is additional unshaded open water; covered area is excluded.
  const waterBedRn = (p.waterDayRn ?? incidentRadiation * Math.exp(-p.extinction * p.lai) * 0.92) * radiationScale;
  const reservoirRn = (p.waterDayRn ?? incidentRadiation * 0.92) * radiationScale;
  const waterNightRn = (p.waterNightRn ?? 0) * radiationScale;
  const waterDayDepth = fluxToDepth(period(p.dayTemp, p.dayRh, waterBedRn, 0, p.waterRa), p.hours);
  const reservoirDayDepth = fluxToDepth(period(p.dayTemp, p.dayRh, reservoirRn, 0, p.waterRa), p.hours);
  const waterNightDepth = fluxToDepth(period(p.nightTemp, p.nightRh, waterNightRn, 0, p.waterRa), 24 - p.hours);
  const exposedBedArea = p.area * p.exposure / 100;
  const crop = (cropDayDepth + cropNightDepth) * p.area * p.calibration;
  const bedEvaporation = (waterDayDepth + waterNightDepth) * exposedBedArea * p.calibration;
  const reservoirEvaporation = (reservoirDayDepth + waterNightDepth) * p.reservoirArea * p.calibration;
  const evaporation = bedEvaporation + reservoirEvaporation;
  const grossET = crop + evaporation;
  const recovered = grossET * p.recovery / 100;
  const makeup = grossET - recovered + p.otherLoss;
  return {
    crop, evaporation, grossET, recovered, makeup,
    absorbedRn: dayRn, nightRn,
    cropDayDepth: cropDayDepth * p.calibration,
    cropNightDepth: cropNightDepth * p.calibration,
    depth: p.area > 0 ? grossET / p.area : 0,
    interception, canopyResistance: Number.isFinite(rs) ? rs : null,
    waterBedRn, reservoirRn, waterNightRn,
    breakdown: {
      cropDay: cropDayDepth * p.area * p.calibration,
      cropNight: cropNightDepth * p.area * p.calibration,
      bedEvaporation, reservoirEvaporation,
      exposedBedArea, uncoveredReservoirArea: p.reservoirArea,
      otherLoss: p.otherLoss,
    },
  };
}

/**
 * Estimate daily water volumes [L/day]. Input hours means lights-on/daytime
 * hours. Supplied radiation is mean power over the corresponding period.
 * `dayRn` and `nightRn` override canopy net radiation only; `waterDayRn` and
 * `waterNightRn` override net radiation per m² of each open-water surface.
 *
 * The low/high scenarios perturb leaf resistance ±30% and radiation ±20%.
 * They are sensitivity scenarios, not a confidence interval or accuracy claim.
 */
export function estimate(input = {}) {
  const p = normalize(input);
  const base = simulate(p);
  const scenarios = [simulate(p, 1.3, 0.8), simulate(p, 0.7, 1.2)];
  const low = Math.min(base.grossET, ...scenarios.map(s => s.grossET));
  const high = Math.max(base.grossET, ...scenarios.map(s => s.grossET));
  const warnings = [];
  const assumptions = [
    'Planning estimate from a general bulk Penman–Monteith model; not a calibrated hydroponic or cultivar prediction.',
    `Active LAI = ${p.activeFraction} × total LAI; night leaf resistance = ${p.nightResistanceFactor} × day leaf resistance. Both are editable assumptions.`,
    'Open-water evaporation assumes the same period air climate, zero water heat storage, and aerodynamic resistance equal to the entered waterRa (or canopy ra by default).',
    'Exposed bed water receives the light transmitted through the canopy; the extra uncovered reservoir is assumed unshaded under the same light.',
    'Open-water daytime radiation defaults to 92% of incident light energy (after canopy transmission for the bed), with zero nighttime net radiation. This is an assumed energy proxy; use water-radiation overrides for measured conditions.',
    'Calibration scales transpiration and evaporation together. Other losses are entered separately. Condensate recovery reduces makeup, not gross ET.',
    'Recirculation flow and irrigation delivery volume are not water consumption. Biomass water storage, leaks, purge, and harvest removal are outside ET.',
    'Sensitivity range varies leaf resistance ±30% and net radiation ±20%; it is not a statistical confidence interval.',
  ];
  if (p.dayRn === null) {
    assumptions.push(`Canopy light-energy proxy: PPFD ÷ ${p.photonConversion} µmol/J${p.lightType === 'solar' ? ` ÷ ${p.solarParFraction} PAR fraction` : ''} × (1 − exp(−${p.extinction} × LAI)) × ${p.netRadiationFactor} net factor.`);
    warnings.push('Net radiation is estimated from PPFD. Spectrum, non-PAR energy, longwave exchange, and fixture heat are not measured by this proxy; use a net-radiation override when available.');
    if (p.lightType === 'led') assumptions.push('The default 4.57 µmol/J photon-to-PAR-energy factor is a sunlight-spectrum approximation. LED conversion varies by product; replace it with a spectrum-based value or measured net radiation.');
  } else {
    assumptions.push('Daytime canopy net radiation uses the supplied override in W/m² of growing area.');
  }
  if (p.lai > 0 && p.lai < 0.5) warnings.push('Sparse/young canopy: NFT lettuce research found poor PM estimates at LAI < 0.5. Calibrate against measured water balance.');
  if (p.dayTemp > 35 || p.nightTemp > 35 || p.dayTemp < 10 || p.nightTemp < 10) warnings.push('Temperature is outside common growing-room conditions; the fixed-resistance assumptions may be unsuitable.');
  if (vaporPressureDeficit(p.dayTemp, p.dayRh) > 2 || vaporPressureDeficit(p.nightTemp, p.nightRh) > 2) warnings.push('High VPD can change stomatal resistance. This fixed-resistance model does not simulate stomatal closure.');
  if (p.dayRh > 90 || p.nightRh > 90) warnings.push('Near-saturated air: condensation and leaf temperature differences may be important. Negative evaporative flux is clipped to zero.');
  if (p.waterTemp !== null) warnings.push('Water temperature is recorded but excluded from this equilibrium open-water PM approximation; a separate water-temperature and heat-storage model is needed to use it consistently.');
  if (p.recovery > 0) assumptions.push('Recovery means ET condensate that is actually captured, treated as needed, and returned; HVAC removal alone is not recovered irrigation water.');
  return {
    ...base,
    otherLoss: p.otherLoss,
    vpdDay: vaporPressureDeficit(p.dayTemp, p.dayRh),
    vpdNight: vaporPressureDeficit(p.nightTemp, p.nightRh),
    low, high,
    range: { low, high, label: 'Sensitivity scenarios, not a confidence interval' },
    makeupLow: Math.min(base.makeup, ...scenarios.map(s => s.makeup)),
    makeupHigh: Math.max(base.makeup, ...scenarios.map(s => s.makeup)),
    assumptions, warnings, inputs: p,
    modelVersion: MODEL_VERSION,
  };
}

/**
 * Observed ET from a complete daily nutrient-solution inventory [L].
 * All tank/channel/substrate storage must be counted, at matching cycle phase.
 * OtherOutflow includes purge/leaks/solution removed, not recirculation.
 * Plant-water accumulation must be subtracted if material to the experiment.
 */
export function observedET({ start, end, added = 0, recovered = 0, otherOutflow = 0, plantStorage = 0 }) {
  const values = [start, end, added, recovered, otherOutflow, plantStorage];
  if (values.some(v => !Number.isFinite(Number(v)))) throw new RangeError('Water-balance entries must be finite liters.');
  return Number(start) + Number(added) + Number(recovered) - Number(end) - Number(otherOutflow) - Number(plantStorage);
}
