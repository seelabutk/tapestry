#!/bin/bash

if [ $# -lt 2 ]; then
    echo "Usage: ./run.sh <configs dir> <data dir> [port]"
    exit 2
fi

configs_dir=$1
data_dir=$2

if [ $# -eq 3 ]; then
    port=$3
else
    port=8080
fi

docker service create --replicas 1 --name tapestry -p $port:9010/tcp --mount type=bind,src=$configs_dir,dst=/config --mount type=bind,src=$data_dir,dst=/mnt/seenas1/data tapestry_tapestry 

