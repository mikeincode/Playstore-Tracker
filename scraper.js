const gplay = require("google-play-scraper").default;
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
      collection: "TOP_FREE",
      num: 50,
      country: "us",
    });

    console.log(`Found ${apps.length} apps`);

    const snapshotDate = new Date().toISOString();

    for (let i = 0; i < apps.length; i++) {
      const basicApp = apps[i];

      // GET FULL APP DETAILS
      const app = await gplay.app({
        appId: basicApp.appId,
      });

      console.log(`Processing ${app.title}`);

      // GET PREVIOUS RANK
      const { data: existing } = await supabase
        .from("apps")
        .select("rank")
        .eq("app_id", app.appId)
        .single();

      const previousRank = existing?.rank || i + 1;

      const trendScore = previousRank - (i + 1);

      // MOMENTUM SCORE
      const momentumScore =
        trendScore * 10 +
        (app.score || 0) * 5 +
        ((app.ratings || 0) / 1000000);

      // MAIN APP DATA
      const appData = {
        app_id: app.appId || null,

        title: app.title || "Unknown",

        developer: app.developer || "Unknown",

        category:
          app.genre ||
          app.genreId ||
          app.categories?.[0]?.name ||
          app.categories?.[0] ||
          "Other",

        score: app.score || 0,

        ratings: app.ratings || 0,

        reviews: app.reviews || 0,

        installs:
          app.installs ||
          (app.realInstalls
            ? app.realInstalls.toLocaleString() + "+"
            : null) ||
          (app.minInstalls
            ? app.minInstalls.toLocaleString() + "+"
            : null) ||
          (app.maxInstalls
            ? app.maxInstalls.toLocaleString() + "+"
            : null) ||
          "Unknown",

        free: app.free ?? true,

        icon:
          app.icon ||
          app.headerImage ||
          "",

        url: app.url || "",

        summary:
          app.summary ||
          app.description ||
          "",

        updated: app.updated
          ? new Date(app.updated).toISOString()
          : null,

        released: app.released || null,

        version: app.version || null,

        content_rating:
          app.contentRating || null,

        size: app.size || null,

        developer_website:
          app.developerWebsite || null,

        rank: i + 1,

        previous_rank: previousRank,

        trend_score: trendScore,

        momentum_score: momentumScore,

        snapshot_date: snapshotDate,
      };

      console.log(`Saving ${appData.title}`);

      // UPSERT APPS TABLE
      const { error: appError } =
        await supabase
          .from("apps")
          .upsert(appData, {
            onConflict: "app_id",
          });

      if (appError) {
        console.error(
          "Apps table error:"
        );

        console.error(appError);
      }

      // INSERT SNAPSHOT
      const { error: snapshotError } =
        await supabase
          .from("app_snapshots")
          .insert({
            app_id: appData.app_id,

            rank: appData.rank,

            score: appData.score,

            installs: appData.installs,

            category: appData.category,

            ratings: appData.ratings,

            reviews: appData.reviews,

            trend_score:
              appData.trend_score,

            momentum_score:
              appData.momentum_score,

            snapshot_date:
              snapshotDate,
          });

      if (snapshotError) {
        console.error(
          "Snapshot error:"
        );

        console.error(snapshotError);
      }

      // SMALL DELAY
      await new Promise((resolve) =>
        setTimeout(resolve, 400)
      );
    }

    console.log("Scrape complete!");
  } catch (err) {
    console.error("SCRAPER FAILED:");
    console.error(err);
    process.exit(1);
  }
}

scrapeApps();
