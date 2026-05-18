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

    const snapshotDate =
      new Date().toISOString();

    for (let i = 0; i < apps.length; i++) {

      const app = apps[i];

console.log(app);
break;

      // GET PREVIOUS RANK
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

      const appData = {

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

        free:
          app.free ?? true,

        icon:
          app.icon ||
          app.headerImage ||
          "",

        url:
          app.url || "",

        summary:
          app.summary || "",

        rank:
          i + 1,

        previous_rank:
          previousRank,

        trend_score:
          trendScore,

        snapshot_date:
          snapshotDate,
      };

      console.log(
        `Saving ${appData.title}`
      );

      // UPSERT APPS TABLE
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

      // INSERT SNAPSHOT TABLE
      const { error: snapshotError } =
        await supabase
          .from("app_snapshots")
          .insert({

            app_id:
              appData.app_id,

            rank:
              appData.rank,

            score:
              appData.score,

            installs:
              appData.installs,

            category:
              appData.category,

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
