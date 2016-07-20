FROM mhart/alpine-node:4.4.7

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies & Bundle app source
ADD . /usr/src/app/
RUN npm install

CMD ["node", "app.js"]

EXPOSE 8000