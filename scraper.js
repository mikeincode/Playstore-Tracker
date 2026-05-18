const gplay = require("google-play-scraper");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: {
      transport: WebSocket,
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
        title: app.title || "Unknown",
        developer: app.developer || "Unknown",

        category:
          app.genre ||
          app.category ||
          "Unknown",

        score: app.score || 0,

        installs:
          app.installs ||
          app.realInstalls ||
          "0+",

        free: app.free ?? true,

        icon:
          app.icon ||
          app.headerImage ||
          "",

        url: app.url || "",

        summary:
          app.summary ||
          "",

        rank: i + 1,
      };

      console.log(
        `Saving ${appData.title}`
      );

      // GET OLD RANK
      const { data: existing } =
        await supabase
          .from("apps")
          .select("rank")
          .eq("app_id", app.appId)
          .single();

      const previousRank =
        existing?.rank || i + 1;

      const trendScore =
        previousRank - (i + 1);

      // UPSERT MAIN TABLE
      const { error: appError } =
        await supabase
          .from("apps")
          .upsert({
            ...appData,
            previous_rank: previousRank,
            trend_score: trendScore,
            snapshot_date: snapshotDate,
          }, {
            onConflict: "app_id",
          });

      if (appError) {
        console.error(appError);
      }

      // INSERT SNAPSHOT
      const { error: snapError } =
        await supabase
          .from("app_snapshots")
          .insert({
            app_id: app.appId,
            rank: i + 1,
            score: app.score || 0,
            installs:
              app.installs ||
              app.realInstalls ||
              "0+",
            category:
              app.genre ||
              "Unknown",
            snapshot_date: snapshotDate,
          });

      if (snapError) {
        console.error(snapError);
      }
    }

    console.log("Scrape complete!");

  } catch (err) {

    console.error(err);
    process.exit(1);

  }
}

scrapeApps();
