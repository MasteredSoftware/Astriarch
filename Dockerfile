FROM mhart/alpine-node:10

ENV VERSION=v10.12.0 NPM_VERSION=6 YARN_VERSION=latest

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies & Bundle app source
ADD . /usr/src/app/

run apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ krb5-dev linux-headers make python && \
  npm install --quiet node-gyp -g &&\
  npm install --quiet && \
  apk del native-deps

CMD ["node", "app.js"]

EXPOSE 8000