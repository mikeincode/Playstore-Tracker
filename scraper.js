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

// COLLECTIONS TO TRACK
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

// CATEGORIES TO TRACK
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

    const apps = await gplay.list({
      collection: collectionObj.collection,
      category: categoryObj?.category,
      num: 50
    });

    console.log(
      `Scraping ${collectionObj.name} ${categoryObj?.name || 'ALL'}`
    );

    for (const [index, app] of apps.entries()) {

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

      // UPSERT MAIN APP
      const appData = {
        app_id: app.appId,
        title: app.title,
        developer: app.developer,
        category: app.genre,
        score: app.score,
        installs: app.installs,
        free: app.free,
        url: app.url,
        icon: app.icon,
        summary: app.summary,
        previous_rank: previousRank,
        rank: currentRank,
        trend_score: trendScore
      };

      const { error: appError } = await supabase
        .from('apps')
        .upsert(appData, {
          onConflict: 'app_id'
        });

      if (appError) {
        console.log(appError);
      }

      // SNAPSHOT HISTORY
      const snapshotData = {
        app_id: app.appId,
        rank: currentRank,
        score: app.score,
        installs: app.installs,
        collection: collectionObj.name,
        category: categoryObj?.name || app.genre
      };

      const { error: snapshotError } = await supabase
        .from('app_snapshots')
        .insert(snapshotData);

      if (snapshotError) {
        console.log(snapshotError);
      }
    }

  } catch (err) {
    console.log(err);
  }
}

async function run() {

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
