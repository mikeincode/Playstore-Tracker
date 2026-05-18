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

async function run() {

  const apps = await gplay.list({
    collection: gplay.collection.TOP_FREE,
    num: 50
  });

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

    // UPSERT APP
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

    // SNAPSHOT INSERT
    const snapshotData = {
      app_id: app.appId,
      rank: currentRank,
      score: app.score,
      installs: app.installs
    };

    const { error: snapshotError } = await supabase
      .from('app_snapshots')
      .insert(snapshotData);

    if (snapshotError) {
      console.log(snapshotError);
    }
  }

  console.log('Trend scrape complete!');
}

run();
