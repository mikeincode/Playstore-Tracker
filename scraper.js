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
  collection: "TOP_FREE",
  num: 50,
  country: "us",
});

    console.log(`Found ${apps.length} apps`);

    const snapshotDate =
      new Date().toISOString();

    for (let i = 0; i < apps.length; i++) {

      const basicApp = apps[i];

      // FULL APP DETAILS
      const app = await gplay.app({
        appId: basicApp.appId,
      });

      console.log(
        `Processing ${app.title}`
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

      const currentRank =
        i + 1;

      // TREND SCORE
      const trendScore =
        previousRank - currentRank;

      // GROWTH VELOCITY
      const growthVelocity =
        trendScore > 0
          ? trendScore * 2
          : 0;

      // DECAY VELOCITY
      const decayVelocity =
        trendScore < 0
          ? Math.abs(trendScore) * 2
          : 0;

      // NEGLECTED SCORE
      const neglectedScore =
        (
          currentRank > 50
            ? 25
            : 0
        ) +
        (
          app.score < 3.5
            ? 20
            : 0
        ) +
        (
          app.ratings > 100000
            ? 15
            : 0
        );

      // USER FRUSTRATION
      const frustrationScore =
        (
          app.score < 2.5
            ? 40
            : 0
        ) +
        (
          app.reviews > 5000
            ? 20
            : 0
        ) +
        (
          app.ratings > 100000
            ? 20
            : 0
        );

      // MONETIZATION GAP
      const monetizationGap =
        (
          app.minInstalls > 1000000
            ? 30
            : 0
        ) +
        (
          app.score < 3.8
            ? 20
            : 0
        ) +
        (
          app.offersIAP
            ? 10
            : 0
        );

      // CLONE SCORE
      const cloneScore =
        (
          app.minInstalls > 5000000
            ? 35
            : 0
        ) +
        (
          app.score < 4.0
            ? 20
            : 0
        ) +
        (
          currentRank <= 25
            ? 15
            : 0
        );

      // SATURATION SCORE
      const saturationScore =
        (
          currentRank <= 10
            ? 30
            : 0
        ) +
        (
          app.ratings > 1000000
            ? 25
            : 0
        );

      // OPPORTUNITY SCORE
      const opportunityScore =
        growthVelocity +
        neglectedScore +
        frustrationScore +
        monetizationGap +
        cloneScore -
        saturationScore;

      // TREND LABEL
      let trendLabel =
        "Stable";

      if (trendScore >= 15) {

        trendLabel =
          "Exploding";

      } else if (
        trendScore >= 5
      ) {

        trendLabel =
          "Rising";

      } else if (
        trendScore <= -15
      ) {

        trendLabel =
          "Crashing";

      } else if (
        trendScore <= -5
      ) {

        trendLabel =
          "Declining";
      }

      // MOMENTUM SCORE
      const momentumScore =
        (
          trendScore * 10
        ) +
        (
          (app.score || 0) * 5
        ) +
        (
          (app.ratings || 0)
          / 1000000
        );

      // MAIN APP OBJECT
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

        score:
          app.score || 0,

        ratings:
          app.ratings || 0,

        reviews:
          app.reviews || 0,

        installs:
          app.installs ||
          (
            app.realInstalls
              ? app.realInstalls
                  .toLocaleString() + "+"
              : null
          ) ||
          (
            app.minInstalls
              ? app.minInstalls
                  .toLocaleString() + "+"
              : null
          ) ||
          (
            app.maxInstalls
              ? app.maxInstalls
                  .toLocaleString() + "+"
              : null
          ) ||
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
          app.summary ||
          app.description ||
          "",

        updated:
          app.updated
            ? new Date(
                app.updated
              ).toISOString()
            : null,

        released:
          app.released || null,

        version:
          app.version || null,

        content_rating:
          app.contentRating ||
          null,

        size:
          app.size ||
          app.appSize ||
          app.sizeText ||
          "Unknown",

        developer_website:
          app.developerWebsite ||
          null,

        trend_score:
          trendScore,

        growth_velocity:
          growthVelocity,

        decay_velocity:
          decayVelocity,

        neglected_score:
          neglectedScore,

        frustration_score:
          frustrationScore,

        monetization_gap:
          monetizationGap,

        clone_score:
          cloneScore,

        saturation_score:
          saturationScore,

        opportunity_score:
          opportunityScore,

        trend_label:
          trendLabel,

        momentum_score:
          momentumScore,

        rank:
          currentRank,

        previous_rank:
          previousRank,

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
            onConflict:
              "app_id",
          });

      if (appError) {

        console.error(
          "Apps table error:"
        );

        console.error(
          appError
        );
      }

      // INSERT SNAPSHOT
      const {
        error: snapshotError
      } =
        await supabase
          .from(
            "app_snapshots"
          )
          .insert({

            app_id:
              appData.app_id,

            title:
              appData.title,

            category:
              appData.category,

            installs:
              appData.installs,

            score:
              appData.score,

            ratings:
              appData.ratings,

            reviews:
              appData.reviews,

            updated:
              appData.updated,

            released:
              appData.released,

            version:
              appData.version,

            content_rating:
              appData.content_rating,

            size:
              appData.size,

            developer_website:
              appData.developer_website,

            trend_score:
              appData.trend_score,

            momentum_score:
              appData.momentum_score,

            growth_velocity:
              appData.growth_velocity,

            decay_velocity:
              appData.decay_velocity,

            neglected_score:
              appData.neglected_score,

            frustration_score:
              appData.frustration_score,

            monetization_gap:
              appData.monetization_gap,

            clone_score:
              appData.clone_score,

            saturation_score:
              appData.saturation_score,

            opportunity_score:
              appData.opportunity_score,

            trend_label:
              appData.trend_label,

            rank:
              appData.rank,

            previous_rank:
              appData.previous_rank,

            snapshot_date:
              snapshotDate,
          });

      if (snapshotError) {

        console.error(
          "Snapshot error:"
        );

        console.error(
          snapshotError
        );
      }

      // SMALL DELAY
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            400
          )
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
