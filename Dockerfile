FROM nikolaik/python-nodejs:python3.12-nodejs18

ARG NPMRC

WORKDIR /opt/chain-hotwallet-refills

COPY . .

RUN apt-get update && \
    apt-get install -y libtool libc6-dev build-essential git python3 && \
    echo ${NPMRC} | base64 -di > $HOME/.npmrc && \
    npm install && \
    rm -rf $HOME/.npmrc && \
    npm cache clean --force && rm -rf /root/.npm/_cacache

ENTRYPOINT [ "node", "index.js" ]
