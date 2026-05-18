const gplay = require('google-play-scraper');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      disabled: true,
    },
  }
);

const today = new Date().toISOString().split('T')[0];

async function fetchPreviousRanks() {
  const { data, error } = await supabase
    .from('apps')
    .select('app_id, rank');

  if (error) {
    console.error('Error fetching previous ranks:', error);
    return {};
  }

  const rankMap = {};

  data.forEach((app) => {
    rankMap[app.app_id] = app.rank;
  });

  return rankMap;
}

function calculateTrendScore(previousRank, currentRank) {
  if (!previousRank || !currentRank) return 0;

  const movement = previousRank - currentRank;

  return Math.max(
    0,
    Math.min(100, movement * 10)
  );
}

async function run() {
  console.log('Starting scraper...');

  const previousRanks = await fetchPreviousRanks();

  const collections = [
    gplay.collection.TOP_FREE,
    gplay.collection.GROSSING,
    gplay.collection.TRENDING,
  ];

  let rankCounter = 1;

  for (const collection of collections) {
    console.log(`Fetching collection: ${collection}`);

    let apps = [];

    try {
      apps = await gplay.list({
        collection,
        num: 50,
      });
    } catch (err) {
      console.error(`Failed collection ${collection}`, err);
      continue;
    }

    for (const app of apps) {
      try {
        const previousRank =
          previousRanks[app.appId] || null;

        const trendScore = calculateTrendScore(
          previousRank,
          rankCounter
        );

        const appData = {
          app_id: app.appId || null,

          title: app.title || 'Unknown',

          developer:
            app.developer || 'Unknown',

          category:
            app.genre ||
            app.category ||
            app.categories?.[0] ||
            'Unknown',

          collection:
            app.collection ||
            app.genreId ||
            collection ||
            'general',

          score: app.score || 0,

          installs:
            app.installs ||
            app.realInstalls ||
            app.minInstalls ||
            '0+',

          free: app.free ?? true,

          url: app.url || '',

          icon:
            app.icon ||
            app.headerImage ||
            '',

          summary:
            app.summary ||
            app.description?.slice(0, 120) ||
            '',

          rank: rankCounter,

          snapshot_date: today,

          previous_rank: previousRank,

          trend_score: trendScore,
        };

        console.log(
          `Saving ${appData.title} (${rankCounter})`
        );

        // UPSERT MAIN APPS TABLE
        const { error: appsError } =
          await supabase
            .from('apps')
            .upsert(appData, {
              onConflict: 'app_id',
            });

        if (appsError) {
          console.error(
            'Apps table error:',
            appsError
          );
        }

        // INSERT SNAPSHOT TABLE
        const { error: snapshotError } =
          await supabase
            .from('app_snapshots')
            .insert({
              ...appData,
            });

        if (snapshotError) {
          console.error(
            'Snapshot error:',
            snapshotError
          );
        }

        rankCounter++;

        await new Promise((resolve) =>
          setTimeout(resolve, 250)
        );
      } catch (err) {
        console.error(
          `Failed app ${app.appId}`,
          err
        );
      }
    }
  }

  console.log('Scrape complete.');
}

run();
