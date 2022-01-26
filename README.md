<p align="center">
  <b style="font-size: 32px;">Pythia Twitter Bot </b>
</p>

<p align="center">
  <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="JavaScript Style Guide"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg" alt="Conventional Commits"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen Friendly"></a>
  <a href="https://github.com/prettier/prettier"><img src="https://img.shields.io/badge/styled_with-prettier-ff69b4.svg" alt="Styled with Prettier"></a>
</p>

Watch and tweet about pythia accusations.

## Prerequisites

- NodeJS version 10

## Get Started

1.  Clone this repo.
2.  Duplicate `.env.example`, rename it to `.env` and fill in the environment variables.
3.  Run `yarn` to install dependencies and then `yarn start` to run the service in development mode.

> To run the service in production mode use `node -r dotenv/config index.js`.

> To start with PM2 use `pm2 start --node-args="-r dotenv/config" index.js --name pythia-twitter`

## Other Scripts

- `yarn format` - Lint, fix and prettify all the project.
  .js files with styled components and .js files.
- `yarn run cz` - Run commitizen.
