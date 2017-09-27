#!/usr/bin/env bash

TAPESTRY_SELF=$0
TAPESTRY_DOCKER_SUDO=
TAPESTRY_DRY_RUN=

################################################################################
# NAME
#     tapestry-run
#
# SYNOPSIS
#     tapestry-run [-h] [-o OUTPUT] [-v] command args...
#
# DESCRIPTION
#     Runs a given command unless the program is in dry-run mode. Redirects
#     stdout to OUTPUT if given.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print the command before running it always
#
#     -o OUTPUT
#         The path to save the stdout of the command (default no redirection)
#
tapestry-run() {
    local opt_output opt_verbose opt OPTIND OPTARG
    opt_verbose=
    while getopts "o:hv" opt; do
        case "$opt" in
            (o) opt_output=$OPTARG;;
            (v) opt_verbose=1;;
            (h) tapestry-usage -n $LINENO;;
        esac
    done
    shift $(($OPTIND-1))

    if [ -n "$opt_verbose" ] || [ -n "$TAPESTRY_DRY_RUN" ]; then
        if [ -n "$opt_output" ]; then
            printf $'RUN:' >&2
            printf $' %q' "$@" >&2
            printf $' > %s\n' "$opt_output" >&2
        else
            printf $'RUN:' >&2
            printf $' %q' "$@" >&2
            printf $'\n' >&2
        fi
    fi

    if [ -z "$TAPESTRY_DRY_RUN" ]; then
        if [ -n "$opt_output" ]; then
            "$@" > "$opt_output"
        else
            "$@"
        fi
    fi
}

################################################################################
# NAME
#     tapestry-extract
#
# SYNOPSIS
#     tapestry-extract [-h] [-l] [-v] -f ARCHIVE [-d DIRECTORY]
#
# DESCRIPTION
#     Extract the ARCHIVE and optionally write the output to DIRECTORY
#     (defaults to current working directory).
#
# OPTIONS
#     -h
#         Print this help message
#
#     -l
#         Print all files extracted
#
#     -v
#         Print commands before running them
#
#     -f ARCHIVE
#         The path to an archive to extract with some recognized file extension
#
#     -d DIRECTORY
#         The directory to output to (default current working directory)
#
tapestry-extract() {
    local opt_archive opt_directory opt_list opt_verbose opt OPTIND OPTARG IFS \
          parts n
    opt_archive=
    opt_directory=
    opt_list=
    opt_verbose=
    while getopts "f:d:hvl" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (l) opt_list=1;;
            (v) opt_verbose=1;;
            (f) opt_archive=$OPTARG;;
            (d) opt_directory=$OPTARG;;
        esac
    done
    shift $(($OPTIND-1))

    if [ -z "$opt_archive" ]; then
        tapestry-usage -n $LINENO -e "Missing required argument: ARCHIVE"
    fi

    IFS=$'.'
    parts=( $opt_archive )
    n=${#parts[@]}

    while [ $n -gt 0 ]; do
        n=$(($n - 1))

        IFS=$'.'
        set -- "${parts[@]:$n:100}"
        case "$*" in
            (tar.gz)
                IFS=$' '

                if ! [ -d "$opt_directory" ]; then
                    mkdir "$opt_directory"
                fi

                tapestry-run ${opt_verbose:+-v} tar \
                    x${opt_list:+v}f "$opt_archive" \
                    ${opt_directory:+-C "$opt_directory"}
                return
                ;;
        esac
    done

    tapestry-usage -n $LINENO -e "Unrecognized extension for $opt_archive"
}

################################################################################
# NAME
#     tapestry-download
#
# SYNOPSIS
#     tapestry-download [-h] [-v] [-p] -u URL -o PATH
#
# DESCRIPTION
#     Download URL and store it to PATH. Tries to download using a few
#     different executables, depending on which are installed and available.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print commands before running them
#
#     -p
#         Print progress while downloading (verbose mode)
#
#     -u URL
#         The URL to download
#
#     -o PATH
#         The path to save the downloaded file in
#
tapestry-download() {
    local opt_url opt_path opt_verbose opt_progress opt OPTIND OPTARG
    opt_url=
    opt_path=
    opt_verbose=
    opt_no_progress=1
    while getopts "u:o:hvp" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (u) opt_url=$OPTARG;;
            (o) opt_path=$OPTARG;;
            (v) opt_verbose=1;;
            (p) opt_no_progress=;;
        esac
    done
    shift $(($OPTIND-1))

    if [ -z "$opt_url" ] || [ -z "$opt_path" ]; then
        printf $'Expected url and path\n' >&2
        printf $'  Got url = %s\n' "$opt_url" >&2
        printf $'  Got path = %s\n' "$opt_path" >&2
        exit 1
    fi

    if hash curl &>/dev/null; then
        tapestry-run ${opt_verbose:+-v} \
            curl ${opt_no_progress:+-s} -L "$opt_url" -o "$opt_path"
    elif hash wget &>/dev/null; then
        tapestry-run ${opt_verbose:+-v} \
            wget ${opt_no_progress:+-q} -O "$opt_path" "$opt_url"
    else
        printf $'Cannot download file from web: no valid executables.\n' >&2
        printf $'Please download the following URL and save it at the\n' >&2
        printf $'following path\n\n' >&2
        printf $'URL = %s\n\n' "$opt_url" >&2
        printf $'PATH = %s\n\n' "$opt_path" >&2
        exit 1
    fi
}

################################################################################
# NAME
#     tapestry-do-depend
#
# SYNOPSIS
#     ./tapestry.sh depend [-h] [-v] [-p]
#
# DESCRIPTION
#     Downloads any dependencies needed to build the Tapestry web server.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print commands before executing them
#
#     -p
#         Show progress while downloading files
#
tapestry-do-depend() {
    local opt_verbose opt_progress opt OPTIND OPTARG has_git has_docker \
          has_docker_perm has_docker_swarm
    opt_verbose=
    opt_progress=
    while getopts ":hvp" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (p) opt_progress=1;;
            (\?) tapestry-usage -n $LINENO -e "Unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    has_git=1
    if ! which git &>/dev/null; then
        printf $'Error: git not installed\n' >&2
        printf $'  Fix: sudo apt-get install git\n\n' >&2
        has_git=
    fi

    has_docker=1
    if ! which docker &>/dev/null; then
        printf $'Error: docker not installed\n' >&2
        printf $'  Fix: sudo apt-get install docker.io\n\n' >&2
        has_docker=
    fi

    has_docker_perm=1
    if ! ${TAPESTRY_DOCKER_SUDO:+sudo} docker ps &>/dev/null; then
        printf $'Error: docker not accessible from current user\n' >&2
        printf $'  Fix: Rerun command with -s: ./tapestry.sh -s docker\n' >&2
        printf $'  Alt: sudo gpasswd -a $USER docker && newgrp docker\n' >&2
        printf $' NOTE: https://askubuntu.com/a/477554\n\n' >&2
        has_docker_perm=
    fi

    has_docker_swarm=1
    if ! ${TAPESTRY_DOCKER_SUDO:+sudo} docker node ls &>/dev/null; then
        printf $'Error: docker swarm not initialized\n' >&2
        printf $'  Fix: %sdocker swarm init\n\n' \
               "${TAPESTRY_DOCKER_SUDO:+sudo }" >&2
        has_docker_swarm=
    fi

    if ! [ "$has_git$has_docker$has_docker_perm$has_docker_swarm" = 1111 ]; then
        printf $'Please fix errors before rerunning this command.\n' >&2
        exit 1
    fi

    if ! [ -e tapestry/pbnj/.git ]; then
        tapestry-run ${opt_verbose:+-v} git submodule update --init
    else
        tapestry-run ${opt_verbose:+-v} git submodule update
    fi

    if ! [ -f tapestry/ispc-v1.9.1-linux.tar.gz ]; then
        tapestry-download \
            -u http://sourceforge.net/projects/ispcmirror/files/v1.9.1/ispc-v1.9.1-linux.tar.gz/download \
            -o tapestry/ispc-v1.9.1-linux.tar.gz \
            ${opt_verbose:+-v} \
            ${opt_progress:+-p}
    fi

    if ! [ -f tapestry/embree-2.16.4.x86_64.linux.tar.gz ]; then
        tapestry-download \
            -u https://github.com/embree/embree/releases/download/v2.16.4/embree-2.16.4.x86_64.linux.tar.gz \
            -o tapestry/embree-2.16.4.x86_64.linux.tar.gz \
            ${opt_verbose:+-v} \
            ${opt_progress:+-p}
    fi
}

################################################################################
# NAME
#     tapestry-do-build
#
# SYNOPSIS
#     ./tapestry.sh build [-h] [-j JOBS] [-t TAG]
#
# DESCRIPTION
#     Builds the Tapestry docker image and compiles using JOBS simultaneous
#     processes for the Makefiles, and stores to the Docker tag TAG.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -j JOBS
#         The number of simultaneous jobs to run in the Docker image (default
#         no simultaneous jobs)
#
#     -t TAG
#         The tag to save the built image under (default "tapestry_tapestry")
#
#     -m
#         Enable minification of JavaScript code
#
tapestry-do-build() {
    local opt_parallel opt_tag opt_verbose opt_minify opt OPTIND OPTARG
    opt_parallel=
    opt_tag=tapestry_tapestry
    opt_verbose=
    opt_minify=
    while getopts ":j:t:hvm" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (j) opt_parallel=$OPTARG;;
            (t) opt_tag=$OPTARG;;
            (v) opt_verbose=1;;
            (m) opt_minify=1;;
            (\?) tapestry-usage -n $LINENO -e "unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    tapestry-run ${opt_verbose:+-v} \
            ${TAPESTRY_DOCKER_SUDO:+sudo} docker build \
            ${opt_parallel:+--build-arg build_parallel="-j $opt_parallel"} \
            ${opt_minify:+--build-arg minifyjs=1} \
            ${opt_tag:+-t "$opt_tag"} \
            tapestry
}

################################################################################
# NAME
#     tapestry-do-run
#
# SYNOPSIS
#     ./tapestry.sh run [-h] [-v] -c CONFIGS -d DATA [-p PORT] [-n NAME] [-t
#     TAG]
#
# DESCRIPTION
#     Create and start the Tapestry Docker service, using the CONFIGS and DATA
#     directories in the Docker containers. The containers run the image
#     provided by TAG and the service will be called NAME. Listens on PORT
#     which should be accessible from different machines, provided the firewall
#     allows it.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print commands before running them
#
#     -c CONFIGS
#         The directory that contains Tapestry configuration files
#
#     -d DATA
#         The directory that contains Tapestry data files
#
#     -p PORT
#         The port to access the Tapestry service at (default "8080")
#
#     -n NAME
#         The name of the Docker service to be created (default "tapestry")
#
#     -t TAG
#         The tag of the previously built Docker image (default
#         "tapestry_tapestry")
#
tapestry-do-run() {
    local opt_verbose opt_config opt_data opt_port opt_name opt_tag opt OPTIND \
          OPTARG
    opt_verbose=
    opt_config=
    opt_data=
    opt_port=8080
    opt_name=tapestry
    opt_tag=tapestry_tapestry
    while getopts ":c:d:p:n:t:hv" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (c) opt_config=$(realpath "$OPTARG");;
            (d) opt_data=$(realpath "$OPTARG");;
            (p) opt_port=$OPTARG;;
            (n) opt_name=$OPTARG;;
            (t) opt_tag=$OPTARG;;
            (\?) tapestry-usage -n $LINENO -e "unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    if [ -z "$opt_config" ] || [ -z "$opt_data" ]; then
        tapestry-usage -n $LINENO -e "expected config and data directories"
        exit 1
    fi

    tapestry-run ${opt_verbose:+-v} \
        ${TAPESTRY_DOCKER_SUDO:+sudo} docker service create \
        --replicas 1 \
        --name "$opt_name" \
        --publish "$opt_port":9010/tcp \
        --mount type=bind,src="$opt_config",dst=/config \
        --mount type=bind,src="$opt_data",dst=/data \
        "$opt_tag"
}

################################################################################
# NAME
#     tapestry-do-logs
#
# SYNOPSIS
#     ./tapestry.sh logs [-h] [-v] [-n NAME]
#
# DESCRIPTION
#     Fetch and print any logs from the most recent service with the given
#     NAME.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print commands before executing them
#
#     -n NAME
#         The name of the service to check (default "tapestry")
#
tapestry-do-logs() {
    local opt_verbose opt_name opt OPTIND OPTARG IFS lines first id id2
    opt_verbose=
    opt_name=tapestry
    while getopts ":n:hv" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (n) opt_name=$OPTARG;;
            (\?) tapestry-usage -n $LINENO -e "Unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    IFS=$'\n'
    lines=( $(tapestry-run ${opt_verbose:+-v} \
                           ${TAPESTRY_DOCKER_SUDO:+sudo} docker service ps \
                           "$opt_name") )

    IFS=$' '
    first=( ${lines[1]} )

    id=${first[0]}
    id2=$(tapestry-run ${opt_verbose:+-v} \
                       ${TAPESTRY_DOCKER_SUDO:+sudo} docker inspect \
                       --format "{{.Status.ContainerStatus.ContainerID}}" "$id")

    tapestry-run ${opt_verbose:+-v} \
        ${TAPESTRY_DOCKER_SUDO:+sudo} docker logs "$id2"
}

################################################################################
# NAME
#     tapestry-do-examples
#
# SYNOPSIS
#     ./tapestry.sh examples [-h] [-v] [-p]
#
# DESCRIPTION
#     Download the example files to use with Tapestry.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Run in verbose mode
#
#     -p
#         Show progress while downloading files
#
tapestry-do-examples() {
    local opt_verbose opt_progress opt OPTIND OPTARG
    opt_verbose=
    opt_progress=
    while getopts ":hvp" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (p) opt_progress=1;;
            (\?) tapestry-usage -n $LINENO -e "Unknown option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    if ! [ -e tapestry_examples.tar.gz ]; then
        tapestry-download \
            -u http://seelab.eecs.utk.edu/tapestry/tapestry_examples.tar.gz \
            -o tapestry_examples.tar.gz \
            ${opt_verbose:+-v} \
            ${opt_progress:+-p}
    fi

    if ! [ -e examples ]; then
        tapestry-extract \
            -f tapestry_examples.tar.gz \
            -d examples \
            ${opt_verbose:+-v}
    fi
}

################################################################################
# NAME
#     tapestry-do-autoscale
#
# SYNOPSIS
#     ./tapestry.sh autoscale [-h] [-v] [-M MAX_CPU] [-m MIN_CPU] [-l
#     MIN_CONTAINERS] [-c COOLDOWN] [-i INTERVAL] [-t TRIGGER] [-n NAME]
#
# DESCRIPTION
#     Monitor the Docker service NAME and scale the number of replicas up or
#     down based on MIN_CPU and MAX_CPU. If the cpu goes above MAX_CPU or below
#     MIN_CPU for TRIGGER consecutive checks (spaced INTERVAL seconds apart),
#     increase or decrease the number of replicas by 1, then sleep for COOLDOWN
#     seconds. The number of replicas will not go below MIN_CONTAINERS, but if
#     the number starts below MIN_CONTAINERS, it will only be increased when
#     the cpu checks occur.
#
# OPTIONS
#
#     -h
#         Print this help message
#
#     -v
#         Print commands before executing them
#
#     -M MAX_CPU
#         The maximum total CPU usage in percent of the machine used by the
#         Docker services (default "10")
#
#     -m MIN_CPU
#         The minimum total CPU usage in percent of the machine used by the
#         Docker services (default "5")
#
#     -l MIN_CONTAINERS
#         The lower bound on the number of replicas that will be scaled down by
#         this script (default "1")
#
#     -c COOLDOWN
#         The number of seconds to wait after scaling up or down the number of
#         replicas (default "5")
#
#     -i INTERVAL
#         The number of seconds to wait between each check (default "2")
#
#     -t TRIGGER
#         The number of consecutive too-high or too-low checks before scaling
#         the service (default "1")
#
#     -n NAME
#         The name of the service to monitor and autoscale (default "tapestry")
#
tapestry-do-autoscale() {
    local opt_verbose opt_max_cpu opt_min_cpu opt_min_containers opt_cooldown \
          opt_interval opt_trigger_threshold opt_name opt OPTIND OPTARG \
          scale_up_counter scale_down_counter cpu replicas lines line IFS parts \
          ids id containers replicas
    opt_verbose=
    opt_max_cpu=1000  # in hundredths of a percent
    opt_min_cpu=500   # in hundredths of a percent
    opt_min_containers=1
    opt_cooldown=5    # in seconds
    opt_interval=2    # in seconds
    opt_trigger_threshold=1  # in number of intervals
    opt_name=tapestry
    while getopts ":hvM:m:l:c:i:t:n:" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (M) opt_max_cpu=${OPTARG}00;;
            (m) opt_min_cpu=${OPTARG}00;;
            (l) opt_min_containers=$OPTARG;;
            (c) opt_cooldown=$OPTARG;;
            (i) opt_interval=$OPTARG;;
            (t) opt_trigger_threshold=$OPTARG;;
            (n) opt_name=$OPTARG;;
            (\?) tapestry-usage -n $LINENO -e "Unknown option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    scale_up_counter=0
    scale_down_counter=0

    ${TAPESTRY_DOCKER_SUDO:+sudo} true  # open sudo session if necessary

    printf $'Monitoring %s...\n' "$opt_name"

    while sleep "$opt_interval"; do
        # Get container IDs for Tapestry nodes

        IFS=$'\n'
        lines=( $(tapestry-run ${opt_verbose:+-v} \
                               ${TAPESTRY_DOCKER_SUDO:+sudo} docker service ps \
                               "$opt_name" --no-resolve) )

        IFS=$' '
        parts=( ${lines[0]} )
        [ "${parts[0]}" = ID ] || printf $'Incorrect format: ID\n' >&2
        [ "${parts[1]}" = NAME ] || printf $'Incorrect format: NAME\n' >&2
        [ "${parts[2]}" = IMAGE ] || printf $'Incorrect format: IMAGE\n' >&2
        [ "${parts[3]}" = NODE ] || printf $'Incorrect format: NODE\n' >&2
        [ "${parts[4]}" = DESIRED ] || printf $'Incorrect format: DESIRED\n' >&2
        [ "${parts[5]}" = STATE ] || printf $'Incorrect format: STATE\n' >&2
        [ "${parts[6]}" = CURRENT ] || printf $'Incorrect format: CURRENT\n' >&2
        [ "${parts[7]}" = STATE ] || printf $'Incorrect format: STATE\n' >&2
        [ "${parts[8]}" = ERROR ] || printf $'Incorrect format: ERROR\n' >&2

        ids=()
        for line in "${lines[@]:1:1000}"; do  # skip header line
            IFS=$' '
            parts=( $line )

            ids+=( "${parts[0]}" )
        done

        # Get actual container IDs for Tapestry instances

        IFS=$'\n'
        lines=( $(tapestry-run ${opt_verbose:+-v} \
                               ${TAPESTRY_DOCKER_SUDO:+sudo} docker ps \
                               --no-trunc --format "{{.Names}}\t{{.ID}}") )

        containers=()
        for line in "${lines[@]}"; do
            IFS=$'\t'
            parts=( $line )

            for id in "${ids[@]}"; do
                case "${parts[0]}" in
                    ($opt_name.*.$id)
                        containers+=( "${parts[1]}" )
                        break
                        ;;
                esac
            done
        done

        # Get stats for the Tapestry instances

        IFS=$'\n'
        lines=( $(tapestry-run ${opt_verbose:+-v} \
                               ${TAPESTRY_DOCKER_SUDO:+sudo} docker stats \
                               --no-stream "${containers[@]}") )

        IFS=$' '
        parts=( ${lines[0]} )
        [ "${parts[0]}" = CONTAINER ] || printf $'Incorrect format: CONTAINER\n' >&2
        [ "${parts[1]}" = CPU ] || printf $'Incorrect format: CPU\n' >&2
        [ "${parts[2]}" = % ] || printf $'Incorrect format: %\n' >&2
        [ "${parts[3]}" = MEM ] || printf $'Incorrect format: MEM\n' >&2
        [ "${parts[4]}" = USAGE ] || printf $'Incorrect format: USAGE\n' >&2
        [ "${parts[5]}" = / ] || printf $'Incorrect format: /\n' >&2
        [ "${parts[6]}" = LIMIT ] || printf $'Incorrect format: LIMIT\n' >&2
        [ "${parts[7]}" = MEM ] || printf $'Incorrect format: MEM\n' >&2
        [ "${parts[8]}" = % ] || printf $'Incorrect format: %\n' >&2
        [ "${parts[9]}" = NET ] || printf $'Incorrect format: NET\n' >&2
        [ "${parts[10]}" = I/O ] || printf $'Incorrect format: I/O\n' >&2
        [ "${parts[11]}" = BLOCK ] || printf $'Incorrect format: BLOCK\n' >&2
        [ "${parts[12]}" = I/O ] || printf $'Incorrect format: I/O\n' >&2
        [ "${parts[13]}" = PIDS ] || printf $'Incorrect format: PIDS\n' >&2

        cpu=0
        for line in "${lines[@]:1:1000}"; do  # skip header line
            IFS=$' '
            parts=( $line )

            # Parse CPU values and compute with them in units of hundredths of
            # a percent
            case "${parts[1]}" in
                (?.??%)    cpu=$(($cpu + ${parts[1]:0:1}${parts[1]:2:2}));;
                (??.??%)   cpu=$(($cpu + ${parts[1]:0:2}${parts[1]:3:2}));;
                (???.??%)  cpu=$(($cpu + ${parts[1]:0:3}${parts[1]:4:2}));;
                (????.??%) cpu=$(($cpu + ${parts[1]:0:4}${parts[1]:5:2}));;
                (*) printf $'Bad CPU value from docker: %s\n' "${parts[1]}" >&2;;
            esac
        done

        if [ "$cpu" -gt "$opt_max_cpu" ]; then
            scale_up_counter=$(($scale_up_counter + 1))
            scale_down_counter=0
        fi

        if [ "$cpu" -lt "$opt_min_cpu" ]; then
            scale_down_counter=$(($scale_down_counter + 1))
            scale_up_counter=0
        fi

        if [ "$cpu" -gt "$opt_min_cpu" ] && [ "$cpu" -lt "$opt_max_cpu" ]; then
            scale_up_counter=0
            scale_down_counter=0
            continue
        fi

        # Determine the current number of replicas

        IFS=$'\n'
        lines=( $(tapestry-run ${opt_verbose:+-v} \
                               ${TAPESTRY_DOCKER_SUDO:+sudo} docker service ls \
                               --filter name="$opt_name") )

        IFS=$' '
        parts=( ${lines[0]} )
        [ "${parts[0]}" = ID ] || printf $'Incorrect format: ID\n' >&2
        [ "${parts[1]}" = NAME ] || printf $'Incorrect format: NAME\n' >&2
        [ "${parts[2]}" = REPLICAS ] || printf $'Incorrect format: REPLICAS\n' >&2
        [ "${parts[3]}" = IMAGE ] || printf $'Incorrect format: IMAGE\n' >&2
        [ "${parts[4]}" = COMMAND ] || printf $'Incorrect format: COMMAND\n' >&2

        # Should only get one line, but could have more
        for line in "${lines[@]:1:1000}"; do  # skip header line
            IFS=$' '
            parts=( $line )

            replicas=${parts[2]%%/*}  # i.e. with 3/4, grab the 3 part
        done

        if [ "$scale_up_counter" -gt "$opt_trigger_threshold" ]; then
            printf $'[%s] Scaling up to %s\n' "$(date)" "$(($replicas + 1))"
            tapestry-run ${opt_verbose:+-v} -o /dev/null \
                         ${TAPESTRY_DOCKER_SUDO:+sudo} docker service scale \
                         "$opt_name=$(($replicas + 1))"
            scale_up_counter=0
            scale_down_counter=0
            sleep "$opt_cooldown"
        fi

        if [ "$scale_down_counter" -gt "$opt_trigger_threshold" ] &&
           [ "$replicas" -gt "$opt_min_containers" ]; then
            printf $'[%s] Scaling down to %s\n' "$(date)" "$(($replicas - 1))"
            tapestry-run ${opt_verbose:+-v} -o /dev/null \
                         ${TAPESTRY_DOCKER_SUDO:+sudo} docker service scale \
                         "$opt_name=$(($replicas - 1))"
            scale_up_counter=0
            scale_down_counter=0
            sleep "$opt_cooldown"
        fi
    done
}

################################################################################
# NAME
#     tapestry-do-scale
#
# SYNOPSIS
#     ./tapestry.sh scale [-h] [-v] [-n NAME] REPLICAS
#
# DESCRIPTION
#     Scale the number of replicas of the service NAME to REPLICAS.
#
# OPTIONS
#     -h
#         Print this help message
#
#     -v
#         Print commands before running them
#
#     -n NAME
#         The name of the service to scale (default "tapestry")
#
tapestry-do-scale() {
    local opt_verbose opt_name opt_replicas opt OPTIND OPTARG
    opt_verbose=
    opt_name=tapestry
    while getopts ":n:hv" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (v) opt_verbose=1;;
            (n) opt_name=$OPTARG;;
            (\?) tapestry-usage -n $LINENO -e "Unknown option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))
    opt_replicas=$1; shift

    if ! [ "$opt_replicas" -eq "$opt_replicas" ] 2>/dev/null; then
        tapestry-usage -n $LINENO -e "REPLICAS must be numeric"
    fi

    if [ "$opt_replicas" -lt 0 ]; then
        tapestry-usage -n $LINENO -e "REPLICAS must be a positive number"
    fi

    tapestry-run ${opt_verbose:+-v} \
        ${TAPESTRY_DOCKER_SUDO:+sudo} docker service scale \
        "$opt_name=$opt_replicas"
}

################################################################################
# NAME
#     tapestry-usage
#
# SYNOPSIS
#     tapestry-usage [-h] [-e] [-n LINENO] [message]
#
# DESCRIPTION
#     Display the usage of the program and optionally display MESSAGE. Exits
#     with a non-zero exit code (if -e is passed).
#
# OPTIONS
#     -h
#         Print this help message
#
#     -e
#         Exit with a non-zero exit code (default exit with a zero exit code)
#
#     -n LINENO
#         Print documentation for the function surrounding LINENO
#
tapestry-usage() {
    local opt_lineno opt_error opt_message opt OPTIND OPTARG IFS line num docs
    opt_lineno=
    opt_error=
    while getopts "n:eh" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (n) opt_lineno=$OPTARG;;
            (e) opt_error=1;;
        esac
    done
    shift $(($OPTIND-1))
    opt_message=$1; shift

    exec 8<&0 <"$TAPESTRY_SELF"
    num=0
    docs=()
    while IFS=$'\n' read -r  line; do
        num=$(($num + 1))

        case "$line" in
            (\#\#\#\#*) docs=();;
            (\#*) docs+=( "$line" );;
        esac

        if [ "$num" -eq "$opt_lineno" ]; then
            IFS=
            for line in "${docs[@]}"; do
                line=${line#\#*}
                line=${line# }
                printf $'%s\n' "${line#\#*}"
            done
            break
        fi
    done
    exec <&8 8<&-

    if [ -n "$opt_message" ]; then
        printf $'Error: %s\n' "$opt_message"
    fi

    if [ -n "$opt_error" ]; then
        exit 1
    else
        exit 0
    fi
}

################################################################################
# NAME
#     tapestry
#
# SYNOPSIS
#     ./tapestry.sh [-s] [-n] [-h] [-v] COMMAND [OPTIONS]
#
# DESCRIPTION
#     Runs the appropriate Tapestry command based on COMMAND, with OPTIONS
#     pertaining to COMMAND.
#
# COMMANDS
#     depend   Download and verify any dependencies for Tapestry
#     build    Build the Docker image for Tapestry
#     run      Create and run the Docker service using the built image
#     logs     Fetch and print any logs from the Tapestry service
#
# OPTIONS
#     -h
#         Print this help message
#
#     -s
#         Run Docker commands using sudo
#
#     -n
#         Do a dry run (no commands actually get run)
#
tapestry() {
    local opt_sudo opt_dryrun opt_action opt OPTIND OPTARG
    opt_sudo=
    opt_dryrun=
    while getopts ":snhv" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (s) opt_sudo=1;;
            (n) opt_dryrun=1;;
            (\?) tapestry-usage -n $LINENO -e "unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))
    opt_action=$1; shift

    if [ -n "$opt_sudo" ]; then
        TAPESTRY_DOCKER_SUDO=1
    fi

    if [ -n "$opt_dryrun" ]; then
        TAPESTRY_DRY_RUN=1
    fi

    case "$opt_action" in
        (depend) tapestry-do-depend "$@";;
        (build) tapestry-do-build "$@";;
        (run) tapestry-do-run "$@";;
        (logs) tapestry-do-logs "$@";;
        (examples) tapestry-do-examples "$@";;
        (autoscale) tapestry-do-autoscale "$@";;
        (scale) tapestry-do-scale "$@";;
        (*) tapestry-usage -n $LINENO -e "Unknown action: '$action'";;
    esac
}

tapestry "$@"
