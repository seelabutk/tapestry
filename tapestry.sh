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
        set -- "${parts[@]:$n:100}"
        case "$*" in
            (tar.gz)
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
        tapestry-run -o "$opt_path" ${opt_verbose:+-v} \
            curl ${opt_no_progress:+-s} -L "$opt_url"
    elif hash wget &>/dev/null; then
        tapestry-run -o "$opt_path" ${opt_verbose:+-v} \
            wget ${opt_no_progress:+-q} -O- "$opt_url"
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
tapestry-do-build() {
    local opt_parallel opt_tag opt_verbose opt OPTIND OPTARG
    opt_parallel=
    opt_tag=tapestry_tapestry
    opt_verbose=
    while getopts ":j:t:hv" opt; do
        case "$opt" in
            (h) tapestry-usage -n $LINENO;;
            (j) opt_parallel=$OPTARG;;
            (t) opt_tag=$OPTARG;;
            (v) opt_verbose=1;;
            (\?) tapestry-usage -n $LINENO -e "unexpected option: -$OPTARG";;
        esac
    done
    shift $(($OPTIND-1))

    tapestry-run ${opt_verbose:+-v} \
            ${TAPESTRY_DOCKER_SUDO:+sudo} docker build \
            ${opt_parallel:+--build-arg build_parallel="-j $opt_parallel"} \
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
    lines=( $(${TAPESTRY_DOCKER_SUDO:+sudo} docker service ps "$opt_name") )

    IFS=$' '
    first=( ${lines[1]} )

    id=${first[0]}
    id2=$(${TAPESTRY_DOCKER_SUDO:+sudo} docker inspect --format "{{.Status.ContainerStatus.ContainerID}}" "$id")

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

    if ! [ -e examples.tar.gz ]; then
        tapestry-download \
            -u http://seelab.eecs.utk.edu/tapestry/tapestry_example_dirs.tar.gz \
            -o examples.tar.gz \
            ${opt_verbose:+-v} \
            ${opt_progress:+-p}
    fi

    if ! [ -e tapestry_example_dirs ]; then
        tapestry-extract \
            -f examples.tar.gz \
            ${opt_verbose:+-v}
    fi
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
        (*) tapestry-usage -n $LINENO -e "Unknown action: '$action'";;
    esac
}

tapestry "$@"
