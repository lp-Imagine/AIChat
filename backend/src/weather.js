function mapWeatherCode(code) {
  const table = {
    0: '晴',
    1: '大致晴朗',
    2: '局部多云',
    3: '阴',
    45: '有雾',
    48: '冻雾',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '强毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    80: '小阵雨',
    81: '中阵雨',
    82: '强阵雨',
    95: '雷暴'
  }

  return table[code] || `天气代码 ${code}`
}

export function detectWeatherIntent(message = '') {
  return /(天气|气温|温度|下雨|降雨|风力|湿度|预报)/.test(message)
}

export function extractCityFromWeatherQuery(message = '') {
  const cleaned = message
    .replace(/今天|今日|现在|实时|目前|一下|请问|帮我|查询|搜索|看看|想知道/g, '')
    .replace(/天气|气温|温度|下雨|降雨|风力|湿度|预报|如何|怎么样|怎样|多少|呢|吗|\?|？/g, '')
    .replace(/\s+/g, '')
    .trim()

  const locationMatch = cleaned.match(/([\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|乡)?)/)
  if (!locationMatch) {
    return ''
  }

  return locationMatch[1].replace(/的$/, '')
}

export async function fetchWeatherByQuery(query) {
  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=zh&format=json`
  )

  if (!geoResponse.ok) {
    throw new Error(`Geocoding failed: HTTP ${geoResponse.status}`)
  }

  const geoData = await geoResponse.json()
  const location = geoData.results?.[0]

  if (!location) {
    return null
  }

  const weatherResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1`
  )

  if (!weatherResponse.ok) {
    throw new Error(`Weather fetch failed: HTTP ${weatherResponse.status}`)
  }

  const weatherData = await weatherResponse.json()
  const current = weatherData.current || {}
  const daily = weatherData.daily || {}

  return {
    city: `${location.admin1 || ''}${location.name}`.trim(),
    latitude: location.latitude,
    longitude: location.longitude,
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code,
      weatherText: mapWeatherCode(current.weather_code)
    },
    today: {
      maxTemperature: daily.temperature_2m_max?.[0],
      minTemperature: daily.temperature_2m_min?.[0],
      weatherCode: daily.weather_code?.[0],
      weatherText: mapWeatherCode(daily.weather_code?.[0])
    }
  }
}

export function buildWeatherContext(weather) {
  if (!weather) {
    return ''
  }

  return [
    `城市: ${weather.city}`,
    `当前时间: ${weather.current.time}`,
    `当前天气: ${weather.current.weatherText}`,
    `当前温度: ${weather.current.temperature}°C`,
    `当前湿度: ${weather.current.humidity}%`,
    `当前风速: ${weather.current.windSpeed} km/h`,
    `今日天气: ${weather.today.weatherText}`,
    `今日最高温: ${weather.today.maxTemperature}°C`,
    `今日最低温: ${weather.today.minTemperature}°C`
  ].join('\n')
}
