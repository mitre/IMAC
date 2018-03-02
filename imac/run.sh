#!/bin/bash

here="$(dirname $0)"
versioninfo="${here}/version.info"

echo "server starting: " > $versioninfo
date >> $versioninfo

echo "---------------------------
git remote:
" >> $versioninfo
git -C "${here}" remote --verbose >> $versioninfo

echo "---------------------------

git branch:" >> $versioninfo
git -C "${here}" branch >> $versioninfo

echo "---------------------------

last log: " >> $versioninfo
git -C "${here}" log -1 >> $versioninfo

echo "---------------------------

status: " >> $versioninfo
git -C "${here}" status --short >> $versioninfo

cat $versioninfo

export NODE_PATH="${here}/node_modules:${NODE_PATH}"
DEBUG=node_app:* node ${here}/bin/www
