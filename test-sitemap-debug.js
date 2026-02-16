import { parseStringPromise } from 'xml2js';

async function test() {
  const resp = await fetch('https://www.civicactions.com/sitemap-index.xml');
  const text = await resp.text();
  const result = await parseStringPromise(text);
  
  console.log('Sitemap index:');
  console.log(JSON.stringify(result.sitemapindex.sitemap[0], null, 2));
  
  // Fetch first child sitemap  
  const childUrl = result.sitemapindex.sitemap[0].loc[0];
  console.log('\nFetching child sitemap:', childUrl);
  
  const childResp = await fetch(childUrl);
  const childText = await childResp.text();
  const childResult = await parseStringPromise(childText);
  
  console.log('\nFirst 3 URLs from sitemap:');
  const urls = childResult.urlset.url.slice(0, 3);
  urls.forEach((u, i) => {
    console.log(`  ${i+1}. ${u.loc[0]}`);
  });
}

test().catch(console.error);
