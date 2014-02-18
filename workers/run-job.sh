sudo apt-get update
sudo apt-get install -y python-dev python-setuptools imagemagick
sudo easy_install pip
sudo pip install virtualenv
cd converter
virtualenv --no-site-packages .
source bin/activate
pip install -r requirements.txt
python converter.py -payload payload -id 3 -d /tmp
