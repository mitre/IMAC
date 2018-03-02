#!/bin/bash

echo "id|name|desc
1|foo|test
2|bar|test2" > sample_data.psv

echo "loading sample"
sample_id=`curl -s -X POST --data-binary @sample_data.psv localhost:8080/load/foobar`

if [ $? -ne 0 ] ; then
    echo "$sample_id"
    exit 127
fi

echo "pop items"
curl -s localhost:8080/next/$sample_id | python -m json.tool > post_false.json
curl -s localhost:8080/next/$sample_id | python -m json.tool > post_true.json

curl -s -X POST --data-binary @post_false.json localhost:8080/false/$sample_id
curl -s -X POST --data-binary @post_true.json localhost:8080/true/$sample_id

echo "Tester" | curl -s -X POST --data-binary @- localhost:8080/result/$sample_id | python -m json.tool
