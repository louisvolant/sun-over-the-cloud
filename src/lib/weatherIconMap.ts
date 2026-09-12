// src/lib/weatherIconMap.ts

export const weatherIconColorMap: Record<string, string> = {
  '01d': 'text-amber-500 dark:text-amber-400',        // Sunny day
  '01n': 'text-indigo-400 dark:text-indigo-300',        // Clear night
  '02d': 'text-amber-400 dark:text-amber-300',        // Few clouds day
  '02n': 'text-indigo-300 dark:text-indigo-200',        // Few clouds night
  '03d': 'text-gray-400 dark:text-gray-300',          // Scattered clouds day
  '03n': 'text-gray-400 dark:text-gray-300',          // Scattered clouds night
  '04d': 'text-gray-500 dark:text-gray-400',          // Broken clouds day
  '04n': 'text-gray-500 dark:text-gray-400',          // Broken clouds night

  '09d': 'text-blue-500 dark:text-blue-400',          // Showers day
  '09n': 'text-blue-500 dark:text-blue-400',          // Showers night
  '10d': 'text-blue-600 dark:text-blue-400',          // Rain day
  '10n': 'text-blue-500 dark:text-blue-400',          // Rain night

  '11d': 'text-purple-600 dark:text-purple-400',      // Thunderstorm day
  '11n': 'text-purple-500 dark:text-purple-300',      // Thunderstorm night

  '13d': 'text-cyan-500 dark:text-cyan-300',          // Snow day
  '13n': 'text-cyan-400 dark:text-cyan-300',          // Snow night

  '50d': 'text-teal-600 dark:text-teal-400',          // Fog/Mist day
  '50n': 'text-teal-500 dark:text-teal-400',          // Fog/Mist night
};

// Your weatherIconMap and weatherIconAnimationMap remain the same as you provided.
export const weatherIconMap: { [key: string]: string } = {
  "01d": "wi-day-sunny",
  "01n": "wi-night-clear",
  "02d": "wi-day-cloudy",
  "02n": "wi-night-alt-cloudy",
  "03d": "wi-cloud",
  "03n": "wi-cloud",
  "04d": "wi-cloudy",
  "04n": "wi-cloudy",
  "09d": "wi-showers",
  "09n": "wi-showers",
  "10d": "wi-day-rain",
  "10n": "wi-night-alt-rain",
  "11d": "wi-thunderstorm",
  "11n": "wi-thunderstorm",
  "13d": "wi-snow",
  "13n": "wi-snow",
  "50d": "wi-fog",
  "50n": "wi-fog",
};

export const weatherIconAnimationMap: Record<string, string> = {
  '09d': 'pulse-slow',
  '09n': 'pulse-slow',
  '11d': 'spin-slow',
  '11n': 'spin-slow',
  '13d': 'bounce-slow',
  '13n': 'bounce-slow',
};
