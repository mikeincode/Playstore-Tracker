const gplay = require("google-play-scraper");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      disabled: true,
    },
  }
);

async function scrapeApps() {
  try {
    console.log("Starting scrape...");

    const apps = await gplay.list({
      category: gplay.category.APPLICATION,
      collection: gplay.collection.TOP_FREE,
      num: 50,
      country: "us",
    });

    console.log(`Found ${apps.length} apps`);

    const snapshotDate = new Date().toISOString();

    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];

      const appData = {
        app_id: app.appId || null,
        title: app.title || null,
        developer: app.developer || null,
        summary: app.summary || null,
        score: app.score || null,
        installs: app.installs || null,
        free: app.free || false,
        category: app.genre || null,
        icon: app.icon || null,
        url: app.url || null,
        rank: i + 1,
        created_at: snapshotDate,
      };

      console.log(`Saving ${appData.title}`);

      // Save/update master apps table
      const { error: appError } = await supabase
        .from("apps")
        .upsert(appData, {
          onConflict: "app_id",
        });

      if (appError) {
        console.error("Apps table error:", appError);
      }

      // Save snapshot history
      const { error: snapshotError } = await supabase
        .from("app_snapshots")
        .insert({
          app_id: appData.app_id,
          rank: appData.rank,
          score: appData.score,
          installs: appData.installs,
          category: appData.category,
          snapshot_date: snapshotDate,
        });

      if (snapshotError) {
        console.error("Snapshot error:", snapshotError);
      }
    }

    console.log("Scrape completed successfully");
  } catch (err) {
    console.error("SCRAPER FAILED:");
    console.error(err);
    process.exit(1);
  }
}

scrapeApps();
