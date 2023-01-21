const compression = require("compression");
const express = require("express");
// const app = express();
const path = require("path");
const fs = require("fs");

const cors = require("cors");
const fetch = require("node-fetch");
const nodeCache = require("node-cache");
const ytdl = require("ytdl-core");

const myCache = new nodeCache({ stdTTL: 3600, checkperiod: 3000 });
const app = express();

app.use(compression());
app.use(express.static("public"));

const port = process.env.PORT || 8888;

const api_key = "04c35731a5ee918f014970082a0088b1";
const appendVideos = "&append_to_response=videos";
const movieUrl = "https://api.themoviedb.org/3/movie/";
const popularMovieUrl = "https://api.themoviedb.org/3/discover/movie";
const trendingMovieUrl = "https://api.themoviedb.org/3/trending/movie/day";

app.get("/video", (req, res) => {
  res.sendFile("movie.mp4", { root: path.join(__dirname, "public") });
});

const downloadAndGetVideoPath = (id) => {
  let videoUrl = "https://www.youtube.com/watch?v=";
  const downloaddedvideo = ytdl(videoUrl + id, {
    format: "mp4",
  }).pipe(fs.createWriteStream(`./${id}.mp4`));
  downloaddedvideo.on("finish", () => {
    console.log(`${id}.mp4 is done`);
  });
};

const getInitialTrendingMovies = async () => {
  let data;
  try {
    //const trending = await fetch(`${trendingMovieUrl}?&api_key=${api_key}`);
    const trending = await fetch(`${popularMovieUrl}?api_key=${api_key}&sort_by=popularity.desc`)
    data = await trending.json();
    return data;
  } catch (e) {
    console.log(e);
  }
};

app.get("/slidedata", cors(), (req, res) => {
  let the_host = req.get("host");
  if (myCache.has("upcomingmoviesallk")) {
    return res.send(myCache.get("upcomingmoviesallk"));
  } else {
    getInitialTrendingMovies().then((data) => {
      const trendingmoviesarray = [];
      if (data) {
        data.results.slice(0, 6).map(({ id }) => trendingmoviesarray.push(id));
      }
      Promise.all(
        trendingmoviesarray.map(async (currentid) => {
          const dataApi = await fetch(
            `${movieUrl}${currentid}?api_key=${api_key}${appendVideos}`
          );
          const trendingmoviesupdated = await dataApi.json();
          return trendingmoviesupdated;
        })
      ).then((data) => {
        let trendingmoviesupdated_data = [];
        if (data) {
          data.forEach(
            ({
              id,
              backdrop_path,
              poster_path,
              genres,
              overview,
              release_date,
              title,
              vote_average,
              videos,
            }) => {
              let youtubeID = "";
              //**** return first none empty youtube trailer or clip ****
              let vid = videos?.results.find((vd) =>
                vd.site !== "Youtube"
                  ? vd.type === "Trailer"
                    ? vd
                    : vd.type === "Clip"
                    ? vd
                    : null
                  : null
              );
              //**** return the ID of the first none empty youtube trailer or clip ****
              if (vid) {
                for (const key in vid) {
                  if (Object.hasOwnProperty.call(vid, key)) {
                    const element = vid[key];
                    if (key === "key") {
                      youtubeID = element;
                    }
                  }
                }
              }
              //**** pass the ID to the function to download the video ****
              //check if file exist
              let theFile = `./${youtubeID}.mp4`;
              if (fs.existsSync(theFile)) {
                console.log(`DON'T DOWNLOAD ME PLEASE!---${youtubeID}.mp4`);
              } else {
                downloadAndGetVideoPath(youtubeID);
              }
              //**** push key and value pair to the trendingmoviesupdated_data aaray ****
              trendingmoviesupdated_data.push({
                id: id,
                poster_path: poster_path,
                backdrop_path: backdrop_path,
                genres: genres,
                overview: overview,
                release_date: release_date,
                title: title,
                vote_average: vote_average,
                videos: `${the_host}/stream/${youtubeID}`,
                //videos: `https://etrailers.netlify.app/.netlify/functions/api/video/${youtubeID}`
                //videos: youtubeID,
              });
            }
          );
        }
        myCache.set("upcomingmoviesallk", trendingmoviesupdated_data);
        res.send(trendingmoviesupdated_data);
      });
    });
  }
});

//**** route for the downloaded videos ****
//video/:id
app.get("/stream/:id", async function (req, res) {
  const { id } = req.params;
  if (id) {
    res.sendFile(`${id}.mp4`, { root: "." });
  }
});

app.listen(port, () => {
  console.log("Etrailer Server");
});

module.exports = app;
