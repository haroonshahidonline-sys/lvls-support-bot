import * as adhan from 'adhan';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Coordinates, PrayerTimes, CalculationMethod } = (adhan as any).default || adhan;

const coordinates = new Coordinates(config.LATITUDE, config.LONGITUDE);

function getCalculationParams(): adhan.CalculationParameters {
  const methodMap: Record<string, () => adhan.CalculationParameters> = {
    ISNA: () => CalculationMethod.NorthAmerica(),
    UmmAlQura: () => CalculationMethod.UmmAlQura(),
    MuslimWorldLeague: () => CalculationMethod.MuslimWorldLeague(),
    Egyptian: () => CalculationMethod.Egyptian(),
    Karachi: () => CalculationMethod.Karachi(),
  };

  const factory = methodMap[config.CALCULATION_METHOD];
  if (!factory) {
    logger.warn(`Unknown calculation method: ${config.CALCULATION_METHOD}, falling back to ISNA`);
    return CalculationMethod.NorthAmerica();
  }
  return factory();
}

const params = getCalculationParams();

export function getTodayPrayerTimes(): adhan.PrayerTimes {
  return new PrayerTimes(coordinates, new Date(), params);
}

export function isCurrentlyPrayerTime(): boolean {
  const prayerTimes = getTodayPrayerTimes();
  const now = new Date();
  const bufferMs = config.PRAYER_BUFFER_MINUTES * 60 * 1000;

  const prayers = [
    prayerTimes.fajr,
    prayerTimes.dhuhr,
    prayerTimes.asr,
    prayerTimes.maghrib,
    prayerTimes.isha,
  ];

  for (const prayerStart of prayers) {
    const prayerEnd = new Date(prayerStart.getTime() + bufferMs);
    if (now >= prayerStart && now <= prayerEnd) {
      return true;
    }
  }

  return false;
}

export function isJummahTime(): boolean {
  const now = new Date();
  if (now.getDay() !== 5) return false; // 5 = Friday

  const prayerTimes = getTodayPrayerTimes();
  const jummahStart = new Date(prayerTimes.dhuhr.getTime() - 30 * 60 * 1000);
  const jummahEnd = new Date(prayerTimes.dhuhr.getTime() + 90 * 60 * 1000);

  return now >= jummahStart && now <= jummahEnd;
}

export function shouldDeferMessage(): boolean {
  return isCurrentlyPrayerTime() || isJummahTime();
}

export function getNextAvailableTime(): Date {
  const prayerTimes = getTodayPrayerTimes();
  const now = new Date();
  const bufferMs = config.PRAYER_BUFFER_MINUTES * 60 * 1000;

  const prayers = [
    prayerTimes.fajr,
    prayerTimes.dhuhr,
    prayerTimes.asr,
    prayerTimes.maghrib,
    prayerTimes.isha,
  ];

  for (const prayerStart of prayers) {
    const prayerEnd = new Date(prayerStart.getTime() + bufferMs);
    if (now >= prayerStart && now <= prayerEnd) {
      return prayerEnd;
    }
  }

  // If during Jummah window on Friday
  if (isJummahTime()) {
    return new Date(prayerTimes.dhuhr.getTime() + 90 * 60 * 1000);
  }

  // Not in any prayer window, available now
  return now;
}
