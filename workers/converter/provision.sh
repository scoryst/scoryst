install_retry() {
  local retry=5 count=0

  # try to download at most $retry times
  while true; do
      sudo apt-get update
      if sudo apt-get install -y $@; then
          break
      fi

      if (( count++ == retry )); then
          printf 'Install failed\n' >&2
          return 1
      fi

      sleep 5
  done
}

install_retry python-dev python-setuptools imagemagick libjpeg-dev
sudo easy_install pip

sudo pip install -r requirements.txt
nohup python server.py >& /dev/null < /dev/null &
echo "Finished provisioning..."
