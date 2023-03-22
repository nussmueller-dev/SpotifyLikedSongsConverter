# 🎧 Spotify Bot

This is a Node.js and TypeScript-based bot that converts your liked songs to a normal playlist on Spotify. It uses the `spotify-web-api-node` library to interact with the Spotify API.

## 🚀 Deployment with Docker

1. Clone the repository: `git clone https://github.com/Borelio/SpotifyLikedSongsConverter.git`
2. Build the Docker image: `docker build -t spotify-bot .`
3. Run the Docker container: `docker run -it --env-file .env spotify-bot`

## 💻 Usage

1. Rename the `.env.example` file to `.env` and fill in your Spotify API credentials.
2. Run the bot: `npm start`
3. The bot will prompt you to select the playlist you want to add your liked songs to. After you select the playlist, the bot will create a new playlist and add all your liked songs to it.

## 📦 Installation

1. Clone the repository: `git clone https://github.com/Borelio/SpotifyLikedSongsConverter.git`
2. Install dependencies: `npm install`

## 🙏 Credits

- [Spotify Web API Node](https://github.com/thelinmichael/spotify-web-api-node) library for interacting with the Spotify API.
