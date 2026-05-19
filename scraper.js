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

    // GET TOP FREE APPS
    const apps = await gplay.list({
      collection: "TOP_FREE",
      num: 50,
      country: "us",
    });

    console.log(`Found ${apps.length} apps`);

    const snapshotDate =
      new Date().toISOString();

    // LOOP THROUGH APPS
    for (let i = 0; i < apps.length; i++) {

      const basicApp = apps[i];

      // GET FULL APP DETAILS
      const app = await gplay.app({
  appId: basicApp.appId,
});

      console.log(
        `Fetching ${app.title}`
      );

      // GET PREVIOUS RANK
      const { data: existing } =
        await supabase
          .from("apps")
          .select("rank")
          .eq("app_id", app.appId)
          .single();

      const previousRank =
        existing?.rank || i + 1;

      // TREND SCORE
      const trendScore =
        previousRank - (i + 1);

      // APP DATA OBJECT
      const appData = {

        // BASIC INFO
        app_id:
          app.appId || null,

        title:
          app.title || "Unknown",

        developer:
          app.developer || "Unknown",

        category:
          app.genre ||
          app.genreId ||
          app.categories?.[0]?.name ||
          app.categories?.[0] ||
          "Other",

        // RATINGS
        score:
          app.score || 0,

        ratings:
  app.ratings || 0,

reviews:
  app.reviews || 0,

updated:
  app.updated || null,

released:
  app.released || null,

version:
  app.version || null,

content_rating:
  app.contentRating || null,

size:
  app.size || null,

developer_website:
  app.developerWebsite || null,
        ratings:
          app.ratings || 0,

        reviews:
          app.reviews || 0,

        // INSTALLS
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

        // APP DETAILS
        free:
          app.free ?? true,

        version:
          app.version || null,

        size:
          app.size || null,

        updated:
          app.updated || null,

        released:
          app.released || null,

        content_rating:
          app.contentRating || null,

        developer_website:
          app.developerWebsite || null,

        // MEDIA
        icon:
          app.icon ||
          app.headerImage ||
          "",

        screenshots:
          app.screenshots || [],

        // LINKS
        url:
          app.url || "",

        // TEXT
        summary:
          app.summary || "",

        description:
  app.description || "",

screenshots:
  app.screenshots || [],
        // RANKING
        rank:
          i + 1,

        previous_rank:
          previousRank,

        trend_score:
          trendScore,
        
        momentum_score:
          trendScore * (app.score || 1),

        // SNAPSHOT DATE
        snapshot_date:
          snapshotDate,
      };

      console.log(
        `Saving ${appData.title}`
      );

      // UPSERT MAIN APPS TABLE
      const { error: appError } =
        await supabase
          .from("apps")
          .upsert(appData, {
            onConflict: "app_id",
          });

      if (appError) {

        console.error(
          "Apps table error:",
          appError
        );

      }

      // INSERT SNAPSHOT HISTORY
      const { error: snapshotError } =
        await supabase
          .from("app_snapshots")
          .insert({

            app_id:
              appData.app_id,

            title:
              appData.title,

            category:
              appData.category,

            rank:
              appData.rank,

            previous_rank:
              appData.previous_rank,

            trend_score:
              appData.trend_score,

            momentum_score:
              appData.momentum_score,

            score:
              appData.score,

            ratings:
              appData.ratings,

            reviews:
              appData.reviews,

            installs:
              appData.installs,

            snapshot_date:
              snapshotDate,
          });

      if (snapshotError) {

        console.error(
          "Snapshot error:",
          snapshotError
        );

      }

      // SMALL DELAY
      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );
    }

    console.log(
      "Scrape complete!"
    );

  } catch (err) {

    console.error(
      "SCRAPER FAILED:"
    );

    console.error(err);

    process.exit(1);
  }
}

scrapeApps();
