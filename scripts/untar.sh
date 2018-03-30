#!/usr/bin/env sh
set -x

export NODE_ENV=production
export NVM_BIN=$HOME/.nvm/versions/node/v6.9.0/bin

cd $1 && \
tar zxvf package.tgz -C . && \
mv dist/package.json . && \
npm install && \
pm2 start dist/server.js -i max —-name="cooper-production"
