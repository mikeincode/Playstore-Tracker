const gplay = require('google-play-scraper');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      transport: WebSocket
    }
  }
);

// COLLECTIONS
const collections = [
  {
    name: 'TOP_FREE',
    collection: gplay.collection.TOP_FREE
  },
  {
    name: 'TOP_GROSSING',
    collection: gplay.collection.TOP_GROSSING
  }
];

// CATEGORIES
const categories = [
  {
    name: 'PRODUCTIVITY',
    category: gplay.category.PRODUCTIVITY
  },
  {
    name: 'FINANCE',
    category: gplay.category.FINANCE
  },
  {
    name: 'EDUCATION',
    category: gplay.category.EDUCATION
  },
  {
    name: 'TOOLS',
    category: gplay.category.TOOLS
  },
  {
    name: 'BUSINESS',
    category: gplay.category.BUSINESS
  },
  {
    name: 'LIFESTYLE',
    category: gplay.category.LIFESTYLE
  }
];

async function scrapeCollection(collectionObj, categoryObj = null) {

  try {

    console.log(
      `Scraping ${collectionObj.name} ${categoryObj?.name || 'ALL'}`
    );

    const apps = await gplay.list({
      collection: collectionObj.collection,
      category: categoryObj?.category,
      num: 50
    });

    for (const [index, app] of apps.entries()) {

      try {

        const currentRank = index + 1;

        // GET EXISTING APP
        const { data: existingApp } = await supabase
          .from('apps')
          .select('rank')
          .eq('app_id', app.appId)
          .single();

        const previousRank = existingApp?.rank || currentRank;

        // TREND SCORE
        const trendScore = previousRank - currentRank;

        // MAIN APP DATA
        const appData = {
          app_id: app.appId || 'unknown',
          title: app.title || 'Unknown App',
          developer: app.developer || 'Unknown Developer',
          category: app.genre || categoryObj?.name || 'Unknown',
          score: app.score || 0,
          installs: app.installs || '0+',
          free: app.free ?? true,
          url: app.url || '',
          icon: app.icon || '',
          summary: app.summary || '',
          previous_rank: previousRank,
          rank: currentRank,
          trend_score: trendScore
        };

        // UPSERT APP
        const { error: appError } = await supabase
          .from('apps')
          .upsert(appData, {
            onConflict: 'app_id'
          });

        if (appError) {
          console.log('APP ERROR:', appError);
        }

        // SNAPSHOT DATA
        const snapshotData = {
          app_id: app.appId || 'unknown',
          rank: currentRank,
          score: app.score || 0,
          installs: app.installs || '0+',
          collection: collectionObj?.name || 'UNKNOWN',
          category: categoryObj?.name || app.genre || 'Unknown'
        };

        // INSERT SNAPSHOT
        const { error: snapshotError } = await supabase
          .from('app_snapshots')
          .insert(snapshotData);

        if (snapshotError) {
          console.log('SNAPSHOT ERROR:', snapshotError);
        }

      } catch (appErr) {

        console.log('APP PROCESSING ERROR:', appErr);

      }
    }

  } catch (err) {

    console.log('COLLECTION ERROR:', err);

  }
}

async function run() {

  console.log('Starting multi-category scrape...');

  // GLOBAL COLLECTIONS
  for (const collection of collections) {

    await scrapeCollection(collection);

  }

  // CATEGORY COLLECTIONS
  for (const collection of collections) {

    for (const category of categories) {

      await scrapeCollection(collection, category);

    }
  }

  console.log('Multi-category trend scrape complete!');
}

run();
