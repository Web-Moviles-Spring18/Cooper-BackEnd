#!/usr/bin/env sh
set -x

export NODE_ENV=production
export NVM_BIN=$HOME/.nvm/versions/node/v6.9.0/bin

cd $REMOTE_APP_DIR && \
tar zxvf package.tgz -C . && \
mv dist/package.json . && \
npm install && \
cp .env dist/.env && \
pm2 start dist/server.js -i max — name="cooper-production"
