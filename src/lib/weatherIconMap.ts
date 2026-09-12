// src/lib/weatherIconMap.ts

export const weatherIconColorMap: Record<string, string> = {
  '01d': 'text-yellow-400',        // Sunny day
  '01n': 'text-indigo-400',        // Clear night (deep night sky)
  '02d': 'text-yellow-300',        // Few clouds day
  '02n': 'text-indigo-300',        // Few clouds night
  '03d': 'text-gray-400',          // Scattered clouds day
  '03n': 'text-gray-500 dark:text-gray-400', // Scattered clouds night (ensure good contrast in dark mode if needed)
  '04d': 'text-gray-500 dark:text-gray-400', // Broken clouds day
  '04n': 'text-gray-600 dark:text-gray-500', // Broken clouds night

  '09d': 'text-blue-400',          // Showers day (lighter blue)
  '09n': 'text-blue-500',          // Showers night
  '10d': 'text-blue-500',          // Rain day (standard blue)
  '10n': 'text-blue-500',          // Rain night

  '11d': 'text-purple-500',        // Thunderstorm day
  '11n': 'text-purple-600',        // Thunderstorm night

  '13d': 'text-sky-300',           // Snow day (icy blue, visible on white bg)
  '13n': 'text-sky-300',           // Snow night (consistent icy blue)

  '50d': 'text-slate-400',         // Fog/Mist day (slate has a bit of blue, good for atmosphere)
  '50n': 'text-slate-500',         // Fog/Mist night
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
