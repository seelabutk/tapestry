sudo docker service create --replicas 1 --name tapestry -p 8012:9010/tcp --mount type=bind,src=/home/mahmadza/tapestry_configs,dst=/config --mount type=bind,src=/mnt/seenas1/data,dst=/mnt/seenas1/data tapestry_tapestry 

