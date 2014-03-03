FROM ubuntu
RUN apt-get update && apt-get install -y python-dev python-setuptools imagemagick
RUN easy_install pip

ADD . /converter
WORKDIR /converter
RUN pip install -r requirements.txt
CMD python server.py
