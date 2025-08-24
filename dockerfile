FROM node:10.13

WORKDIR /app

COPY package.json /app

RUN npm install --force

COPY . /app

CMD ["npm", "run", "start"]
