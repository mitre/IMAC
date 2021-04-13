#!/bin/bash

# Remove backups older than 120 days
find /opt/imac/backups/* -mtime +120 -exec rm {} \;

# Backup mongodb with mongodump
ARCHIVE_FILE=/opt/imac/backups/imac-mongodb-$(date --utc -Iminutes).archive.gzip
mongodump --gzip --archive=$ARCHIVE_FILE

# Restore using this command
# mongorestore --gzip --archive=/path/to/archive.gzip
