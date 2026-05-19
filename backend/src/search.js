import SearchAPI from '@hammerhead/searchapi'

const searchApi = SearchAPI({
  delay: 250,
  safeSearch: true,
  resultsPerPage: 10,
  cacheSize: 50
})

function normalizeResults(results = []) {
  return results
    .map((item) => ({
      title: String(item.title || '').trim(),
      url: String(item.url || item.link || '').trim(),
      snippet: String(item.snippet || item.extract || '').trim()
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 5)
}

export async function searchWeb(query) {
  const keyword = query.trim()

  if (!keyword) {
    return {
      provider: 'duckduckgo',
      results: []
    }
  }

  const searchResponse = await searchApi.search(keyword, 5, 1)
  const results = normalizeResults([
    ...(searchResponse.instant?.answer
      ? [{
          title: searchResponse.instant.heading || 'DuckDuckGo 即时答案',
          url: searchResponse.instant.url || `https://duckduckgo.com/?q=${encodeURIComponent(keyword)}`,
          extract: searchResponse.instant.answer
        }]
      : []),
    ...(searchResponse.wiki?.extract
      ? [{
          title: searchResponse.wiki.title || 'Wikipedia',
          url: searchResponse.wiki.url || '',
          extract: searchResponse.wiki.extract
        }]
      : []),
    ...(searchResponse.text || [])
  ])

  return {
    provider: 'duckduckgo',
    results
  }
}

export function buildSearchContext(results = []) {
  if (!results.length) {
    return ''
  }

  return results.map((item, index) => {
    const title = item.title || '未命名结果'
    const snippet = item.snippet || '无摘要'
    return `${index + 1}. ${title}\n链接: ${item.url}\n摘要: ${snippet}`
  }).join('\n\n')
}
