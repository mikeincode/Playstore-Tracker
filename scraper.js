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

    // STATIC APP INFO
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
      rank: index + 1
    };

    // UPSERT INTO APPS TABLE
    const { error: appError } = await supabase
      .from('apps')
      .upsert(appData, {
        onConflict: 'app_id'
      });

    if (appError) {
      console.log(appError);
    }

    // INSERT SNAPSHOT
    const snapshotData = {
      app_id: app.appId,
      rank: index + 1,
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

  console.log('Scrape complete!');
}

run();
