const gplay = require('google-play-scraper');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      enabled: false
    }
  }
);

async function run() {

  const apps = await gplay.list({
    collection: gplay.collection.TOP_FREE,
    num: 50
  });

  const cleaned = apps.map((app, index) => ({
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
  }));

  const { data, error } = await supabase
    .from('apps')
    .insert(cleaned);

  if (error) {
    console.log(error);
  } else {
    console.log('Apps added!');
  }
}

run();
